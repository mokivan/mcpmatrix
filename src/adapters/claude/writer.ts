import fs from "fs";
import type { RemoteAuth, ResolvedServer } from "../../types";
import { createBackupIfExists, writeFileAtomic } from "../../utils/backup";
import { getClaudeConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";
import { getClientCompatibility } from "../../core/server-config";

type ClaudeStdioServer = {
  type?: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
};

type ClaudeRemoteServer = {
  type: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
  auth?: RemoteAuth;
};

export type ClaudeConfig = Record<string, unknown> & {
  mcpServers?: Record<string, ClaudeStdioServer | ClaudeRemoteServer>;
};

function assertClaudeSupported(server: ResolvedServer): void {
  const compatibility = getClientCompatibility(server).claude;
  if (!compatibility.supported) {
    throw new Error(`Claude cannot represent server '${server.name}': ${compatibility.reason}`);
  }
}

function toClaudeServer(server: ResolvedServer): ClaudeStdioServer | ClaudeRemoteServer {
  assertClaudeSupported(server);

  if (server.transport === "stdio") {
    return {
      type: "stdio",
      command: server.command,
      args: server.args ?? [],
      env: server.env ?? {},
    };
  }

  const headers = Object.keys(server.headers ?? {}).length > 0 ? server.headers : undefined;
  const auth = server.auth?.type === "none" ? undefined : server.auth;

  return {
    type: server.protocol === "sse" ? "sse" : "http",
    url: server.url,
    ...(headers === undefined ? {} : { headers }),
    ...(auth === undefined ? {} : { auth }),
  };
}

export async function readClaudeConfig(filePath = getClaudeConfigPath()): Promise<ClaudeConfig> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const rawContent = await readTextFile(filePath);

  try {
    return JSON.parse(rawContent) as ClaudeConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in Claude config ${filePath}: ${message}`);
  }
}

export function renderClaudeConfig(existingConfig: ClaudeConfig, servers: ResolvedServer[]): ClaudeConfig {
  return {
    ...existingConfig,
    mcpServers: Object.fromEntries(servers.map((server) => [server.name, toClaudeServer(server)])),
  };
}

export async function writeClaudeConfig(servers: ResolvedServer[], filePath = getClaudeConfigPath()): Promise<string | null> {
  const existingConfig = await readClaudeConfig(filePath);
  const nextConfig = renderClaudeConfig(existingConfig, servers);

  const backupPath = await createBackupIfExists(filePath);
  await writeFileAtomic(filePath, `${JSON.stringify(nextConfig, null, 2)}\n`);

  return backupPath;
}
