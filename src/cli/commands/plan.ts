import { readClaudeConfig, renderClaudeConfig } from "../../adapters/claude/writer";
import { readCodexConfig, renderCodexManagedSection } from "../../adapters/codex/writer";
import { readGeminiConfig, renderGeminiConfig } from "../../adapters/gemini/writer";
import { loadConfig } from "../../core/config-loader";
import { detectRepoPath } from "../../core/repo-detector";
import { resolveServers } from "../../core/resolver";
import { describeServer, getClientCompatibility } from "../../core/server-config";
import { logInfo, logWarn } from "../../utils/logger";
import { getClaudeConfigPath, getCodexConfigPath, getGeminiConfigPath } from "../../utils/paths";

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
  const codexNext = renderCodexManagedSection(resolution.servers);
  const claudeExistingConfig = await readClaudeConfig(claudePath);
  const claudeExisting = JSON.stringify(claudeExistingConfig, null, 2);
  const claudeNext = `${JSON.stringify(renderClaudeConfig(claudeExistingConfig, resolution.servers), null, 2)}\n`;
  const geminiExistingConfig = await readGeminiConfig(geminiPath);
  const geminiExisting = JSON.stringify(geminiExistingConfig, null, 2);
  const geminiNext = `${JSON.stringify(renderGeminiConfig(geminiExistingConfig, resolution.servers), null, 2)}\n`;

  logInfo(`Repo: ${resolution.repoPath}`);
  logInfo(`Detection: ${repoDetection.detectionMode}`);
  logInfo(`Tags: ${resolution.tags.length > 0 ? resolution.tags.join(", ") : "(none)"}`);
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
  logInfo(`- ${codexPath}`);
  logInfo(`- ${claudePath}`);
  logInfo(`- ${geminiPath}`);
  logInfo("Estimated diff:");
  logInfo(`- Codex managed section lines: ${estimateLineDiff("", codexNext)}`);
  logInfo(`- Claude JSON line delta: ${estimateLineDiff(claudeExisting, claudeNext)}`);
  logInfo(`- Gemini JSON line delta: ${estimateLineDiff(geminiExisting, geminiNext)}`);
  logInfo(`- Existing Codex content preserved outside managed block: ${codexExisting.trim().length > 0 ? "yes" : "n/a"}`);
}
