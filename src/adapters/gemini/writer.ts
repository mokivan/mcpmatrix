import fs from "fs";
import type { ResolvedServer } from "../../types";
import { createBackupIfExists, writeFileAtomic } from "../../utils/backup";
import { getGeminiConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";

export type GeminiConfig = Record<string, unknown> & {
  mcpServers?: Record<
    string,
    {
      command: string;
      args: string[];
      env: Record<string, string>;
    }
  >;
};

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

export function renderGeminiConfig(existingConfig: GeminiConfig, servers: ResolvedServer[]): GeminiConfig {
  return {
    ...existingConfig,
    mcpServers: Object.fromEntries(
      servers.map((server) => [
        server.name,
        {
          command: server.command,
          args: server.args,
          env: server.env,
        },
      ]),
    ),
  };
}

export async function writeGeminiConfig(
  servers: ResolvedServer[],
  filePath = getGeminiConfigPath(),
): Promise<string | null> {
  const existingConfig = await readGeminiConfig(filePath);
  const nextConfig = renderGeminiConfig(existingConfig, servers);

  const backupPath = await createBackupIfExists(filePath);
  await writeFileAtomic(filePath, `${JSON.stringify(nextConfig, null, 2)}\n`);

  return backupPath;
}
