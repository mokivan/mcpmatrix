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
    return isExecutableFile(path.resolve(command));
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
