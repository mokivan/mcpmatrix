import fs from "fs";
import path from "path";
import type { BackupEntry, ConfigScope, SupportedClient } from "../types";
import { getBackupsDir, getClaudeConfigPath, getCodexConfigPath, getGeminiConfigPath, normalizeRepoPath } from "./paths";

type BackupTarget = {
  client: SupportedClient;
  scope: ConfigScope;
  filePath: string;
  extension: string;
  repoPath?: string;
};

type BackupMetadata = {
  client: SupportedClient;
  scope: ConfigScope;
  filePath: string;
  timestamp: string;
  repoPath?: string;
};

type BackupQuery = {
  client?: SupportedClient;
  scope?: ConfigScope;
  repoPath?: string;
};

const LEGACY_TARGETS: Record<SupportedClient, { filePath: string; stem: string; extension: string }> = {
  codex: {
    filePath: getCodexConfigPath(),
    stem: "config",
    extension: ".toml",
  },
  claude: {
    filePath: getClaudeConfigPath(),
    stem: "claude",
    extension: ".json",
  },
  gemini: {
    filePath: getGeminiConfigPath(),
    stem: "settings",
    extension: ".json",
  },
};

const TIMESTAMP_PATTERN = "\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}";

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

function getBackupMetaPath(backupPath: string): string {
  return `${backupPath}.meta.json`;
}

function createTimestamp(date = new Date()): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}-${minute}`;
}

function getBackupExtension(filePath: string): string {
  return path.parse(filePath).ext || ".bak";
}

function getGlobalBackupTarget(client: SupportedClient): BackupTarget {
  const legacyTarget = LEGACY_TARGETS[client];
  return {
    client,
    scope: "global",
    filePath: legacyTarget.filePath,
    extension: legacyTarget.extension,
  };
}

function inferLegacyClientFromFilePath(filePath: string): SupportedClient | null {
  const normalizedPath = normalizeRepoPath(filePath);

  for (const [client, target] of Object.entries(LEGACY_TARGETS) as Array<[SupportedClient, { filePath: string }]>) {
    if (normalizeRepoPath(target.filePath) === normalizedPath) {
      return client;
    }
  }

  const baseName = path.basename(filePath).toLowerCase();
  if (baseName === "config.toml") {
    return "codex";
  }
  if (baseName === ".claude.json" || baseName === "claude.json") {
    return "claude";
  }
  if (baseName === "settings.json") {
    return "gemini";
  }

  return null;
}

function resolveBackupTarget(
  filePath: string,
  target?: { client: SupportedClient; scope: ConfigScope; repoPath?: string },
): BackupTarget {
  if (target) {
    return {
      client: target.client,
      scope: target.scope,
      filePath,
      extension: getBackupExtension(filePath),
      ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
    };
  }

  const inferredClient = inferLegacyClientFromFilePath(filePath);
  if (!inferredClient) {
    throw new Error(`Unable to infer backup target for ${filePath}`);
  }

  return {
    client: inferredClient,
    scope: "global",
    filePath,
    extension: getBackupExtension(filePath),
  };
}

async function writeBackupMetadata(backupPath: string, target: BackupTarget, timestamp: string): Promise<void> {
  const metadata: BackupMetadata = {
    client: target.client,
    scope: target.scope,
    filePath: target.filePath,
    timestamp,
    ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
  };

  await fs.promises.writeFile(getBackupMetaPath(backupPath), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

function getLegacyBackupEntry(fileName: string): BackupEntry | null {
  for (const [client, target] of Object.entries(LEGACY_TARGETS) as Array<
    [SupportedClient, { filePath: string; stem: string; extension: string }]
  >) {
    const pattern = new RegExp(
      `^${target.stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(${TIMESTAMP_PATTERN})(?:-\\d+)?${target.extension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    );
    const match = fileName.match(pattern);

    if (match) {
      return {
        client,
        scope: "global",
        filePath: target.filePath,
        backupPath: path.join(getBackupsDir(), fileName),
        backupFileName: fileName,
        timestamp: match[1] ?? "",
      };
    }
  }

  return null;
}

