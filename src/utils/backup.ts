import fs from "fs";
import path from "path";
import type { BackupEntry, SupportedClient } from "../types";
import { getBackupsDir } from "./paths";
import { getClaudeConfigPath, getCodexConfigPath, getGeminiConfigPath } from "./paths";

type BackupTarget = {
  client: SupportedClient;
  filePath: string;
  stem: string;
  extension: string;
};

const BACKUP_TARGETS: Record<SupportedClient, () => BackupTarget> = {
  codex: () => ({
    client: "codex",
    filePath: getCodexConfigPath(),
    stem: "config",
    extension: ".toml",
  }),
  claude: () => ({
    client: "claude",
    filePath: getClaudeConfigPath(),
    stem: "claude",
    extension: ".json",
  }),
  gemini: () => ({
    client: "gemini",
    filePath: getGeminiConfigPath(),
    stem: "settings",
    extension: ".json",
  }),
};

const TIMESTAMP_PATTERN = "\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}";

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

function sanitizeBackupStem(filePath: string): { stem: string; extension: string } {
  const parsedPath = path.parse(filePath);
  const stem = parsedPath.name.replace(/^\.+/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "config";
  return {
    stem,
    extension: parsedPath.ext || ".bak",
  };
}

function createTimestamp(date = new Date()): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}-${minute}`;
}

async function enforceBackupRetention(stem: string, extension: string): Promise<void> {
  const backupsDir = getBackupsDir();

  if (!fs.existsSync(backupsDir)) {
    return;
  }

  const matchingFiles = (await fs.promises.readdir(backupsDir))
    .filter((entry) => entry.startsWith(`${stem}-`) && entry.endsWith(extension))
    .sort()
    .reverse();

  for (const staleBackup of matchingFiles.slice(3)) {
    await fs.promises.rm(path.join(backupsDir, staleBackup), { force: true });
  }
}

export async function createBackupIfExists(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const backupsDir = getBackupsDir();
  const { stem, extension } = sanitizeBackupStem(filePath);
  const timestamp = createTimestamp();
  let backupPath = path.join(backupsDir, `${stem}-${timestamp}${extension}`);
  let collisionIndex = 1;

  await fs.promises.mkdir(backupsDir, { recursive: true });
  while (fs.existsSync(backupPath)) {
    backupPath = path.join(backupsDir, `${stem}-${timestamp}-${collisionIndex}${extension}`);
    collisionIndex += 1;
  }
  await fs.promises.copyFile(filePath, backupPath);
  await enforceBackupRetention(stem, extension);

  return backupPath;
}

export async function removeFileIfExists(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    return;
  }

  await fs.promises.rm(filePath, { force: true });
}

export async function restoreFromBackupOrRemove(filePath: string, backupPath: string | null): Promise<void> {
  if (backupPath) {
    const backupContent = await fs.promises.readFile(backupPath);
    await writeFileAtomic(filePath, backupContent);
    return;
  }

  await removeFileIfExists(filePath);
}

export async function writeFileAtomic(filePath: string, content: string | Uint8Array): Promise<void> {
  await ensureParentDir(filePath);

  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  await fs.promises.writeFile(tempPath, content);

  try {
    if (process.platform === "win32" && fs.existsSync(filePath)) {
      await fs.promises.rm(filePath, { force: true });
    }

    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function getBackupTarget(client: SupportedClient): BackupTarget {
  return BACKUP_TARGETS[client]();
}

export function getAllBackupTargets(): BackupTarget[] {
  return (Object.keys(BACKUP_TARGETS) as SupportedClient[]).map((client) => getBackupTarget(client));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBackupEntry(fileName: string): BackupEntry | null {
  for (const target of getAllBackupTargets()) {
    const pattern = new RegExp(`^${escapeRegex(target.stem)}-(${TIMESTAMP_PATTERN})(?:-\\d+)?${escapeRegex(target.extension)}$`);
    const match = fileName.match(pattern);

    if (match) {
      return {
        client: target.client,
        filePath: target.filePath,
        backupPath: path.join(getBackupsDir(), fileName),
        backupFileName: fileName,
        timestamp: match[1] ?? "",
      };
    }
  }

  return null;
}

function sortBackupsDescending(left: BackupEntry, right: BackupEntry): number {
  return right.backupFileName.localeCompare(left.backupFileName);
}

export async function listBackups(client?: SupportedClient): Promise<BackupEntry[]> {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  const entries = await fs.promises.readdir(backupsDir);
  return entries
    .map((entry) => parseBackupEntry(entry))
    .filter((entry): entry is BackupEntry => entry !== null)
    .filter((entry) => !client || entry.client === client)
    .sort(sortBackupsDescending);
}

export async function getLatestBackup(client: SupportedClient): Promise<BackupEntry | null> {
  const backups = await listBackups(client);
  return backups[0] ?? null;
}

export function resolveBackupSelection(selection: string): BackupEntry {
  const backupsDir = getBackupsDir();
  const candidatePath = path.isAbsolute(selection) ? selection : path.join(backupsDir, selection);

  if (!fs.existsSync(candidatePath)) {
    throw new Error(`Backup not found: ${selection}`);
  }

  const parsedEntry = parseBackupEntry(path.basename(candidatePath));
  if (!parsedEntry) {
    throw new Error(`Unsupported backup file: ${candidatePath}`);
  }

  return {
    ...parsedEntry,
    backupPath: candidatePath,
  };
}
