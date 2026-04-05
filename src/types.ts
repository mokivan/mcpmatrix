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

export type SupportedClient = "codex" | "claude" | "gemini";

export interface BackupEntry {
  client: SupportedClient;
  filePath: string;
  backupPath: string;
  backupFileName: string;
  timestamp: string;
}

export interface ImportedConfigSource {
  client: SupportedClient;
  filePath: string;
}

export interface ImportedConfigResult {
  config: McpMatrixConfig;
  importedSources: ImportedConfigSource[];
}

export interface ApplyTargetResult {
  client: SupportedClient;
  filePath: string;
  backupPath: string | null;
}

export interface ApplyResult {
  targets: ApplyTargetResult[];
  rollbackPerformed: boolean;
}

export interface RollbackTarget {
  client: SupportedClient;
  filePath: string;
  backupPath: string;
}

export interface RollbackResult {
  targets: RollbackTarget[];
}

export interface CommandValidationResult {
  command: string;
  exists: boolean;
  resolvedPath: string | null;
}

export interface ServerDoctorCheck {
  serverName: string;
  command: CommandValidationResult;
  missingEnvVars: string[];
}

export interface RepoAccessibilityCheck {
  repoPath: string;
  accessible: boolean;
}

export interface StackTagSuggestion {
  tag: string;
  evidence: string;
}

export interface DoctorReport {
  configPath: string;
  detectedRepoPath: string;
  detectionMode: RepoDetectionResult["detectionMode"];
  matchedRepo: boolean;
  warnings: string[];
  activeServers: ResolvedServer[];
  serverChecks: ServerDoctorCheck[];
  repoChecks: RepoAccessibilityCheck[];
  suggestedTags: StackTagSuggestion[];
}
