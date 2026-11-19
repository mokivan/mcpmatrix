import fs from "fs";
import type { ResolvedServer } from "../../types";
import { getCopilotCliConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";
import { mergeManagedEntries } from "../../core/managed-state";
import { getClientCompatibility } from "../../core/server-config";

type CopilotCliStdioServer = {
  type: "local";
  command: string;
  args: string[];
  env: Record<string, string>;
  tools: string[];
};

type CopilotCliRemoteServer = {
  type: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
  tools: string[];
};

export type CopilotCliConfig = Record<string, unknown> & {
  mcpServers?: Record<string, CopilotCliStdioServer | CopilotCliRemoteServer>;
};

function assertCopilotCliSupported(server: ResolvedServer): void {
  const compatibility = getClientCompatibility(server)["copilot-cli"];
  if (!compatibility.supported) {
    throw new Error(`Copilot CLI cannot represent server '${server.name}': ${compatibility.reason}`);
  }
}

function toCopilotCliServer(server: ResolvedServer): CopilotCliStdioServer | CopilotCliRemoteServer {
  assertCopilotCliSupported(server);

  if (server.transport === "stdio") {
    return {
      type: "local",
      command: server.command,
      args: server.args ?? [],
      env: server.env ?? {},
      tools: ["*"],
    };
  }

  const headers = Object.keys(server.headers ?? {}).length > 0 ? server.headers : undefined;
  return {
    type: server.protocol === "sse" ? "sse" : "http",
    url: server.url,
    ...(headers === undefined ? {} : { headers }),
    tools: ["*"],
  };
}

export async function readCopilotCliConfig(filePath = getCopilotCliConfigPath()): Promise<CopilotCliConfig> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const rawContent = await readTextFile(filePath);

  try {
    return JSON.parse(rawContent) as CopilotCliConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in Copilot CLI config ${filePath}: ${message}`);
  }
}

export function renderCopilotCliConfig(
  existingConfig: CopilotCliConfig,
  servers: ResolvedServer[],
  previouslyManaged: string[] = [],
): CopilotCliConfig {
  return {
    ...existingConfig,
    mcpServers: mergeManagedEntries(
      existingConfig.mcpServers,
      Object.fromEntries(servers.map((server) => [server.name, toCopilotCliServer(server)])),
      previouslyManaged,
    ),
  };
}
