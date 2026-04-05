import fs from "fs";
import path from "path";
import TOML from "toml";
import YAML from "yaml";
import type { ImportedConfigResult, McpMatrixConfig, ServerDefinition, SupportedClient } from "../types";
import { writeFileAtomic } from "../utils/backup";
import {
  getClaudeConfigPath,
  getCodexConfigPath,
  getGeminiConfigPath,
  getGlobalConfigPath,
} from "../utils/paths";
import { readClaudeConfig } from "../adapters/claude/writer";
import { readGeminiConfig } from "../adapters/gemini/writer";

type ImportedServerEntry = {
  definition: ServerDefinition;
  client: SupportedClient;
  filePath: string;
};

type CodexTomlServer = {
  name?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
};

type CodexTomlConfig = {
  mcp_servers?: CodexTomlServer[] | Record<string, CodexTomlServer>;
};

function normalizeServerDefinition(server: ServerDefinition): string {
  const env = Object.fromEntries(Object.entries(server.env ?? {}).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)));

  return JSON.stringify({
    command: server.command,
    args: server.args ?? [],
    env,
  });
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid imported ${fieldName}: expected non-empty string`);
  }

  return value;
}

function parseArgs(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Invalid imported ${fieldName}: expected string[]`);
  }

  return value as string[];
}

function parseEnv(value: unknown, fieldName: string): Record<string, string> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid imported ${fieldName}: expected object`);
  }

  return Object.fromEntries(
    Object.entries(value).map(
      ([envName, envValue]): [string, string] => [envName, assertString(envValue, `${fieldName}.${envName}`)],
    ),
  );
}

function mergeImportedServer(
  importedServers: Map<string, ImportedServerEntry>,
  serverName: string,
  definition: ServerDefinition,
  client: SupportedClient,
  filePath: string,
): void {
  const existingEntry = importedServers.get(serverName);
  if (!existingEntry) {
    importedServers.set(serverName, { definition, client, filePath });
    return;
  }

  if (normalizeServerDefinition(existingEntry.definition) !== normalizeServerDefinition(definition)) {
    throw new Error(
      `Conflicting definitions for imported server '${serverName}' between ${existingEntry.client} (${existingEntry.filePath}) and ${client} (${filePath})`,
    );
  }
}

async function importCodexServers(filePath: string): Promise<Record<string, ServerDefinition>> {
  const rawContent = await fs.promises.readFile(filePath, "utf8");
  let parsed: CodexTomlConfig;

  try {
    parsed = TOML.parse(rawContent) as CodexTomlConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid TOML in Codex config ${filePath}: ${message}`);
  }

  const servers = parsed.mcp_servers;
  if (servers === undefined) {
    return {};
  }

  if (Array.isArray(servers)) {
    return Object.fromEntries(
      servers.map((server, index) => {
        const name = assertString(server.name, `codex.mcp_servers[${index}].name`);

        return [
          name,
          {
            command: assertString(server.command, `codex.mcp_servers[${index}].command`),
            args: parseArgs(server.args, `codex.mcp_servers[${index}].args`),
            env: parseEnv(server.env, `codex.mcp_servers[${index}].env`),
          },
        ];
      }),
    );
  }

  if (typeof servers !== "object" || servers === null) {
    throw new Error(`Invalid imported codex.mcp_servers: expected object or array`);
  }

  return Object.fromEntries(
    Object.entries(servers).map(([name, server]) => [
      name,
      {
        command: assertString(server.command, `codex.mcp_servers.${name}.command`),
        args: parseArgs(server.args, `codex.mcp_servers.${name}.args`),
        env: parseEnv(server.env, `codex.mcp_servers.${name}.env`),
      },
    ]),
  );
}

function importJsonClientServers(
  mcpServers: unknown,
  client: SupportedClient,
): Record<string, ServerDefinition> {
  if (mcpServers === undefined) {
    return {};
  }

  if (typeof mcpServers !== "object" || mcpServers === null || Array.isArray(mcpServers)) {
    throw new Error(`Invalid ${client} mcpServers: expected object`);
  }

  return Object.fromEntries(
    Object.entries(mcpServers).map(([name, definition]) => {
      if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
        throw new Error(`Invalid imported ${client} server '${name}': expected object`);
      }

      return [
        name,
        {
          command: assertString((definition as { command?: unknown }).command, `${client}.mcpServers.${name}.command`),
          args: parseArgs((definition as { args?: unknown }).args, `${client}.mcpServers.${name}.args`),
          env: parseEnv((definition as { env?: unknown }).env, `${client}.mcpServers.${name}.env`),
        },
      ];
    }),
  );
}

export function detectImportSources(): Array<{ client: SupportedClient; filePath: string }> {
  const candidates: Array<{ client: SupportedClient; filePath: string }> = [
    { client: "codex", filePath: getCodexConfigPath() },
    { client: "claude", filePath: getClaudeConfigPath() },
    { client: "gemini", filePath: getGeminiConfigPath() },
  ];

  return candidates.filter((candidate) => fs.existsSync(candidate.filePath));
}

export async function importExistingConfigs(): Promise<ImportedConfigResult> {
  const sources = detectImportSources();
  if (sources.length === 0) {
    throw new Error("No existing client configs found to import");
  }

  const importedServers = new Map<string, ImportedServerEntry>();

  for (const source of sources) {
    let clientServers: Record<string, ServerDefinition>;

    if (source.client === "codex") {
      clientServers = await importCodexServers(source.filePath);
    } else if (source.client === "claude") {
      clientServers = importJsonClientServers((await readClaudeConfig(source.filePath)).mcpServers, source.client);
    } else {
      clientServers = importJsonClientServers((await readGeminiConfig(source.filePath)).mcpServers, source.client);
    }

    for (const [serverName, definition] of Object.entries(clientServers)) {
      mergeImportedServer(importedServers, serverName, definition, source.client, source.filePath);
    }
  }

  if (importedServers.size === 0) {
    throw new Error("Detected client configs but none defined MCP servers");
  }

  const servers = Object.fromEntries(
    Array.from(importedServers.entries()).map(([serverName, entry]) => [serverName, entry.definition]),
  );
  const config: McpMatrixConfig = {
    servers,
    scopes: {
      global: {
        enable: Array.from(importedServers.keys()),
      },
      tags: {},
      repos: {},
    },
  };

  return {
    config,
    importedSources: sources,
  };
}

export async function writeImportedConfig(
  config: McpMatrixConfig,
  configPath = getGlobalConfigPath(),
): Promise<string> {
  if (fs.existsSync(configPath)) {
    throw new Error(`Configuration file already exists: ${configPath}`);
  }

  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  const serializedConfig = YAML.stringify(config);
  await writeFileAtomic(configPath, serializedConfig);
  return configPath;
}
