import fs from "fs";
import type { RemoteAuth, ResolvedServer } from "../../types";

// Claude Code expands ${VAR}, not ${env:VAR}.
function toClaudeValue(value: string): string {
  return translateEnvReferences(value, (name) => `\${${name}}`);
}

function mapRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toClaudeValue(value)]));
}

function toClaudeOAuth(auth: RemoteAuth | undefined): ClaudeOAuth | undefined {
  if (auth?.type !== "oauth") {
    return undefined;
  }

  return {
    ...(auth.clientId === undefined ? {} : { clientId: auth.clientId }),
    ...(auth.callbackPort === undefined ? {} : { callbackPort: auth.callbackPort }),
    ...(auth.metadataUrl === undefined ? {} : { authServerMetadataUrl: auth.metadataUrl }),
  };
}
import { getClaudeConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";
import { mergeManagedEntries } from "../../core/managed-state";
import { getClientCompatibility, translateEnvReferences } from "../../core/server-config";

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
  oauth?: ClaudeOAuth;
};

type ClaudeOAuth = {
  clientId?: string;
  callbackPort?: number;
  authServerMetadataUrl?: string;
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
      command: toClaudeValue(server.command),
      args: (server.args ?? []).map(toClaudeValue),
      env: mapRecord(server.env ?? {}),
    };
  }

  const headers = { ...mapRecord(server.headers ?? {}) };
  if (server.auth?.type === "bearer" && !Object.keys(headers).some((name) => name.toLowerCase() === "authorization")) {
    headers.Authorization = `Bearer ${toClaudeValue(server.auth.token)}`;
  }

  const oauth = toClaudeOAuth(server.auth);

  return {
    type: server.protocol === "sse" ? "sse" : "http",
    url: toClaudeValue(server.url),
    ...(Object.keys(headers).length === 0 ? {} : { headers }),
    ...(oauth === undefined ? {} : { oauth }),
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

export function renderClaudeConfig(
  existingConfig: ClaudeConfig,
  servers: ResolvedServer[],
  previouslyManaged: string[] = [],
): ClaudeConfig {
  return {
    ...existingConfig,
    mcpServers: mergeManagedEntries(
      existingConfig.mcpServers,
      Object.fromEntries(servers.map((server) => [server.name, toClaudeServer(server)])),
      previouslyManaged,
    ),
  };
}
