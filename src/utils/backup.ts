import fs from "fs";
import path from "path";

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

export async function createBackupIfExists(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const backupPath = `${filePath}.bak`;

  await fs.promises.copyFile(filePath, backupPath);

  return backupPath;
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
