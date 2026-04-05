import fs from "fs";
import path from "path";
import { getBackupsDir } from "./paths";

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
    await ensureParentDir(filePath);
    await fs.promises.copyFile(backupPath, filePath);
    return;
  }

  await removeFileIfExists(filePath);
}

export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await ensureParentDir(filePath);

  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  await fs.promises.writeFile(tempPath, content, "utf8");

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