async function getBackupEntry(backupPath: string): Promise<BackupEntry | null> {
  const metaPath = getBackupMetaPath(backupPath);

  if (fs.existsSync(metaPath)) {
    const metadata = JSON.parse(await fs.promises.readFile(metaPath, "utf8")) as BackupMetadata;
    return {
      client: metadata.client,
      scope: metadata.scope,
      filePath: metadata.filePath,
      backupPath,
      backupFileName: path.basename(backupPath),
      timestamp: metadata.timestamp,
      ...(metadata.repoPath === undefined ? {} : { repoPath: metadata.repoPath }),
    };
  }

  return getLegacyBackupEntry(path.basename(backupPath));
}

function matchesBackupQuery(entry: BackupEntry, query?: BackupQuery): boolean {
  if (query?.client && entry.client !== query.client) {
    return false;
  }

  if (query?.scope && entry.scope !== query.scope) {
    return false;
  }

  if (query?.repoPath) {
    return entry.repoPath !== undefined && normalizeRepoPath(entry.repoPath) === normalizeRepoPath(query.repoPath);
  }

  return true;
}

function sortBackupsDescending(left: BackupEntry, right: BackupEntry): number {
  return right.backupFileName.localeCompare(left.backupFileName);
}

async function enforceBackupRetention(target: BackupTarget): Promise<void> {
  const backups = await listBackups({
    client: target.client,
    scope: target.scope,
    ...(target.repoPath === undefined ? {} : { repoPath: target.repoPath }),
  });

  for (const staleBackup of backups.slice(3)) {
    await fs.promises.rm(staleBackup.backupPath, { force: true });
    await fs.promises.rm(getBackupMetaPath(staleBackup.backupPath), { force: true });
  }
}

export async function createBackupIfExists(
  filePath: string,
  target?: { client: SupportedClient; scope: ConfigScope; repoPath?: string },
): Promise<string | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const backupsDir = getBackupsDir();
  const resolvedTarget = resolveBackupTarget(filePath, target);
  const timestamp = createTimestamp();
  let backupFileName = `${resolvedTarget.client}-${resolvedTarget.scope}-${timestamp}${resolvedTarget.extension}`;
  let backupPath = path.join(backupsDir, backupFileName);
  let collisionIndex = 1;

  await fs.promises.mkdir(backupsDir, { recursive: true });

  while (fs.existsSync(backupPath)) {
    backupFileName = `${resolvedTarget.client}-${resolvedTarget.scope}-${timestamp}-${collisionIndex}${resolvedTarget.extension}`;
    backupPath = path.join(backupsDir, backupFileName);
    collisionIndex += 1;
  }

  await fs.promises.copyFile(filePath, backupPath);
  await writeBackupMetadata(backupPath, resolvedTarget, timestamp);
  await enforceBackupRetention(resolvedTarget);

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
  return getGlobalBackupTarget(client);
}

export function getAllBackupTargets(): BackupTarget[] {
  return (Object.keys(LEGACY_TARGETS) as SupportedClient[]).map((client) => getGlobalBackupTarget(client));
}

export async function listBackups(query?: BackupQuery): Promise<BackupEntry[]> {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  const entries = await fs.promises.readdir(backupsDir);
  const backupEntries = await Promise.all(
    entries
      .filter((entry) => !entry.endsWith(".meta.json"))
      .map((entry) => getBackupEntry(path.join(backupsDir, entry))),
  );

  return backupEntries
    .filter((entry): entry is BackupEntry => entry !== null)
    .filter((entry) => matchesBackupQuery(entry, query))
    .sort(sortBackupsDescending);
}

export async function getLatestBackup(query: { client: SupportedClient; scope?: ConfigScope; repoPath?: string }): Promise<BackupEntry | null> {
  const backups = await listBackups(query);
  return backups[0] ?? null;
}

export async function resolveBackupSelection(selection: string): Promise<BackupEntry> {
  const backupsDir = getBackupsDir();
  const candidatePath = path.isAbsolute(selection) ? selection : path.join(backupsDir, selection);

  if (!fs.existsSync(candidatePath)) {
    throw new Error(`Backup not found: ${selection}`);
  }

  const parsedEntry = await getBackupEntry(candidatePath);
  if (!parsedEntry) {
    throw new Error(`Unsupported backup file: ${candidatePath}`);
  }

  return {
    ...parsedEntry,
    backupPath: candidatePath,
  };
}
