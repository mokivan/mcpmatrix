import fs from "fs";
import path from "path";
import YAML from "yaml";
import { McpMatrixConfig, RepoScopeConfig, ServerDefinition, TagScopeConfig } from "../types";
import { getGlobalConfigPath } from "../utils/paths";

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
    envEntries.map(([envName, envValue]) => [envName, assertString(envValue, `${fieldName}.${envName}`)]),
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

export async function loadConfig(configPath = getGlobalConfigPath()): Promise<McpMatrixConfig> {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const rawConfig = await fs.promises.readFile(configPath, "utf8");
  const parsedConfig = YAML.parse(rawConfig) as unknown;

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

  return {
    servers: parseServerDefinitions(configObject.servers),
    scopes: {
      global: {
        enable: parseStringArray(configObject.scopes?.global?.enable, "scopes.global.enable"),
      },
      tags: parseTagScopes(configObject.scopes?.tags),
      repos: parseRepoScopes(configObject.scopes?.repos),
    },
  };
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
  await fs.promises.writeFile(configPath, initialConfig, "utf8");
}
