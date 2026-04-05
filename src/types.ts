export type RemoteProtocol = "auto" | "http" | "sse";

export interface StdioServerDefinition {
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface RemoteAuthNone {
  type: "none";
}

export interface RemoteAuthBearer {
  type: "bearer";
  token: string;
}

export interface RemoteAuthOAuth {
  type: "oauth";
  clientId?: string;
  clientSecret?: string;
  callbackPort?: number;
  metadataUrl?: string;
}

export type RemoteAuth = RemoteAuthNone | RemoteAuthBearer | RemoteAuthOAuth;

export interface RemoteServerDefinition {
  transport: "remote";
  protocol: RemoteProtocol;
  url: string;
  headers?: Record<string, string>;
  auth?: RemoteAuth;
}

export type ServerDefinition = StdioServerDefinition | RemoteServerDefinition;

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

export type ResolvedServer = ({ name: string } & StdioServerDefinition) | ({ name: string } & RemoteServerDefinition);

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

export interface StdioValidationResult {
  transport: "stdio";
  command: string;
  exists: boolean;
  resolvedPath: string | null;
}

export interface RemoteValidationResult {
  transport: "remote";
  url: string;
  protocol: RemoteProtocol;
  valid: boolean;
  issues: string[];
}

export type ServerTransportValidation = StdioValidationResult | RemoteValidationResult;

export interface ClientCompatibilityCheck {
  supported: boolean;
  reason: string | null;
}

export interface ServerDoctorCheck {
  serverName: string;
  transport: ServerDefinition["transport"];
  runtime: ServerTransportValidation;
  missingEnvVars: string[];
  compatibility: Record<SupportedClient, ClientCompatibilityCheck>;
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
