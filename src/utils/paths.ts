import os from "os";
import path from "path";
import { pathToFileURL } from "url";

export function getHomeDir(): string {
  return os.homedir();
}

export function getMcpMatrixDir(): string {
  return path.join(getHomeDir(), ".mcpmatrix");
}

export function getGlobalConfigPath(): string {
  return path.join(getMcpMatrixDir(), "config.yml");
}

export function getConfigSchemaPath(): string {
  return path.resolve(__dirname, "..", "..", "schemas", "mcpmatrix-config.schema.json");
}

export function getConfigSchemaUri(): string {
  return pathToFileURL(getConfigSchemaPath()).href;
}

export function getBackupsDir(): string {
  return path.join(getMcpMatrixDir(), "backups");
}

export function getCodexConfigPath(): string {
  return path.join(getHomeDir(), ".codex", "config.toml");
}

export function getRepoCodexConfigPath(repoPath: string): string {
  return path.join(repoPath, ".codex", "config.toml");
}

export function getClaudeConfigPath(): string {
  return path.join(getHomeDir(), ".claude.json");
}

export function getRepoClaudeConfigPath(repoPath: string): string {
  return path.join(repoPath, ".mcp.json");
}

export function getGeminiConfigPath(): string {
  return path.join(getHomeDir(), ".gemini", "settings.json");
}

export function getRepoGeminiConfigPath(repoPath: string): string {
  return path.join(repoPath, ".gemini", "settings.json");
}

export function getCopilotCliConfigPath(): string {
  return path.join(getHomeDir(), ".copilot", "mcp-config.json");
}

export function getRepoCopilotCliConfigPath(repoPath: string): string {
  return path.join(repoPath, ".github", "mcp.json");
}

function getVsCodeUserDir(): string {
  if (process.platform === "win32") {
    const appDataDir = process.env.APPDATA ?? path.join(getHomeDir(), "AppData", "Roaming");
    return path.join(appDataDir, "Code", "User");
  }

  if (process.platform === "darwin") {
    return path.join(getHomeDir(), "Library", "Application Support", "Code", "User");
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? path.join(getHomeDir(), ".config");
  return path.join(xdgConfigHome, "Code", "User");
}

export function getCopilotVsCodeConfigPath(): string {
  return path.join(getVsCodeUserDir(), "mcp.json");
}

export function getRepoCopilotVsCodeConfigPath(repoPath: string): string {
  return path.join(repoPath, ".vscode", "mcp.json");
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
