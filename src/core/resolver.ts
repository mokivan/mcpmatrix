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
  const globalNames = dedupeServerNames(globalEnable);
  const repoScopedNames = dedupeServerNames([...enabledByTags, ...enabledByRepo]).filter(
    (serverName) => !globalNames.includes(serverName),
  );
  const resolvedNames = [...globalNames, ...repoScopedNames];
  const warnings: string[] = [];

  if (!matchedRepo) {
    warnings.push(`Repository is not configured: ${normalizedRepoPath}`);
  }

  const serverMap = new Map<string, ResolvedServer>();

  for (const serverName of resolvedNames) {
    const serverDefinition = config.servers[serverName];

    if (!serverDefinition) {
      throw new Error(`Unknown server referenced by scopes: ${serverName}`);
    }

    if (serverDefinition.transport === "stdio") {
      serverMap.set(serverName, {
        name: serverName,
        transport: "stdio",
        command: serverDefinition.command,
        args: serverDefinition.args ?? [],
        env: serverDefinition.env ?? {},
      });
      continue;
    }

    const remoteServer: ResolvedServer = {
      name: serverName,
      transport: "remote",
      protocol: serverDefinition.protocol,
      url: serverDefinition.url,
      headers: serverDefinition.headers ?? {},
      ...(serverDefinition.auth === undefined ? {} : { auth: serverDefinition.auth }),
    };

    serverMap.set(serverName, remoteServer);
  }

  const globalServers = globalNames.map((serverName) => serverMap.get(serverName)).filter((server): server is ResolvedServer => server !== undefined);
  const repoScopedServers = repoScopedNames
    .map((serverName) => serverMap.get(serverName))
    .filter((server): server is ResolvedServer => server !== undefined);
  const servers = [...globalServers, ...repoScopedServers];

  return {
    repoPath: normalizedRepoPath,
    matchedRepo,
    warnings,
    tags,
    globalServers,
    repoScopedServers,
    servers,
  };
}
