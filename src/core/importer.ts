import fs from "fs";
import path from "path";
import TOML from "toml";
import YAML from "yaml";
import type {
  ImportedConfigResult,
  McpMatrixConfig,
  RemoteAuth,
  ServerDefinition,
  SupportedClient,
} from "../types";
import { writeFileAtomic } from "../utils/backup";
import {
  getClaudeConfigPath,
  getCodexConfigPath,
  getCopilotCliConfigPath,
  getCopilotVsCodeConfigPath,
  getGeminiConfigPath,
  getGlobalConfigPath,
} from "../utils/paths";
import { readTextFile } from "../utils/text";
import { readClaudeConfig } from "../adapters/claude/writer";
import { readCopilotCliConfig } from "../adapters/copilot-cli/writer";
import { readCopilotVsCodeConfig } from "../adapters/copilot-vscode/writer";
import { readGeminiConfig } from "../adapters/gemini/writer";

type ImportedServerEntry = {
  definition: ServerDefinition;
  client: SupportedClient;
  filePath: string;
};

type CodexTomlServer = {
  name?: unknown;
  command?: unknown;
  url?: unknown;
  args?: unknown;
  env?: unknown;
};

type CodexTomlConfig = {
  mcp_servers?: CodexTomlServer[] | Record<string, CodexTomlServer>;
};

function normalizeServerDefinition(server: ServerDefinition): string {
  if (server.transport === "stdio") {
    const env = Object.fromEntries(Object.entries(server.env ?? {}).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)));

    return JSON.stringify({
      transport: "stdio",
      command: server.command,
      args: server.args ?? [],
      env,
    });
  }

  const headers = Object.fromEntries(
    Object.entries(server.headers ?? {}).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );

  return JSON.stringify({
    transport: "remote",
    protocol: server.protocol,
    url: server.url,
    headers,
    auth: normalizeAuth(server.auth),
  });
}

function normalizeAuth(auth: RemoteAuth | undefined): object | null {
  if (!auth) {
    return null;
  }

  if (auth.type === "none") {
    return { type: "none" };
  }

  if (auth.type === "bearer") {
    return { type: "bearer", token: auth.token };
  }

  return {
    type: "oauth",
    clientId: auth.clientId ?? null,
    clientSecret: auth.clientSecret ?? null,
    callbackPort: auth.callbackPort ?? null,
    metadataUrl: auth.metadataUrl ?? null,
  };
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

  return value.map((entry, index) => assertString(entry, `${fieldName}[${index}]`));
}

function parseStringMap(value: unknown, fieldName: string): Record<string, string> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid imported ${fieldName}: expected object`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([mapKey, mapValue]) => [mapKey, assertString(mapValue, `${fieldName}.${mapKey}`)]),
  );
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Invalid imported ${fieldName}: expected string[]`);
  }

  return value.map((entry, index) => assertString(entry, `${fieldName}[${index}]`));
}

function assertAllowedKeys(value: Record<string, unknown>, allowedKeys: string[], fieldName: string): void {
  const allowedSet = new Set(allowedKeys);
  const unsupportedKeys = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupportedKeys.length > 0) {
    throw new Error(`Invalid imported ${fieldName}: unsupported field(s): ${unsupportedKeys.join(", ")}`);
  }
}

function assertNoInputReferences(values: string[], fieldName: string): void {
  if (values.some((value) => value.includes("${input:"))) {
    throw new Error(`Invalid imported ${fieldName}: VS Code/Copilot input variables are not representable in canonical config`);
  }
}

