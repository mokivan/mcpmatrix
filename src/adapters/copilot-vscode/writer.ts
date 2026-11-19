import fs from "fs";
import type { ResolvedServer } from "../../types";
import { getCopilotVsCodeConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";
import { mergeManagedEntries } from "../../core/managed-state";
import { getClientCompatibility } from "../../core/server-config";

type CopilotVsCodeStdioServer = {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

type CopilotVsCodeRemoteServer = {
  type: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
};

export type CopilotVsCodeConfig = Record<string, unknown> & {
  servers?: Record<string, CopilotVsCodeStdioServer | CopilotVsCodeRemoteServer>;
};

function assertCopilotVsCodeSupported(server: ResolvedServer): void {
  const compatibility = getClientCompatibility(server)["copilot-vscode"];
  if (!compatibility.supported) {
    throw new Error(`Copilot VS Code cannot represent server '${server.name}': ${compatibility.reason}`);
  }
}

function toCopilotVsCodeServer(server: ResolvedServer): CopilotVsCodeStdioServer | CopilotVsCodeRemoteServer {
  assertCopilotVsCodeSupported(server);

  if (server.transport === "stdio") {
    const args = server.args ?? [];
    const env = server.env ?? {};
    return {
      type: "stdio",
      command: server.command,
      ...(args.length === 0 ? {} : { args }),
      ...(Object.keys(env).length === 0 ? {} : { env }),
    };
  }

  const headers = Object.keys(server.headers ?? {}).length > 0 ? server.headers : undefined;
  return {
    type: server.protocol === "sse" ? "sse" : "http",
    url: server.url,
    ...(headers === undefined ? {} : { headers }),
  };
}

export async function readCopilotVsCodeConfig(filePath = getCopilotVsCodeConfigPath()): Promise<CopilotVsCodeConfig> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const rawContent = await readTextFile(filePath);

  try {
    return JSON.parse(rawContent) as CopilotVsCodeConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in Copilot VS Code config ${filePath}: ${message}`);
  }
}

export function renderCopilotVsCodeConfig(
  existingConfig: CopilotVsCodeConfig,
  servers: ResolvedServer[],
  previouslyManaged: string[] = [],
): CopilotVsCodeConfig {
  return {
    ...existingConfig,
    servers: mergeManagedEntries(
      existingConfig.servers,
      Object.fromEntries(servers.map((server) => [server.name, toCopilotVsCodeServer(server)])),
      previouslyManaged,
    ),
  };
}
