import os from "os";
import path from "path";

export function getHomeDir(): string {
  return os.homedir();
}

export function getMcpMatrixDir(): string {
  return path.join(getHomeDir(), ".mcpmatrix");
}

export function getGlobalConfigPath(): string {
  return path.join(getMcpMatrixDir(), "config.yml");
}

export function getCodexConfigPath(): string {
  return path.join(getHomeDir(), ".codex", "config.toml");
}

export function getClaudeConfigPath(): string {
  return path.join(getHomeDir(), ".claude.json");
}

export function normalizeRepoPath(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  const normalized = path.normalize(resolved);

  if (process.platform === "win32") {
    return normalized.toLowerCase();
  }

  return normalized;
}
