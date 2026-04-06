import { applyResolvedServers } from "../../core/apply";
import { loadConfig } from "../../core/config-loader";
import { detectRepoPath } from "../../core/repo-detector";
import { resolveServers } from "../../core/resolver";
import { logInfo, logWarn } from "../../utils/logger";

export async function runApplyCommand(options?: { repo?: string }): Promise<void> {
  const config = await loadConfig();
  const repoDetection = options?.repo
    ? detectRepoPath({ repoFlag: options.repo })
    : detectRepoPath();
  const resolution = resolveServers(config, repoDetection.repoPath);

  for (const warning of resolution.warnings) {
    logWarn(warning);
  }

  const result = await applyResolvedServers(resolution);

  logInfo(
    `Applied ${resolution.servers.length} active MCP server(s) for repo: ${resolution.repoPath} (${resolution.globalServers.length} global, ${resolution.repoScopedServers.length} repo-scoped)`,
  );
  for (const target of result.targets) {
    const scopeLabel = target.scope === "repo" ? `repo ${target.repoPath}` : "global";
    logInfo(`Updated [${scopeLabel}]: ${target.filePath}`);
    if (target.backupPath) {
      logInfo(`Backup: ${target.backupPath}`);
    }
  }
  logInfo(`Detection: ${repoDetection.detectionMode}`);
}
