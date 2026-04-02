import { readClaudeConfig, renderClaudeConfig } from "../adapters/claude/writer";
import { readCodexConfig, mergeCodexConfig } from "../adapters/codex/writer";
import { readGeminiConfig, renderGeminiConfig } from "../adapters/gemini/writer";
import type { ApplyResult, ApplyTargetResult, ResolvedServer, SupportedClient } from "../types";
import { createBackupIfExists, restoreFromBackupOrRemove, writeFileAtomic } from "../utils/backup";
import { getClaudeConfigPath, getCodexConfigPath, getGeminiConfigPath } from "../utils/paths";

type PreparedTarget = ApplyTargetResult & {
  nextContent: string;
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

async function prepareTargets(servers: ResolvedServer[]): Promise<PreparedTarget[]> {
  const codexPath = getCodexConfigPath();
  const claudePath = getClaudeConfigPath();
  const geminiPath = getGeminiConfigPath();

  const codexExisting = await readCodexConfig(codexPath);
  const claudeExisting = await readClaudeConfig(claudePath);
  const geminiExisting = await readGeminiConfig(geminiPath);

  return [
    {
      client: "codex",
      filePath: codexPath,
      backupPath: null,
      nextContent: mergeCodexConfig(codexExisting, servers),
    },
    {
      client: "claude",
      filePath: claudePath,
      backupPath: null,
      nextContent: formatJsonContent(renderClaudeConfig(claudeExisting, servers)),
    },
    {
      client: "gemini",
      filePath: geminiPath,
      backupPath: null,
      nextContent: formatJsonContent(renderGeminiConfig(geminiExisting, servers)),
    },
  ];
}

export async function applyResolvedServers(servers: ResolvedServer[]): Promise<ApplyResult> {
  const preparedTargets = await prepareTargets(servers);

  for (const target of preparedTargets) {
    target.backupPath = await createBackupIfExists(target.filePath);
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
    targets: preparedTargets.map<ApplyTargetResult>(({ client, filePath, backupPath }) => ({
      client,
      filePath,
      backupPath,
    })),
    rollbackPerformed: false,
  };
}