function parseRemoteAuth(value: unknown, fieldName: string): RemoteAuth | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid imported ${fieldName}: expected object`);
  }

  const authObject = value as Record<string, unknown>;
  const authType = assertString(authObject.type, `${fieldName}.type`);

  if (authType === "none") {
    return { type: "none" };
  }

  if (authType === "bearer") {
    return {
      type: "bearer",
      token: assertString(authObject.token, `${fieldName}.token`),
    };
  }

  if (authType === "oauth") {
    const callbackPort = authObject.callbackPort;
    if (callbackPort !== undefined && (!Number.isInteger(callbackPort) || (callbackPort as number) <= 0)) {
      throw new Error(`Invalid imported ${fieldName}.callbackPort: expected positive integer`);
    }

    const oauthAuth: RemoteAuth = {
      type: "oauth",
      ...(authObject.clientId === undefined ? {} : { clientId: assertString(authObject.clientId, `${fieldName}.clientId`) }),
      ...(authObject.clientSecret === undefined
        ? {}
        : { clientSecret: assertString(authObject.clientSecret, `${fieldName}.clientSecret`) }),
      ...(callbackPort === undefined ? {} : { callbackPort: callbackPort as number }),
      ...(authObject.metadataUrl === undefined
        ? {}
        : { metadataUrl: assertString(authObject.metadataUrl, `${fieldName}.metadataUrl`) }),
    };

    return oauthAuth;
  }

  throw new Error(`Invalid imported ${fieldName}.type: expected one of none, bearer, oauth`);
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

function importCodexDefinition(server: CodexTomlServer, fieldPrefix: string): ServerDefinition {
  const hasCommand = server.command !== undefined;
  const hasUrl = server.url !== undefined;

  if (hasCommand && hasUrl) {
    throw new Error(`Invalid imported ${fieldPrefix}: command and url are mutually exclusive`);
  }

  if (hasCommand) {
    return {
      transport: "stdio",
      command: assertString(server.command, `${fieldPrefix}.command`),
      args: parseArgs(server.args, `${fieldPrefix}.args`),
      env: parseStringMap(server.env, `${fieldPrefix}.env`),
    };
  }

  if (hasUrl) {
    return {
      transport: "remote",
      protocol: "auto",
      url: assertString(server.url, `${fieldPrefix}.url`),
      headers: {},
    };
  }

  throw new Error(`Invalid imported ${fieldPrefix}: expected either command or url`);
}

async function importCodexServers(filePath: string): Promise<Record<string, ServerDefinition>> {
  const rawContent = await readTextFile(filePath);
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
        return [name, importCodexDefinition(server, `codex.mcp_servers[${index}]`)];
      }),
    );
  }

  if (typeof servers !== "object" || servers === null) {
    throw new Error("Invalid imported codex.mcp_servers: expected object or array");
  }

  return Object.fromEntries(
    Object.entries(servers).map(([name, server]) => [name, importCodexDefinition(server, `codex.mcp_servers.${name}`)]),
  );
}

function importClaudeDefinition(name: string, definition: Record<string, unknown>): ServerDefinition {
  const typeValue = definition.type;
  const normalizedType = typeValue === undefined ? undefined : assertString(typeValue, `claude.mcpServers.${name}.type`);

  if (normalizedType === undefined || normalizedType === "stdio" || "command" in definition) {
    if ("url" in definition) {
      throw new Error(`Invalid imported claude.mcpServers.${name}: stdio server cannot define url`);
    }

    return {
      transport: "stdio",
      command: assertString(definition.command, `claude.mcpServers.${name}.command`),
      args: parseArgs(definition.args, `claude.mcpServers.${name}.args`),
      env: parseStringMap(definition.env, `claude.mcpServers.${name}.env`),
    };
  }

  if (normalizedType !== "http" && normalizedType !== "sse") {
    throw new Error(`Invalid imported claude.mcpServers.${name}.type: expected stdio, http, or sse`);
  }

  if ("command" in definition || "args" in definition || "env" in definition) {
    throw new Error(`Invalid imported claude.mcpServers.${name}: remote server cannot define stdio fields`);
  }

  const auth = parseRemoteAuth(definition.auth, `claude.mcpServers.${name}.auth`);

  return {
    transport: "remote",
    protocol: normalizedType,
    url: assertString(definition.url, `claude.mcpServers.${name}.url`),
    headers: parseStringMap(definition.headers, `claude.mcpServers.${name}.headers`),
    ...(auth === undefined ? {} : { auth }),
  };
}

function importGeminiDefinition(name: string, definition: Record<string, unknown>): ServerDefinition {
  if ("command" in definition) {
    if ("httpUrl" in definition) {
      throw new Error(`Invalid imported gemini.mcpServers.${name}: command and httpUrl are mutually exclusive`);
    }

    return {
      transport: "stdio",
      command: assertString(definition.command, `gemini.mcpServers.${name}.command`),
      args: parseArgs(definition.args, `gemini.mcpServers.${name}.args`),
      env: parseStringMap(definition.env, `gemini.mcpServers.${name}.env`),
    };
  }

  if ("httpUrl" in definition) {
    return {
      transport: "remote",
      protocol: "http",
      url: assertString(definition.httpUrl, `gemini.mcpServers.${name}.httpUrl`),
      headers: {},
    };
  }

  throw new Error(`Invalid imported gemini.mcpServers.${name}: expected either command or httpUrl`);
}

function parseCopilotTools(value: unknown, fieldName: string): void {
  if (value === undefined) {
    return;
  }

  const tools = parseStringArray(value, fieldName);
  if (tools.length !== 1 || tools[0] !== "*") {
    throw new Error(`Invalid imported ${fieldName}: only tools [\"*\"] can be normalized into canonical config`);
  }
}

function importCopilotCliDefinition(name: string, definition: Record<string, unknown>): ServerDefinition {
  const fieldName = `copilot-cli.mcpServers.${name}`;
  const normalizedType =
    definition.type === undefined ? undefined : assertString(definition.type, `${fieldName}.type`);

  if (normalizedType === "local" || normalizedType === "stdio" || (normalizedType === undefined && "command" in definition)) {
    assertAllowedKeys(definition, ["type", "command", "args", "env", "tools"], fieldName);
    if ("url" in definition || "headers" in definition) {
      throw new Error(`Invalid imported ${fieldName}: stdio server cannot define remote fields`);
    }

    const command = assertString(definition.command, `${fieldName}.command`);
    const args = parseArgs(definition.args, `${fieldName}.args`);
    const env = parseStringMap(definition.env, `${fieldName}.env`);
    parseCopilotTools(definition.tools, `${fieldName}.tools`);
    assertNoInputReferences([command, ...args, ...Object.values(env)], fieldName);

    return {
      transport: "stdio",
      command,
      args,
      env,
    };
  }

  if (normalizedType === "http" || normalizedType === "sse") {
    assertAllowedKeys(definition, ["type", "url", "headers", "tools"], fieldName);
    if ("command" in definition || "args" in definition || "env" in definition) {
      throw new Error(`Invalid imported ${fieldName}: remote server cannot define stdio fields`);
    }

    const url = assertString(definition.url, `${fieldName}.url`);
    const headers = parseStringMap(definition.headers, `${fieldName}.headers`);
    parseCopilotTools(definition.tools, `${fieldName}.tools`);
    assertNoInputReferences([url, ...Object.values(headers)], fieldName);

    return {
      transport: "remote",
      protocol: normalizedType,
      url,
      headers,
    };
  }

  throw new Error(`Invalid imported ${fieldName}.type: expected local, stdio, http, or sse`);
}

