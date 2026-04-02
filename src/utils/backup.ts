import fs from "fs";
import path from "path";

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

export async function createBackupIfExists(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const parsedPath = path.parse(filePath);
  const backupPath = path.join(parsedPath.dir, `${parsedPath.name}.bak${parsedPath.ext}`);

  await fs.promises.copyFile(filePath, backupPath);

  return backupPath;
}
