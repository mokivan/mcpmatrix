import type { SupportedClient } from "../../types";
import { rollbackToBackup } from "../../core/rollback";
import { logInfo } from "../../utils/logger";

export async function runRollbackCommand(options?: { client?: SupportedClient; backup?: string; repo?: string }): Promise<void> {
  const result = await rollbackToBackup({
    ...(options?.client === undefined ? {} : { client: options.client }),
    ...(options?.backup === undefined ? {} : { backup: options.backup }),
    ...(options?.repo === undefined ? {} : { repoPath: options.repo }),
  });

  for (const target of result.targets) {
    const scopeLabel = target.scope === "repo" ? `repo ${target.repoPath}` : "global";
    logInfo(`Restored ${target.client} [${scopeLabel}]: ${target.filePath}`);
    logInfo(`Backup: ${target.backupPath}`);
  }
}
