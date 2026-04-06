import { assertSupportedClient } from "../../core/client-selection";
import type { SupportedClient } from "../../types";
import { rollbackToBackup } from "../../core/rollback";
import { logInfo } from "../../utils/logger";

export async function runRollbackCommand(options?: { client?: SupportedClient; backup?: string; repo?: string }): Promise<void> {
  const selectedClient = assertSupportedClient(options?.client);
  const result = await rollbackToBackup({
    ...(selectedClient === undefined ? {} : { client: selectedClient }),
    ...(options?.backup === undefined ? {} : { backup: options.backup }),
    ...(options?.repo === undefined ? {} : { repoPath: options.repo }),
  });

  for (const target of result.targets) {
    const scopeLabel = target.scope === "repo" ? `repo ${target.repoPath}` : "global";
    logInfo(`Restored ${target.client} [${scopeLabel}]: ${target.filePath}`);
    logInfo(`Backup: ${target.backupPath}`);
  }
}
