import { readClaudeConfig, renderClaudeConfig } from "../../adapters/claude/writer";
import { readCodexConfig, renderCodexManagedSection } from "../../adapters/codex/writer";
import { readGeminiConfig, renderGeminiConfig } from "../../adapters/gemini/writer";
import { loadConfig } from "../../core/config-loader";
import { detectRepoPath } from "../../core/repo-detector";
import { resolveServers } from "../../core/resolver";
import { describeServer, getClientCompatibility } from "../../core/server-config";
import { logInfo, logWarn } from "../../utils/logger";
import {
  getClaudeConfigPath,
  getCodexConfigPath,
  getGeminiConfigPath,
  getRepoClaudeConfigPath,
  getRepoCodexConfigPath,
  getRepoGeminiConfigPath,
} from "../../utils/paths";

function estimateLineDiff(beforeContent: string, afterContent: string): number {
  const beforeLines = beforeContent.split(/\r?\n/).length;
  const afterLines = afterContent.split(/\r?\n/).length;
  return Math.abs(afterLines - beforeLines);
}

export async function runPlanCommand(options?: { repo?: string }): Promise<void> {
  const config = await loadConfig();
  const repoDetection = options?.repo
    ? detectRepoPath({ repoFlag: options.repo })
    : detectRepoPath();
  const resolution = resolveServers(config, repoDetection.repoPath);

  for (const warning of resolution.warnings) {
    logWarn(warning);
  }

  const codexPath = getCodexConfigPath();
  const claudePath = getClaudeConfigPath();
  const geminiPath = getGeminiConfigPath();
  const codexExisting = await readCodexConfig(codexPath);
  const codexNext = renderCodexManagedSection(resolution.globalServers);
  const claudeExistingConfig = await readClaudeConfig(claudePath);
  const claudeExisting = JSON.stringify(claudeExistingConfig, null, 2);
  const claudeNext = `${JSON.stringify(renderClaudeConfig(claudeExistingConfig, resolution.globalServers), null, 2)}\n`;
  const geminiExistingConfig = await readGeminiConfig(geminiPath);
  const geminiExisting = JSON.stringify(geminiExistingConfig, null, 2);
  const geminiNext = `${JSON.stringify(renderGeminiConfig(geminiExistingConfig, resolution.globalServers), null, 2)}\n`;

  logInfo(`Repo: ${resolution.repoPath}`);
  logInfo(`Detection: ${repoDetection.detectionMode}`);
  logInfo(`Tags: ${resolution.tags.length > 0 ? resolution.tags.join(", ") : "(none)"}`);
  logInfo(`Global servers: ${resolution.globalServers.length > 0 ? resolution.globalServers.map((server) => server.name).join(", ") : "(none)"}`);
  logInfo(
    `Repo-scoped servers: ${resolution.repoScopedServers.length > 0 ? resolution.repoScopedServers.map((server) => server.name).join(", ") : "(none)"}`,
  );
  logInfo("Active servers:");

  if (resolution.servers.length === 0) {
    logInfo("- (none)");
  } else {
    for (const server of resolution.servers) {
      logInfo(`- ${describeServer(server)}`);

      const compatibility = getClientCompatibility(server);
      for (const client of ["codex", "claude", "gemini"] as const) {
        const support = compatibility[client];
        if (support.supported) {
          logInfo(`  ${client}: ok`);
        } else {
          logWarn(`${server.name}: ${client} incompatible: ${support.reason}`);
        }
      }
    }
  }

  logInfo("Files to update:");
  logInfo(`- [global] ${codexPath}`);
  logInfo(`- [global] ${claudePath}`);
  logInfo(`- [global] ${geminiPath}`);
  if (resolution.matchedRepo) {
    logInfo(`- [repo] ${getRepoCodexConfigPath(resolution.repoPath)}`);
    logInfo(`- [repo] ${getRepoClaudeConfigPath(resolution.repoPath)}`);
    logInfo(`- [repo] ${getRepoGeminiConfigPath(resolution.repoPath)}`);
  }
  logInfo("Estimated diff:");
  logInfo(`- Global Codex managed section lines: ${estimateLineDiff("", codexNext)}`);
  logInfo(`- Global Claude JSON line delta: ${estimateLineDiff(claudeExisting, claudeNext)}`);
  logInfo(`- Global Gemini JSON line delta: ${estimateLineDiff(geminiExisting, geminiNext)}`);
  if (resolution.matchedRepo) {
    const repoCodexPath = getRepoCodexConfigPath(resolution.repoPath);
    const repoClaudePath = getRepoClaudeConfigPath(resolution.repoPath);
    const repoGeminiPath = getRepoGeminiConfigPath(resolution.repoPath);
    const repoCodexExisting = await readCodexConfig(repoCodexPath);
    const repoCodexNext = renderCodexManagedSection(resolution.repoScopedServers);
    const repoClaudeExistingConfig = await readClaudeConfig(repoClaudePath);
    const repoClaudeExisting = JSON.stringify(repoClaudeExistingConfig, null, 2);
    const repoClaudeNext = `${JSON.stringify(renderClaudeConfig(repoClaudeExistingConfig, resolution.repoScopedServers), null, 2)}\n`;
    const repoGeminiExistingConfig = await readGeminiConfig(repoGeminiPath);
    const repoGeminiExisting = JSON.stringify(repoGeminiExistingConfig, null, 2);
    const repoGeminiNext = `${JSON.stringify(renderGeminiConfig(repoGeminiExistingConfig, resolution.repoScopedServers), null, 2)}\n`;

    logInfo(`- Repo Codex managed section lines: ${estimateLineDiff("", repoCodexNext)}`);
    logInfo(`- Repo Claude JSON line delta: ${estimateLineDiff(repoClaudeExisting, repoClaudeNext)}`);
    logInfo(`- Repo Gemini JSON line delta: ${estimateLineDiff(repoGeminiExisting, repoGeminiNext)}`);
    logInfo(`- Existing repo Codex content preserved outside managed block: ${repoCodexExisting.trim().length > 0 ? "yes" : "n/a"}`);
  }
  logInfo(`- Existing Codex content preserved outside managed block: ${codexExisting.trim().length > 0 ? "yes" : "n/a"}`);
}
