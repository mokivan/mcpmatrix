import { readCodexConfig, writeCodexConfig } from "../../adapters/codex/writer";
import { readClaudeConfig, writeClaudeConfig } from "../../adapters/claude/writer";
import { loadConfig } from "../../core/config-loader";
import { detectRepoPath } from "../../core/repo-detector";
import { resolveServers } from "../../core/resolver";
import { logInfo, logWarn } from "../../utils/logger";
import { getClaudeConfigPath, getCodexConfigPath } from "../../utils/paths";

export async function runApplyCommand(options?: { repo?: string }): Promise<void> {
  const config = await loadConfig();
  const repoDetection = detectRepoPath({ repoFlag: options?.repo });
  const resolution = resolveServers(config, repoDetection.repoPath);

  for (const warning of resolution.warnings) {
    logWarn(warning);
  }

  await readCodexConfig();
  await readClaudeConfig();
  const codexBackup = await writeCodexConfig(resolution.servers);
  const claudeBackup = await writeClaudeConfig(resolution.servers);

  logInfo(`Applied ${resolution.servers.length} MCP server(s) for repo: ${resolution.repoPath}`);
  logInfo(`Updated: ${getCodexConfigPath()}`);
  if (codexBackup) {
    logInfo(`Backup: ${codexBackup}`);
  }
  logInfo(`Updated: ${getClaudeConfigPath()}`);
  if (claudeBackup) {
    logInfo(`Backup: ${claudeBackup}`);
  }
  logInfo(`Detection: ${repoDetection.detectionMode}`);
}
