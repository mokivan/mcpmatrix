import fs from "fs";
import type { BackupEntry, RollbackResult, RollbackTarget, SupportedClient } from "../types";
import { getLatestBackup, getAllBackupTargets, resolveBackupSelection, writeFileAtomic } from "../utils/backup";

type PreparedRollbackTarget = RollbackTarget & {
  previousContent: Buffer | null;
  backupContent: Buffer;
};

async function readFileIfExists(filePath: string): Promise<Buffer | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.promises.readFile(filePath);
}

async function prepareRollbackTarget(entry: BackupEntry): Promise<PreparedRollbackTarget> {
  return {
    client: entry.client,
    filePath: entry.filePath,
    backupPath: entry.backupPath,
    previousContent: await readFileIfExists(entry.filePath),
    backupContent: await fs.promises.readFile(entry.backupPath),
  };
}

async function restorePreviousState(targets: PreparedRollbackTarget[]): Promise<void> {
  for (const target of targets) {
    if (target.previousContent === null) {
      await fs.promises.rm(target.filePath, { force: true }).catch(() => undefined);
      continue;
    }

    await writeFileAtomic(target.filePath, target.previousContent);
  }
}

function getRollbackErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveTargetsFromLatest(client?: SupportedClient): Promise<BackupEntry[]> {
  const clients = client ? [client] : getAllBackupTargets().map((target) => target.client);
  const entries: BackupEntry[] = [];

  for (const currentClient of clients) {
    const latestBackup = await getLatestBackup(currentClient);
    if (!latestBackup) {
      throw new Error(`No backup found for ${currentClient}`);
    }

    entries.push(latestBackup);
  }

  return entries;
}

async function resolveTargets(options?: { client?: SupportedClient; backup?: string }): Promise<BackupEntry[]> {
  if (options?.backup) {
    const selectedBackup = resolveBackupSelection(options.backup);
    if (options.client && selectedBackup.client !== options.client) {
      throw new Error(`Backup ${selectedBackup.backupFileName} does not belong to ${options.client}`);
    }

    return [selectedBackup];
  }

  return resolveTargetsFromLatest(options?.client);
}

export async function rollbackToBackup(options?: { client?: SupportedClient; backup?: string }): Promise<RollbackResult> {
  const selectedTargets = await resolveTargets(options);
  const preparedTargets: PreparedRollbackTarget[] = [];

  try {
    for (const target of selectedTargets) {
      preparedTargets.push(await prepareRollbackTarget(target));
    }
  } catch (error) {
    throw new Error(`rollback: failed to read backup state. Cause: ${getRollbackErrorMessage(error)}`);
  }

  const appliedTargets: PreparedRollbackTarget[] = [];

  try {
    for (const target of preparedTargets) {
      await writeFileAtomic(target.filePath, target.backupContent);
      appliedTargets.push(target);
    }
  } catch (error) {
    let rollbackErrorMessage = "";

    try {
      await restorePreviousState(appliedTargets);
    } catch (rollbackError) {
      rollbackErrorMessage = ` Rollback failed: ${getRollbackErrorMessage(rollbackError)}`;
    }

    throw new Error(`rollback: failed to restore backup.${rollbackErrorMessage} Cause: ${getRollbackErrorMessage(error)}`);
  }

  return {
    targets: preparedTargets.map<RollbackTarget>(({ client, filePath, backupPath }) => ({
      client,
      filePath,
      backupPath,
    })),
  };
}
