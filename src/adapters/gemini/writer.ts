import fs from "fs";
import type { ResolvedServer } from "../../types";
import { getGeminiConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";
import { mergeManagedEntries } from "../../core/managed-state";
import { getClientCompatibility, translateEnvReferences } from "../../core/server-config";

export type GeminiConfig = Record<string, unknown> & {
  mcpServers?: Record<
    string,
    | {
        command: string;
        args: string[];
        env: Record<string, string>;
      }
    | {
        httpUrl: string;
      }
  >;
};

function assertGeminiSupported(server: ResolvedServer): void {
  const compatibility = getClientCompatibility(server).gemini;
  if (!compatibility.supported) {
    throw new Error(`Gemini cannot represent server '${server.name}': ${compatibility.reason}`);
  }
}

function toGeminiServer(server: ResolvedServer): { command: string; args: string[]; env: Record<string, string> } | { httpUrl: string } {
  assertGeminiSupported(server);

  if (server.transport === "stdio") {
    return {
      command: server.command,
      args: server.args ?? [],
      // Gemini CLI expands $VAR / ${VAR} in the env block.
      env: Object.fromEntries(
        Object.entries(server.env ?? {}).map(([key, value]) => [key, translateEnvReferences(value, (name) => `\${${name}}`)]),
      ),
    };
  }

  return {
    httpUrl: server.url,
  };
}

export async function readGeminiConfig(filePath = getGeminiConfigPath()): Promise<GeminiConfig> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const rawContent = await readTextFile(filePath);

  try {
    return JSON.parse(rawContent) as GeminiConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in Gemini config ${filePath}: ${message}`);
  }
}

export function renderGeminiConfig(
  existingConfig: GeminiConfig,
  servers: ResolvedServer[],
  previouslyManaged: string[] = [],
): GeminiConfig {
  return {
    ...existingConfig,
    mcpServers: mergeManagedEntries(
      existingConfig.mcpServers,
      Object.fromEntries(servers.map((server) => [server.name, toGeminiServer(server)])),
      previouslyManaged,
    ),
  };
}
