import type { SupportedClient } from "../../types";
import { rollbackToBackup } from "../../core/rollback";
import { logInfo } from "../../utils/logger";

export async function runRollbackCommand(options?: { client?: SupportedClient; backup?: string }): Promise<void> {
  const result = await rollbackToBackup(options);

  for (const target of result.targets) {
    logInfo(`Restored ${target.client}: ${target.filePath}`);
    logInfo(`Backup: ${target.backupPath}`);
  }
}
