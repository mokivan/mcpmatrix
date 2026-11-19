import { readClaudeConfig, renderClaudeConfig } from "../../adapters/claude/writer";
import { readCopilotCliConfig, renderCopilotCliConfig } from "../../adapters/copilot-cli/writer";
import { readCopilotVsCodeConfig, renderCopilotVsCodeConfig } from "../../adapters/copilot-vscode/writer";
import { readCodexConfig, renderCodexManagedSection } from "../../adapters/codex/writer";
import { readGeminiConfig, renderGeminiConfig } from "../../adapters/gemini/writer";
import { SUPPORTED_CLIENTS } from "../../core/client-selection";
import { loadConfig } from "../../core/config-loader";
import { detectRepoPath } from "../../core/repo-detector";
import { getManagedNames, loadManagedState } from "../../core/managed-state";
import { resolveServers } from "../../core/resolver";
import { describeServer, getClientCompatibility, partitionServersForClient } from "../../core/server-config";
import type { ResolvedServer, SupportedClient } from "../../types";
import { logInfo, logWarn } from "../../utils/logger";
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
} from "../../utils/paths";

function estimateLineDiff(beforeContent: string, afterContent: string): number {
  const beforeLines = beforeContent.split(/\r?\n/).length;
  const afterLines = afterContent.split(/\r?\n/).length;
  return Math.abs(afterLines - beforeLines);
}

