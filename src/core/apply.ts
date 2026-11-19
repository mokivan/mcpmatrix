import { readClaudeConfig, renderClaudeConfig } from "../adapters/claude/writer";
import { readCopilotCliConfig, renderCopilotCliConfig } from "../adapters/copilot-cli/writer";
import { readCopilotVsCodeConfig, renderCopilotVsCodeConfig } from "../adapters/copilot-vscode/writer";
import { readCodexConfig, mergeCodexConfig } from "../adapters/codex/writer";
import { readGeminiConfig, renderGeminiConfig } from "../adapters/gemini/writer";
import type {
  ApplyResult,
  ApplyTargetResult,
  ResolutionResult,
  ResolvedServer,
  SkippedServerResult,
  SupportedClient,
} from "../types";
import { createBackupIfExists, restoreFromBackupOrRemove, writeFileAtomic } from "../utils/backup";
import { SUPPORTED_CLIENTS } from "./client-selection";
import { getManagedNames, loadManagedState, saveManagedState, setManagedNames } from "./managed-state";
import type { ManagedState } from "./managed-state";
import { partitionServersForClient } from "./server-config";
import {
  getClaudeConfigPath,
  getCopilotCliConfigPath,
  getCopilotVsCodeConfigPath,
  getCodexConfigPath,
  getGeminiConfigPath,
  getRepoClaudeConfigPath,
  getRepoCopilotCliConfigPath,
  getRepoCopilotVsCodeConfigPath,
  getRepoCodexConfigPath,
  getRepoGeminiConfigPath,
} from "../utils/paths";

type PreparedTarget = ApplyTargetResult & {
  nextContent: string;
  managedNames: string[];
};

type PreparedTargetInput = {
  client: SupportedClient;
  scope: ApplyTargetResult["scope"];
  filePath: string;
  servers: ResolvedServer[];
  repoPath?: string;
};

