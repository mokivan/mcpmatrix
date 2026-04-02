import fs from "fs";
import { ResolvedServer } from "../../types";
import { createBackupIfExists, ensureParentDir } from "../../utils/backup";
import { getClaudeConfigPath } from "../../utils/paths";

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

  const rawContent = await fs.promises.readFile(filePath, "utf8");

  return JSON.parse(rawContent) as ClaudeConfig;
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

  await ensureParentDir(filePath);
  const backupPath = await createBackupIfExists(filePath);
  await fs.promises.writeFile(filePath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");

  return backupPath;
}
