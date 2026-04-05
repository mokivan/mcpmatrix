import fs from "fs";
import type { ResolvedServer } from "../../types";
import { createBackupIfExists, writeFileAtomic } from "../../utils/backup";
import { getClaudeConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";

type ClaudeConfig = Record<string, unknown> & {
  mcpServers?: Record<
    string,
    {
      command: string;
      args: string[];
      env: Record<string, string>;
    }
  >;
};

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

export async function writeClaudeConfig(servers: ResolvedServer[], filePath = getClaudeConfigPath()): Promise<string | null> {
  const existingConfig = await readClaudeConfig(filePath);
  const nextConfig = renderClaudeConfig(existingConfig, servers);

  const backupPath = await createBackupIfExists(filePath);
  await writeFileAtomic(filePath, `${JSON.stringify(nextConfig, null, 2)}\n`);

  return backupPath;
}
