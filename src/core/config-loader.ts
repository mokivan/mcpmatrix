import fs from "fs";
import path from "path";
import YAML from "yaml";
import { McpMatrixConfig, RepoScopeConfig, ServerDefinition, TagScopeConfig } from "../types";
import { writeFileAtomic } from "../utils/backup";
import { getGlobalConfigPath } from "../utils/paths";

const ENV_REFERENCE_PATTERN = /^\$\{env:[A-Z0-9_]+\}$/;

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ${fieldName}: expected non-empty string`);
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

  return [...value];
}

function parseEnvMap(value: unknown, fieldName: string): Record<string, string> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${fieldName}: expected object`);
  }

  const envEntries = Object.entries(value);
  return Object.fromEntries(
    envEntries.map(([envName, envValue]) => {
      const parsedValue = assertString(envValue, `${fieldName}.${envName}`);

      if (parsedValue.includes("${") && !ENV_REFERENCE_PATTERN.test(parsedValue)) {
        throw new Error(
          `Invalid ${fieldName}.${envName}: env references must use the form \${env:VAR_NAME}`,
        );
      }

      return [envName, parsedValue];
    }),
  );
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

      return [
        name,
        {
          command: assertString((serverValue as { command?: unknown }).command, `servers.${name}.command`),
          args: parseStringArray((serverValue as { args?: unknown }).args, `servers.${name}.args`),
          env: parseEnvMap((serverValue as { env?: unknown }).env, `servers.${name}.env`),
        },
      ];
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

  const rawConfig = await fs.promises.readFile(configPath, "utf8");
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
  const initialConfig = `servers:
  github:
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
