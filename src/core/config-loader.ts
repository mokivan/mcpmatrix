import fs from "fs";
import path from "path";
import YAML from "yaml";
import type {
  McpMatrixConfig,
  RemoteAuth,
  RemoteProtocol,
  RemoteServerDefinition,
  RepoScopeConfig,
  ServerDefinition,
  StdioServerDefinition,
  TagScopeConfig,
} from "../types";
import { writeFileAtomic } from "../utils/backup";
import { getConfigSchemaUri, getGlobalConfigPath } from "../utils/paths";
import { readTextFile } from "../utils/text";

const ENV_REFERENCE_PATTERN = /\$\{env:[A-Z0-9_]+\}/g;

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ${fieldName}: expected non-empty string`);
  }

  const invalidMatch = value.match(/\$\{[^}]+\}/);
  if (invalidMatch) {
    const validRefs = value.match(ENV_REFERENCE_PATTERN) ?? [];
    const invalidToken = invalidMatch[0] ?? "";
    if (!validRefs.some((entry) => entry === invalidToken)) {
      throw new Error(`Invalid ${fieldName}: env references must use the form \${env:VAR_NAME}`);
    }
  }

  if (value.includes("${")) {
    const stripped = value.replace(ENV_REFERENCE_PATTERN, "");
    if (stripped.includes("${")) {
      throw new Error(`Invalid ${fieldName}: env references must use the form \${env:VAR_NAME}`);
    }
  }

  return value;
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Invalid ${fieldName}: expected string[]`);
  }

  return value.map((entry, index) => assertString(entry, `${fieldName}[${index}]`));
}

function parseStringMap(value: unknown, fieldName: string): Record<string, string> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${fieldName}: expected object`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, assertString(entryValue, `${fieldName}.${key}`)]),
  );
}

function parseRemoteProtocol(value: unknown, fieldName: string): RemoteProtocol {
  if (value !== "auto" && value !== "http" && value !== "sse") {
    throw new Error(`Invalid ${fieldName}: expected one of auto, http, sse`);
  }

  return value;
}

function parseRemoteAuth(value: unknown, fieldName: string): RemoteAuth | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${fieldName}: expected object`);
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
      throw new Error(`Invalid ${fieldName}.callbackPort: expected positive integer`);
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

  throw new Error(`Invalid ${fieldName}.type: expected one of none, bearer, oauth`);
}

function parseStdioServerDefinition(
  name: string,
  serverValue: Record<string, unknown>,
): StdioServerDefinition {
  if ("url" in serverValue || "protocol" in serverValue || "headers" in serverValue || "auth" in serverValue) {
    throw new Error(`Invalid servers.${name}: stdio servers must not define remote-only fields`);
  }

  return {
    transport: "stdio",
    command: assertString(serverValue.command, `servers.${name}.command`),
    args: parseStringArray(serverValue.args, `servers.${name}.args`),
    env: parseStringMap(serverValue.env, `servers.${name}.env`),
  };
}

function parseRemoteServerDefinition(
  name: string,
  serverValue: Record<string, unknown>,
): RemoteServerDefinition {
  if ("command" in serverValue || "args" in serverValue || "env" in serverValue) {
    throw new Error(`Invalid servers.${name}: remote servers must not define stdio-only fields`);
  }

  const auth = parseRemoteAuth(serverValue.auth, `servers.${name}.auth`);

  return {
    transport: "remote",
    protocol: parseRemoteProtocol(serverValue.protocol, `servers.${name}.protocol`),
    url: assertString(serverValue.url, `servers.${name}.url`),
    headers: parseStringMap(serverValue.headers, `servers.${name}.headers`),
    ...(auth === undefined ? {} : { auth }),
  };
}

function parseServerDefinitions(value: unknown): Record<string, ServerDefinition> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid servers: expected object");
  }

  return Object.fromEntries(
    Object.entries(value).map(([name, serverValue]) => {
      if (typeof serverValue !== "object" || serverValue === null || Array.isArray(serverValue)) {
        throw new Error(`Invalid servers.${name}: expected object`);
      }

      const serverObject = serverValue as Record<string, unknown>;
      const transport = assertString(serverObject.transport, `servers.${name}.transport`);

      if (transport === "stdio") {
        return [name, parseStdioServerDefinition(name, serverObject)];
      }

      if (transport === "remote") {
        return [name, parseRemoteServerDefinition(name, serverObject)];
      }

      throw new Error(`Invalid servers.${name}.transport: expected one of stdio, remote`);
    }),
  );
}