function importCopilotVsCodeDefinition(name: string, definition: Record<string, unknown>): ServerDefinition {
  const fieldName = `copilot-vscode.servers.${name}`;
  const normalizedType =
    definition.type === undefined ? undefined : assertString(definition.type, `${fieldName}.type`);

  if (normalizedType === "stdio" || (normalizedType === undefined && "command" in definition)) {
    assertAllowedKeys(definition, ["type", "command", "args", "env"], fieldName);
    if ("url" in definition || "headers" in definition) {
      throw new Error(`Invalid imported ${fieldName}: stdio server cannot define remote fields`);
    }

    const command = assertString(definition.command, `${fieldName}.command`);
    const args = parseArgs(definition.args, `${fieldName}.args`);
    const env = parseStringMap(definition.env, `${fieldName}.env`);
    assertNoInputReferences([command, ...args, ...Object.values(env)], fieldName);

    return {
      transport: "stdio",
      command,
      args,
      env,
    };
  }

  if (normalizedType === "http" || normalizedType === "sse") {
    assertAllowedKeys(definition, ["type", "url", "headers"], fieldName);
    if ("command" in definition || "args" in definition || "env" in definition) {
      throw new Error(`Invalid imported ${fieldName}: remote server cannot define stdio fields`);
    }

    const url = assertString(definition.url, `${fieldName}.url`);
    const headers = parseStringMap(definition.headers, `${fieldName}.headers`);
    assertNoInputReferences([url, ...Object.values(headers)], fieldName);

    return {
      transport: "remote",
      protocol: normalizedType,
      url,
      headers,
    };
  }

  throw new Error(`Invalid imported ${fieldName}.type: expected stdio, http, or sse`);
}

function importJsonClientServers(
  servers: unknown,
  client: SupportedClient,
  options?: { containerName?: string },
): Record<string, ServerDefinition> {
  if (servers === undefined) {
    return {};
  }

  const containerName = options?.containerName ?? "mcpServers";

  if (typeof servers !== "object" || servers === null || Array.isArray(servers)) {
    throw new Error(`Invalid ${client} ${containerName}: expected object`);
  }

  return Object.fromEntries(
    Object.entries(servers).map(([name, definition]) => {
      if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
        throw new Error(`Invalid imported ${client} server '${name}': expected object`);
      }

      const definitionObject = definition as Record<string, unknown>;

      if (client === "claude") {
        return [name, importClaudeDefinition(name, definitionObject)];
      }

      if (client === "gemini") {
        return [name, importGeminiDefinition(name, definitionObject)];
      }

      if (client === "copilot-cli") {
        return [name, importCopilotCliDefinition(name, definitionObject)];
      }

      if (client === "copilot-vscode") {
        return [name, importCopilotVsCodeDefinition(name, definitionObject)];
      }

      throw new Error(`Unsupported JSON client import: ${client}`);
    }),
  );
}

export function detectImportSources(): Array<{ client: SupportedClient; filePath: string }> {
  const candidates: Array<{ client: SupportedClient; filePath: string }> = [
    { client: "codex", filePath: getCodexConfigPath() },
    { client: "claude", filePath: getClaudeConfigPath() },
    { client: "gemini", filePath: getGeminiConfigPath() },
    { client: "copilot-cli", filePath: getCopilotCliConfigPath() },
    { client: "copilot-vscode", filePath: getCopilotVsCodeConfigPath() },
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
    } else if (source.client === "gemini") {
      clientServers = importJsonClientServers((await readGeminiConfig(source.filePath)).mcpServers, source.client);
    } else if (source.client === "copilot-cli") {
      const copilotCliConfig = await readCopilotCliConfig(source.filePath);
      clientServers = importJsonClientServers(copilotCliConfig.mcpServers, source.client);
    } else {
      const copilotVsCodeConfig = await readCopilotVsCodeConfig(source.filePath);
      if (Array.isArray(copilotVsCodeConfig.inputs) && copilotVsCodeConfig.inputs.length > 0) {
        throw new Error("Invalid imported copilot-vscode.inputs: input variables are not representable in canonical config");
      }

      clientServers = importJsonClientServers(copilotVsCodeConfig.servers, source.client, { containerName: "servers" });
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
