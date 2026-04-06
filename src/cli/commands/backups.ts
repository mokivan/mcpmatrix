import type { SupportedClient } from "../../types";
import { listBackups } from "../../utils/backup";
import { logInfo } from "../../utils/logger";

export async function runListBackupsCommand(options?: { client?: SupportedClient; repo?: string }): Promise<void> {
  const backups = await listBackups({
    scope: options?.repo ? "repo" : "global",
    ...(options?.client === undefined ? {} : { client: options.client }),
    ...(options?.repo === undefined ? {} : { repoPath: options.repo }),
  });

  if (backups.length === 0) {
    logInfo("No backups found.");
    return;
  }

  const groupedBackups = new Map<SupportedClient, typeof backups>();

  for (const backup of backups) {
    const currentGroup = groupedBackups.get(backup.client) ?? [];
    currentGroup.push(backup);
    groupedBackups.set(backup.client, currentGroup);
  }

  for (const [client, clientBackups] of groupedBackups) {
    logInfo(`${client}:`);
    for (const backup of clientBackups) {
      const scopeLabel = backup.scope === "repo" ? `repo ${backup.repoPath}` : "global";
      logInfo(`- [${scopeLabel}] ${backup.backupFileName} (${backup.timestamp}) -> ${backup.backupPath}`);
    }
  }
}
