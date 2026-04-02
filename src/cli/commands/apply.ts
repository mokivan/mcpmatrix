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

  const result = await applyResolvedServers(resolution.servers);

  logInfo(`Applied ${resolution.servers.length} MCP server(s) for repo: ${resolution.repoPath}`);
  for (const target of result.targets) {
    logInfo(`Updated: ${target.filePath}`);
    if (target.backupPath) {
      logInfo(`Backup: ${target.backupPath}`);
    }
  }
  logInfo(`Detection: ${repoDetection.detectionMode}`);
}
