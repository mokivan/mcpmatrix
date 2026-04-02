export interface ServerDefinition {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface GlobalScopeConfig {
  enable?: string[];
}

export interface TagScopeConfig {
  enable?: string[];
}

export interface RepoScopeConfig {
  tags?: string[];
  enable?: string[];
}

export interface McpMatrixConfig {
  servers: Record<string, ServerDefinition>;
  scopes?: {
    global?: GlobalScopeConfig;
    tags?: Record<string, TagScopeConfig>;
    repos?: Record<string, RepoScopeConfig>;
  };
}

export interface ResolvedServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface ResolutionResult {
  repoPath: string;
  matchedRepo: boolean;
  warnings: string[];
  tags: string[];
  servers: ResolvedServer[];
}

export interface RepoDetectionResult {
  cwd: string;
  repoPath: string;
  detectionMode: "flag" | "git" | "cwd";
}