function parseTagScopes(value: unknown): Record<string, TagScopeConfig> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid scopes.tags: expected object");
  }

  return Object.fromEntries(
    Object.entries(value).map(([tagName, tagScope]) => {
      if (typeof tagScope !== "object" || tagScope === null || Array.isArray(tagScope)) {
        throw new Error(`Invalid scopes.tags.${tagName}: expected object`);
      }

      return [
        tagName,
        {
          enable: parseStringArray((tagScope as { enable?: unknown }).enable, `scopes.tags.${tagName}.enable`),
        },
      ];
    }),
  );
}

function parseRepoScopes(value: unknown): Record<string, RepoScopeConfig> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid scopes.repos: expected object");
  }

  return Object.fromEntries(
    Object.entries(value).map(([repoPath, repoScope]) => {
      if (typeof repoScope !== "object" || repoScope === null || Array.isArray(repoScope)) {
        throw new Error(`Invalid scopes.repos.${repoPath}: expected object`);
      }

      return [
        repoPath,
        {
          tags: parseStringArray((repoScope as { tags?: unknown }).tags, `scopes.repos.${repoPath}.tags`),
          enable: parseStringArray((repoScope as { enable?: unknown }).enable, `scopes.repos.${repoPath}.enable`),
        },
      ];
    }),
  );
}

function validateReferencedServers(config: McpMatrixConfig): void {
  const knownServers = new Set(Object.keys(config.servers));
  const refs: Array<{ scopeName: string; serverNames: string[] }> = [
    {
      scopeName: "scopes.global.enable",
      serverNames: config.scopes?.global?.enable ?? [],
    },
    ...Object.entries(config.scopes?.tags ?? {}).map(([tagName, tagScope]) => ({
      scopeName: `scopes.tags.${tagName}.enable`,
      serverNames: tagScope.enable ?? [],
    })),
    ...Object.entries(config.scopes?.repos ?? {}).map(([repoPath, repoScope]) => ({
      scopeName: `scopes.repos.${repoPath}.enable`,
      serverNames: repoScope.enable ?? [],
    })),
  ];

  for (const ref of refs) {
    for (const serverName of ref.serverNames) {
      if (!knownServers.has(serverName)) {
        throw new Error(`Invalid ${ref.scopeName}: references undefined server '${serverName}'`);
      }
    }
  }
}

export function parseConfig(parsedConfig: unknown): McpMatrixConfig {
  if (typeof parsedConfig !== "object" || parsedConfig === null || Array.isArray(parsedConfig)) {
    throw new Error("Invalid configuration: expected a YAML object");
  }

  const configObject = parsedConfig as {
    servers?: unknown;
    scopes?: {
      global?: { enable?: unknown };
      tags?: unknown;
      repos?: unknown;
    };
  };

  const config: McpMatrixConfig = {
    servers: parseServerDefinitions(configObject.servers),
    scopes: {
      global: {
        enable: parseStringArray(configObject.scopes?.global?.enable, "scopes.global.enable"),
      },
      tags: parseTagScopes(configObject.scopes?.tags),
      repos: parseRepoScopes(configObject.scopes?.repos),
    },
  };

  validateReferencedServers(config);

  return config;
}

export async function loadConfig(configPath = getGlobalConfigPath()): Promise<McpMatrixConfig> {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found at ${configPath}. Run 'mcpmatrix init' first.`);
  }

  const rawConfig = await readTextFile(configPath);
  let parsedConfig: unknown;

  try {
    parsedConfig = YAML.parse(rawConfig) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML in configuration file ${configPath}: ${message}`);
  }

  return parseConfig(parsedConfig);
}

export async function writeInitialConfig(configPath = getGlobalConfigPath()): Promise<void> {
  const initialConfig = `# yaml-language-server: $schema=${getConfigSchemaUri()}

servers:
  github:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: \${env:GITHUB_TOKEN}

scopes:
  global:
    enable:
      - github

  tags:
    ecommerce:
      enable:
        - github

  repos: {}
`;

  if (fs.existsSync(configPath)) {
    throw new Error(`Configuration file already exists: ${configPath}`);
  }

  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await writeFileAtomic(configPath, initialConfig);
}

export async function writeConfig(config: McpMatrixConfig, configPath = getGlobalConfigPath()): Promise<void> {
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await writeFileAtomic(
    configPath,
    YAML.stringify(config, {
      lineWidth: 0,
      minContentWidth: 0,
    }),
  );
}
