import type { McpMatrixConfig, ResolutionResult, ResolvedServer } from "../types";
import { normalizeRepoPath } from "../utils/paths";

function dedupeServerNames(serverNames: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const serverName of serverNames) {
    if (!seen.has(serverName)) {
      seen.add(serverName);
      deduped.push(serverName);
    }
  }

  return deduped;
}

export function resolveServers(config: McpMatrixConfig, repoPath: string): ResolutionResult {
  const normalizedRepoPath = normalizeRepoPath(repoPath);
  const repoScopes = config.scopes?.repos ?? {};
  const tagsScopes = config.scopes?.tags ?? {};
  const globalEnable = config.scopes?.global?.enable ?? [];

  const repoEntry = Object.entries(repoScopes).find(
    ([configuredRepoPath]) => normalizeRepoPath(configuredRepoPath) === normalizedRepoPath,
  );

  const matchedRepo = Boolean(repoEntry);
  const repoConfig = repoEntry?.[1];
  const tags = repoConfig?.tags ?? [];
  const enabledByTags = tags.flatMap((tagName) => tagsScopes[tagName]?.enable ?? []);
  const enabledByRepo = repoConfig?.enable ?? [];
  const resolvedNames = dedupeServerNames([...globalEnable, ...enabledByTags, ...enabledByRepo]);
  const warnings: string[] = [];

  if (!matchedRepo) {
    warnings.push(`Repository is not configured: ${normalizedRepoPath}`);
  }

  const servers: ResolvedServer[] = resolvedNames.map((serverName) => {
    const serverDefinition = config.servers[serverName];

    if (!serverDefinition) {
      throw new Error(`Unknown server referenced by scopes: ${serverName}`);
    }

    return {
      name: serverName,
      command: serverDefinition.command,
      args: serverDefinition.args ?? [],
      env: serverDefinition.env ?? {},
    };
  });

  return {
    repoPath: normalizedRepoPath,
    matchedRepo,
    warnings,
    tags,
    servers,
  };
}