function formatJsonContent(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function supportedFor(servers: ResolvedServer[], client: SupportedClient): ResolvedServer[] {
  return partitionServersForClient(servers, client).supported;
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

  const state = await loadManagedState();
  const codexPath = getCodexConfigPath();
  const claudePath = getClaudeConfigPath();
  const geminiPath = getGeminiConfigPath();
  const copilotCliPath = getCopilotCliConfigPath();
  const copilotVsCodePath = getCopilotVsCodeConfigPath();
  const codexExisting = await readCodexConfig(codexPath);
  const codexNext = renderCodexManagedSection(supportedFor(resolution.globalServers, "codex"));
  const claudeExistingConfig = await readClaudeConfig(claudePath);
  const claudeExisting = JSON.stringify(claudeExistingConfig, null, 2);
  const claudeNext = formatJsonContent(renderClaudeConfig(claudeExistingConfig, supportedFor(resolution.globalServers, "claude"), getManagedNames(state, "claude", claudePath)));
  const geminiExistingConfig = await readGeminiConfig(geminiPath);
  const geminiExisting = JSON.stringify(geminiExistingConfig, null, 2);
  const geminiNext = formatJsonContent(renderGeminiConfig(geminiExistingConfig, supportedFor(resolution.globalServers, "gemini"), getManagedNames(state, "gemini", geminiPath)));
  const copilotCliExistingConfig = await readCopilotCliConfig(copilotCliPath);
  const copilotCliExisting = JSON.stringify(copilotCliExistingConfig, null, 2);
  const copilotCliNext = formatJsonContent(renderCopilotCliConfig(copilotCliExistingConfig, supportedFor(resolution.globalServers, "copilot-cli"), getManagedNames(state, "copilot-cli", copilotCliPath)));
  const copilotVsCodeExistingConfig = await readCopilotVsCodeConfig(copilotVsCodePath);
  const copilotVsCodeExisting = JSON.stringify(copilotVsCodeExistingConfig, null, 2);
  const copilotVsCodeNext = formatJsonContent(
    renderCopilotVsCodeConfig(copilotVsCodeExistingConfig, supportedFor(resolution.globalServers, "copilot-vscode"), getManagedNames(state, "copilot-vscode", copilotVsCodePath)),
  );

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
      for (const client of SUPPORTED_CLIENTS) {
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
  logInfo(`- [global] ${copilotCliPath}`);
  logInfo(`- [global] ${copilotVsCodePath}`);
  if (resolution.matchedRepo) {
    logInfo(`- [repo] ${getRepoCodexConfigPath(resolution.repoPath)}`);
    logInfo(`- [repo] ${getRepoClaudeConfigPath(resolution.repoPath)}`);
    logInfo(`- [repo] ${getRepoGeminiConfigPath(resolution.repoPath)}`);
    logInfo(`- [repo] ${getRepoCopilotCliConfigPath(resolution.repoPath)}`);
    logInfo(`- [repo] ${getRepoCopilotVsCodeConfigPath(resolution.repoPath)}`);
  }
  logInfo("Estimated diff:");
  logInfo(`- Global Codex managed section lines: ${estimateLineDiff("", codexNext)}`);
  logInfo(`- Global Claude JSON line delta: ${estimateLineDiff(claudeExisting, claudeNext)}`);
  logInfo(`- Global Gemini JSON line delta: ${estimateLineDiff(geminiExisting, geminiNext)}`);
  logInfo(`- Global Copilot CLI JSON line delta: ${estimateLineDiff(copilotCliExisting, copilotCliNext)}`);
  logInfo(`- Global Copilot VS Code JSON line delta: ${estimateLineDiff(copilotVsCodeExisting, copilotVsCodeNext)}`);
  if (resolution.matchedRepo) {
    const repoCodexPath = getRepoCodexConfigPath(resolution.repoPath);
    const repoClaudePath = getRepoClaudeConfigPath(resolution.repoPath);
    const repoGeminiPath = getRepoGeminiConfigPath(resolution.repoPath);
    const repoCopilotCliPath = getRepoCopilotCliConfigPath(resolution.repoPath);
    const repoCopilotVsCodePath = getRepoCopilotVsCodeConfigPath(resolution.repoPath);
    const repoCodexExisting = await readCodexConfig(repoCodexPath);
    const repoCodexNext = renderCodexManagedSection(supportedFor(resolution.repoScopedServers, "codex"));
    const repoClaudeExistingConfig = await readClaudeConfig(repoClaudePath);
    const repoClaudeExisting = JSON.stringify(repoClaudeExistingConfig, null, 2);
    const repoClaudeNext = formatJsonContent(renderClaudeConfig(repoClaudeExistingConfig, supportedFor(resolution.repoScopedServers, "claude"), getManagedNames(state, "claude", repoClaudePath)));
    const repoGeminiExistingConfig = await readGeminiConfig(repoGeminiPath);
    const repoGeminiExisting = JSON.stringify(repoGeminiExistingConfig, null, 2);
    const repoGeminiNext = formatJsonContent(renderGeminiConfig(repoGeminiExistingConfig, supportedFor(resolution.repoScopedServers, "gemini"), getManagedNames(state, "gemini", repoGeminiPath)));
    const repoCopilotCliExistingConfig = await readCopilotCliConfig(repoCopilotCliPath);
    const repoCopilotCliExisting = JSON.stringify(repoCopilotCliExistingConfig, null, 2);
    const repoCopilotCliNext = formatJsonContent(
      renderCopilotCliConfig(repoCopilotCliExistingConfig, supportedFor(resolution.repoScopedServers, "copilot-cli"), getManagedNames(state, "copilot-cli", repoCopilotCliPath)),
    );
    const repoCopilotVsCodeExistingConfig = await readCopilotVsCodeConfig(repoCopilotVsCodePath);
    const repoCopilotVsCodeExisting = JSON.stringify(repoCopilotVsCodeExistingConfig, null, 2);
    const repoCopilotVsCodeNext = formatJsonContent(
      renderCopilotVsCodeConfig(repoCopilotVsCodeExistingConfig, supportedFor(resolution.repoScopedServers, "copilot-vscode"), getManagedNames(state, "copilot-vscode", repoCopilotVsCodePath)),
    );

    logInfo(`- Repo Codex managed section lines: ${estimateLineDiff("", repoCodexNext)}`);
    logInfo(`- Repo Claude JSON line delta: ${estimateLineDiff(repoClaudeExisting, repoClaudeNext)}`);
    logInfo(`- Repo Gemini JSON line delta: ${estimateLineDiff(repoGeminiExisting, repoGeminiNext)}`);
    logInfo(`- Repo Copilot CLI JSON line delta: ${estimateLineDiff(repoCopilotCliExisting, repoCopilotCliNext)}`);
    logInfo(
      `- Repo Copilot VS Code JSON line delta: ${estimateLineDiff(repoCopilotVsCodeExisting, repoCopilotVsCodeNext)}`,
    );
    logInfo(`- Existing repo Codex content preserved outside managed block: ${repoCodexExisting.trim().length > 0 ? "yes" : "n/a"}`);
  }
  logInfo(`- Existing Codex content preserved outside managed block: ${codexExisting.trim().length > 0 ? "yes" : "n/a"}`);
}
