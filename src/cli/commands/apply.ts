import { readCodexConfig, writeCodexConfig } from "../../adapters/codex/writer";
import { readClaudeConfig, writeClaudeConfig } from "../../adapters/claude/writer";
import { readGeminiConfig, writeGeminiConfig } from "../../adapters/gemini/writer";
import { loadConfig } from "../../core/config-loader";
import { detectRepoPath } from "../../core/repo-detector";
import { resolveServers } from "../../core/resolver";
import { logInfo, logWarn } from "../../utils/logger";
import { getClaudeConfigPath, getCodexConfigPath, getGeminiConfigPath } from "../../utils/paths";

export async function runApplyCommand(options?: { repo?: string }): Promise<void> {
  const config = await loadConfig();
  const repoDetection = detectRepoPath({ repoFlag: options?.repo });
  const resolution = resolveServers(config, repoDetection.repoPath);

  for (const warning of resolution.warnings) {
    logWarn(warning);
  }

  await readCodexConfig();
  await readClaudeConfig();
  await readGeminiConfig();
  const codexBackup = await writeCodexConfig(resolution.servers);
  const claudeBackup = await writeClaudeConfig(resolution.servers);
  const geminiBackup = await writeGeminiConfig(resolution.servers);

  logInfo(`Applied ${resolution.servers.length} MCP server(s) for repo: ${resolution.repoPath}`);
  logInfo(`Updated: ${getCodexConfigPath()}`);
  if (codexBackup) {
    logInfo(`Backup: ${codexBackup}`);
  }
  logInfo(`Updated: ${getClaudeConfigPath()}`);
  if (claudeBackup) {
    logInfo(`Backup: ${claudeBackup}`);
  }
  logInfo(`Updated: ${getGeminiConfigPath()}`);
  if (geminiBackup) {
    logInfo(`Backup: ${geminiBackup}`);
  }
  logInfo(`Detection: ${repoDetection.detectionMode}`);
}
