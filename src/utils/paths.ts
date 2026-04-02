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

function isWindowsStyleAbsolutePath(inputPath: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(inputPath) || /^\\\\/.test(inputPath);
}

function isPosixStyleAbsolutePath(inputPath: string): boolean {
  return inputPath.startsWith("/");
}

export function normalizeRepoPath(inputPath: string): string {
  if (isWindowsStyleAbsolutePath(inputPath)) {
    return path.win32.normalize(inputPath).toLowerCase();
  }

  if (isPosixStyleAbsolutePath(inputPath)) {
    return path.posix.normalize(inputPath.replace(/\\/g, "/"));
  }

  return normalizeRepoPath(path.resolve(inputPath));
}
