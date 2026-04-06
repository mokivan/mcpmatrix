import fs from "fs";
import type { ResolvedServer } from "../../types";
import { createBackupIfExists, writeFileAtomic } from "../../utils/backup";
import { getCopilotCliConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";
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

export function renderCopilotCliConfig(existingConfig: CopilotCliConfig, servers: ResolvedServer[]): CopilotCliConfig {
  return {
    ...existingConfig,
    mcpServers: Object.fromEntries(servers.map((server) => [server.name, toCopilotCliServer(server)])),
  };
}

export async function writeCopilotCliConfig(
  servers: ResolvedServer[],
  filePath = getCopilotCliConfigPath(),
): Promise<string | null> {
  const existingConfig = await readCopilotCliConfig(filePath);
  const nextConfig = renderCopilotCliConfig(existingConfig, servers);

  const backupPath = await createBackupIfExists(filePath);
  await writeFileAtomic(filePath, `${JSON.stringify(nextConfig, null, 2)}\n`);

  return backupPath;
}
