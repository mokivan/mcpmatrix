import type { McpMatrixConfig, RepoScopeConfig } from "../types";

function cloneRepoScope(repoScope?: RepoScopeConfig): RepoScopeConfig {
  return {
    tags: [...(repoScope?.tags ?? [])],
    enable: [...(repoScope?.enable ?? [])],
  };
}

export function setRepoServerEnabled(
  config: McpMatrixConfig,
  repoPath: string,
  serverName: string,
  enabled: boolean,
): McpMatrixConfig {
  const nextConfig: McpMatrixConfig = {
    servers: { ...config.servers },
    scopes: {
      global: {
        enable: [...(config.scopes?.global?.enable ?? [])],
      },
      tags: Object.fromEntries(
        Object.entries(config.scopes?.tags ?? {}).map(([tagName, tagScope]) => [
          tagName,
          {
            enable: [...(tagScope.enable ?? [])],
          },
        ]),
      ),
      repos: Object.fromEntries(
        Object.entries(config.scopes?.repos ?? {}).map(([configuredRepoPath, repoScope]) => [
          configuredRepoPath,
          cloneRepoScope(repoScope),
        ]),
      ),
    },
  };

  const repos = nextConfig.scopes?.repos ?? {};
  const repoScope = cloneRepoScope(repos[repoPath]);
  const enabledServers = new Set(repoScope.enable ?? []);

  if (enabled) {
    enabledServers.add(serverName);
  } else {
    enabledServers.delete(serverName);
  }

  repoScope.enable = [...enabledServers];
  repos[repoPath] = repoScope;

  return nextConfig;
}
