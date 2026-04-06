import { readClaudeConfig, renderClaudeConfig } from "../adapters/claude/writer";
import { readCodexConfig, mergeCodexConfig } from "../adapters/codex/writer";
import { readGeminiConfig, renderGeminiConfig } from "../adapters/gemini/writer";
import type { ApplyResult, ApplyTargetResult, ResolutionResult, ResolvedServer, SupportedClient } from "../types";
import { createBackupIfExists, restoreFromBackupOrRemove, writeFileAtomic } from "../utils/backup";
import {
  getClaudeConfigPath,
  getCodexConfigPath,
  getGeminiConfigPath,
  getRepoClaudeConfigPath,
  getRepoCodexConfigPath,
  getRepoGeminiConfigPath,
} from "../utils/paths";

type PreparedTarget = ApplyTargetResult & {
  nextContent: string;
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

async function prepareTarget(target: PreparedTargetInput): Promise<PreparedTarget> {
  if (target.client === "codex") {
    const existingContent = await readCodexConfig(target.filePath);
    return {
      client: target.client,
      scope: target.scope,
      filePath: target.filePath,
      backupPath: null,
      ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
      nextContent: mergeCodexConfig(existingContent, target.servers),
    };
  }

  if (target.client === "claude") {
    const existingConfig = await readClaudeConfig(target.filePath);
    return {
      client: target.client,
      scope: target.scope,
      filePath: target.filePath,
      backupPath: null,
      ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
      nextContent: formatJsonContent(renderClaudeConfig(existingConfig, target.servers)),
    };
  }

  const existingConfig = await readGeminiConfig(target.filePath);
  return {
    client: target.client,
    scope: target.scope,
    filePath: target.filePath,
    backupPath: null,
    ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
    nextContent: formatJsonContent(renderGeminiConfig(existingConfig, target.servers)),
  };
}

async function prepareTargets(resolution: ResolutionResult): Promise<PreparedTarget[]> {
  const targets: PreparedTargetInput[] = [
    {
      client: "codex",
      scope: "global",
      filePath: getCodexConfigPath(),
      servers: resolution.globalServers,
    },
    {
      client: "claude",
      scope: "global",
      filePath: getClaudeConfigPath(),
      servers: resolution.globalServers,
    },
    {
      client: "gemini",
      scope: "global",
      filePath: getGeminiConfigPath(),
      servers: resolution.globalServers,
    },
  ];

  if (resolution.matchedRepo) {
    targets.push(
      {
        client: "codex",
        scope: "repo",
        filePath: getRepoCodexConfigPath(resolution.repoPath),
        repoPath: resolution.repoPath,
        servers: resolution.repoScopedServers,
      },
      {
        client: "claude",
        scope: "repo",
        filePath: getRepoClaudeConfigPath(resolution.repoPath),
        repoPath: resolution.repoPath,
        servers: resolution.repoScopedServers,
      },
      {
        client: "gemini",
        scope: "repo",
        filePath: getRepoGeminiConfigPath(resolution.repoPath),
        repoPath: resolution.repoPath,
        servers: resolution.repoScopedServers,
      },
    );
  }

  return Promise.all(targets.map((target) => prepareTarget(target)));
}

export async function applyResolvedServers(resolution: ResolutionResult): Promise<ApplyResult> {
  const preparedTargets = await prepareTargets(resolution);

  for (const target of preparedTargets) {
    target.backupPath = await createBackupIfExists(target.filePath, {
      client: target.client,
      scope: target.scope,
      ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
    });
  }

  let failedTarget: SupportedClient | null = null;

  try {
    for (const target of preparedTargets) {
      failedTarget = target.client;
      await writeFileAtomic(target.filePath, target.nextContent);
    }
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
    rollbackPerformed: false,
  };
}