function formatJsonContent(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function rollbackAppliedTargets(targets: ApplyTargetResult[]): Promise<void> {
  for (const target of targets) {
    await restoreFromBackupOrRemove(target.filePath, target.backupPath);
  }
}

async function renderNextContent(target: PreparedTargetInput, previouslyManaged: string[]): Promise<string> {
  switch (target.client) {
    case "codex":
      // Codex keeps its own marker-delimited block, so it does not need the managed-names state.
      return mergeCodexConfig(await readCodexConfig(target.filePath), target.servers);
    case "claude":
      return formatJsonContent(renderClaudeConfig(await readClaudeConfig(target.filePath), target.servers, previouslyManaged));
    case "gemini":
      return formatJsonContent(renderGeminiConfig(await readGeminiConfig(target.filePath), target.servers, previouslyManaged));
    case "copilot-cli":
      return formatJsonContent(
        renderCopilotCliConfig(await readCopilotCliConfig(target.filePath), target.servers, previouslyManaged),
      );
    case "copilot-vscode":
      return formatJsonContent(
        renderCopilotVsCodeConfig(await readCopilotVsCodeConfig(target.filePath), target.servers, previouslyManaged),
      );
  }
}

async function prepareTarget(target: PreparedTargetInput, state: ManagedState): Promise<PreparedTarget> {
  return {
    client: target.client,
    scope: target.scope,
    filePath: target.filePath,
    backupPath: null,
    ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
    nextContent: await renderNextContent(target, getManagedNames(state, target.client, target.filePath)),
    managedNames: target.servers.map((server) => server.name),
  };
}

function buildTargetInputs(resolution: ResolutionResult): PreparedTargetInput[] {
  const globalTargets: PreparedTargetInput[] = [
    { client: "codex", scope: "global", filePath: getCodexConfigPath(), servers: resolution.globalServers },
    { client: "claude", scope: "global", filePath: getClaudeConfigPath(), servers: resolution.globalServers },
    { client: "gemini", scope: "global", filePath: getGeminiConfigPath(), servers: resolution.globalServers },
    { client: "copilot-cli", scope: "global", filePath: getCopilotCliConfigPath(), servers: resolution.globalServers },
    {
      client: "copilot-vscode",
      scope: "global",
      filePath: getCopilotVsCodeConfigPath(),
      servers: resolution.globalServers,
    },
  ];

  if (!resolution.matchedRepo) {
    return globalTargets;
  }

  const repoPath = resolution.repoPath;
  const servers = resolution.repoScopedServers;
  return [
    ...globalTargets,
    { client: "codex", scope: "repo", filePath: getRepoCodexConfigPath(repoPath), repoPath, servers },
    { client: "claude", scope: "repo", filePath: getRepoClaudeConfigPath(repoPath), repoPath, servers },
    { client: "gemini", scope: "repo", filePath: getRepoGeminiConfigPath(repoPath), repoPath, servers },
    { client: "copilot-cli", scope: "repo", filePath: getRepoCopilotCliConfigPath(repoPath), repoPath, servers },
    { client: "copilot-vscode", scope: "repo", filePath: getRepoCopilotVsCodeConfigPath(repoPath), repoPath, servers },
  ];
}

async function prepareTargets(
  resolution: ResolutionResult,
  clients: SupportedClient[],
  strict: boolean,
  state: ManagedState,
): Promise<{ targets: PreparedTarget[]; skipped: SkippedServerResult[] }> {
  const skipped: SkippedServerResult[] = [];

  const inputs = buildTargetInputs(resolution)
    .filter((target) => clients.includes(target.client))
    .map<PreparedTargetInput>((target) => {
      // Strict mode (clients named explicitly) keeps every server so an unsupported one fails loudly in the writer.
      if (strict) {
        return target;
      }

      const partition = partitionServersForClient(target.servers, target.client);
      for (const entry of partition.skipped) {
        skipped.push({ client: target.client, scope: target.scope, serverName: entry.server.name, reason: entry.reason });
      }

      return { ...target, servers: partition.supported };
    });

  const targets = await Promise.all(inputs.map((input) => prepareTarget(input, state)));
  return { targets, skipped };
}

/**
 * `strict` makes a server that a client cannot represent an error. Without it (the `all` and `auto` client
 * selections) that server is skipped for that client and reported in `skipped`.
 */
export async function applyResolvedServers(
  resolution: ResolutionResult,
  options?: { clients?: SupportedClient[]; strict?: boolean },
): Promise<ApplyResult> {
  const selectedClients = options?.clients ?? SUPPORTED_CLIENTS;
  const state = await loadManagedState();
  const { targets: preparedTargets, skipped } = await prepareTargets(resolution, selectedClients, options?.strict ?? true, state);

  for (const target of preparedTargets) {
    target.backupPath = await createBackupIfExists(target.filePath, {
      client: target.client,
      scope: target.scope,
      ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
    });
  }

  let failedTarget: SupportedClient | "state" | null = null;

  try {
    for (const target of preparedTargets) {
      failedTarget = target.client;
      await writeFileAtomic(target.filePath, target.nextContent);
    }

    // The managed-names state is committed last, so a failed apply never records servers it did not write.
    failedTarget = "state";
    for (const target of preparedTargets) {
      setManagedNames(state, target.client, target.filePath, target.managedNames);
    }
    await saveManagedState(state);
  } catch (error) {
    let rollbackErrorMessage = "";

    try {
      await rollbackAppliedTargets(preparedTargets);
    } catch (rollbackError) {
      rollbackErrorMessage = ` Rollback failed: ${getErrorMessage(rollbackError)}`;
    }

    throw new Error(
      `apply: failed to update ${failedTarget ?? "target"} config; restored previous state.${rollbackErrorMessage} Cause: ${getErrorMessage(error)}`,
    );
  }

  return {
    targets: preparedTargets.map<ApplyTargetResult>(({ client, scope, filePath, backupPath, repoPath }) => ({
      client,
      scope,
      filePath,
      backupPath,
      ...(repoPath === undefined ? {} : { repoPath }),
    })),
    skipped,
    rollbackPerformed: false,
  };
}
