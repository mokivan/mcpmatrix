import type { SupportedClient } from "../../types";
import { listBackups } from "../../utils/backup";
import { logInfo } from "../../utils/logger";

export async function runListBackupsCommand(options?: { client?: SupportedClient }): Promise<void> {
  const backups = await listBackups(options?.client);

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
      logInfo(`- ${backup.backupFileName} (${backup.timestamp}) -> ${backup.backupPath}`);
    }
  }
}
