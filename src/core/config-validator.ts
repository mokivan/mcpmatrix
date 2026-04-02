import fs from "fs";
import path from "path";
import type { McpMatrixConfig } from "../types";

function hasPathSeparator(command: string): boolean {
  return command.includes("/") || command.includes("\\");
}

function isExecutableFile(candidatePath: string): boolean {
  if (!fs.existsSync(candidatePath)) {
    return false;
  }

  const stat = fs.statSync(candidatePath);
  return stat.isFile();
}

function hasExecutePermission(candidatePath: string): boolean {
  try {
    fs.accessSync(candidatePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hasWindowsExecutableExtension(candidatePath: string): boolean {
  const pathext = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  const extension = path.extname(candidatePath).toLowerCase();

  return pathext.includes(extension);
}

function resolveCommandFromPath(command: string, pathValue = process.env.PATH ?? ""): string | null {
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ".com", ""] : [""];
  const directories = pathValue.split(path.delimiter).filter((entry) => entry.length > 0);

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${command}${extension}`);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function commandExists(command: string): boolean {
  if (hasPathSeparator(command) || path.isAbsolute(command)) {
    const resolvedPath = path.resolve(command);

    if (!isExecutableFile(resolvedPath)) {
      return false;
    }

    if (process.platform === "win32") {
      return hasWindowsExecutableExtension(resolvedPath);
    }

    return hasExecutePermission(resolvedPath);
  }

  return resolveCommandFromPath(command) !== null;
}

export function validateExecutableCommands(config: McpMatrixConfig): void {
  for (const [serverName, server] of Object.entries(config.servers)) {
    if (!commandExists(server.command)) {
      throw new Error(`Command not found for servers.${serverName}.command: ${server.command}`);
    }
  }
}
