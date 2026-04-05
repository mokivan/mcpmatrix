import fs from "fs";
import path from "path";
import type {
  McpMatrixConfig,
  RemoteServerDefinition,
  ServerDefinition,
  ServerDoctorCheck,
  ServerTransportValidation,
} from "../types";
import { extractEnvReferences, getClientCompatibility, getServerStringValues } from "./server-config";

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

export function hasWindowsExecutableExtension(candidatePath: string): boolean {
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

export function getStdioValidation(command: string): ServerTransportValidation {
  const resolvedPath = resolveCommand(command);

  return {
    transport: "stdio",
    command,
    exists: resolvedPath !== null,
    resolvedPath,
  };
}

function getRemoteValidation(server: RemoteServerDefinition): ServerTransportValidation {
  const issues: string[] = [];

  try {
    const parsedUrl = new URL(server.url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      issues.push(`unsupported URL protocol '${parsedUrl.protocol}'`);
    }
  } catch {
    issues.push("invalid URL");
  }

  if (server.auth?.type === "oauth" && server.auth.callbackPort !== undefined && server.auth.callbackPort <= 0) {
    issues.push("oauth callbackPort must be a positive integer");
  }

  return {
    transport: "remote",
    url: server.url,
    protocol: server.protocol,
    valid: issues.length === 0,
    issues,
  };
}

export function getMissingEnvVars(server: ServerDefinition): string[] {
  const missingVars = new Set<string>();

  for (const value of getServerStringValues(server)) {
    for (const envVarName of extractEnvReferences(value)) {
      if (!process.env[envVarName]) {
        missingVars.add(envVarName);
      }
    }
  }

  return [...missingVars];
}

export function getServerDoctorChecks(config: McpMatrixConfig): ServerDoctorCheck[] {
  return Object.entries(config.servers).map(([serverName, server]) => ({
    serverName,
    transport: server.transport,
    runtime: server.transport === "stdio" ? getStdioValidation(server.command) : getRemoteValidation(server),
    missingEnvVars: getMissingEnvVars(server),
    compatibility: getClientCompatibility(server),
  }));
}

export function validateServerDefinitions(config: McpMatrixConfig): void {
  for (const check of getServerDoctorChecks(config)) {
    if (check.runtime.transport === "stdio" && !check.runtime.exists) {
      throw new Error(`Command not found for servers.${check.serverName}.command: ${check.runtime.command}`);
    }

    if (check.runtime.transport === "remote" && !check.runtime.valid) {
      throw new Error(`Invalid remote server servers.${check.serverName}.url: ${check.runtime.issues.join(", ")}`);
    }
  }
}
