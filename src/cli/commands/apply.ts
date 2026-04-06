import { applyResolvedServers } from "../../core/apply";
import { parseClientSelection, resolveClientSelection } from "../../core/client-selection";
import { loadConfig } from "../../core/config-loader";
import { detectRepoPath } from "../../core/repo-detector";
import { resolveServers } from "../../core/resolver";
import { logInfo, logWarn } from "../../utils/logger";

export async function runApplyCommand(options?: { repo?: string; clients?: string }): Promise<void> {
  const config = await loadConfig();
  const repoDetection = options?.repo
    ? detectRepoPath({ repoFlag: options.repo })
    : detectRepoPath();
  const resolution = resolveServers(config, repoDetection.repoPath);
  const clientSelection = resolveClientSelection(parseClientSelection(options?.clients), {
    repoPath: resolution.repoPath,
    matchedRepo: resolution.matchedRepo,
  });

  for (const warning of resolution.warnings) {
    logWarn(warning);
  }

  const result = await applyResolvedServers(resolution, { clients: clientSelection.clients });

  logInfo(
    `Applied ${resolution.servers.length} active MCP server(s) for repo: ${resolution.repoPath} (${resolution.globalServers.length} global, ${resolution.repoScopedServers.length} repo-scoped)`,
  );
  logInfo(
    `Client selection: ${clientSelection.mode} -> ${clientSelection.clients.length > 0 ? clientSelection.clients.join(", ") : "(none)"}`,
  );
  if (clientSelection.mode === "auto") {
    for (const detection of clientSelection.detections.filter((candidate) => !candidate.selected)) {
      logInfo(`Skipped ${detection.client}: no existing config file and no detected CLI in PATH`);
    }
  }
  for (const target of result.targets) {
    const scopeLabel = target.scope === "repo" ? `repo ${target.repoPath}` : "global";
    logInfo(`Updated [${scopeLabel}]: ${target.filePath}`);
    if (target.backupPath) {
      logInfo(`Backup: ${target.backupPath}`);
    }
  }
  logInfo(`Detection: ${repoDetection.detectionMode}`);
}
