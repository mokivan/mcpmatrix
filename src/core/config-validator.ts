import fs from "fs";
import path from "path";
import type { CommandValidationResult, McpMatrixConfig, ServerDefinition, ServerDoctorCheck } from "../types";

const ENV_REFERENCE_PATTERN = /^\$\{env:([A-Z0-9_]+)\}$/;

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

export function resolveCommand(command: string): string | null {
  if (hasPathSeparator(command) || path.isAbsolute(command)) {
    const resolvedPath = path.resolve(command);

    if (!isExecutableFile(resolvedPath)) {
      return null;
    }

    if (process.platform === "win32") {
      return hasWindowsExecutableExtension(resolvedPath) ? resolvedPath : null;
    }

    return hasExecutePermission(resolvedPath) ? resolvedPath : null;
  }

  return resolveCommandFromPath(command);
}

export function commandExists(command: string): boolean {
  return resolveCommand(command) !== null;
}

export function getCommandValidation(command: string): CommandValidationResult {
  const resolvedPath = resolveCommand(command);

  return {
    command,
    exists: resolvedPath !== null,
    resolvedPath,
  };
}

export function getReferencedEnvVar(value: string): string | null {
  const match = value.match(ENV_REFERENCE_PATTERN);
  return match?.[1] ?? null;
}

export function getMissingEnvVars(server: ServerDefinition): string[] {
  const missingVars = new Set<string>();

  for (const envValue of Object.values(server.env ?? {})) {
    const envVarName = getReferencedEnvVar(envValue);
    if (envVarName && !process.env[envVarName]) {
      missingVars.add(envVarName);
    }
  }

  return [...missingVars];
}

export function getServerDoctorChecks(config: McpMatrixConfig): ServerDoctorCheck[] {
  return Object.entries(config.servers).map(([serverName, server]) => ({
    serverName,
    command: getCommandValidation(server.command),
    missingEnvVars: getMissingEnvVars(server),
  }));
}

export function validateExecutableCommands(config: McpMatrixConfig): void {
  for (const check of getServerDoctorChecks(config)) {
    if (!check.command.exists) {
      throw new Error(`Command not found for servers.${check.serverName}.command: ${check.command.command}`);
    }
  }
}
