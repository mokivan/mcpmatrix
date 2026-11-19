import type {
  ClientCompatibilityCheck,
  RemoteAuth,
  ServerDefinition,
  SupportedClient,
} from "../types";

const ENV_REFERENCE_PATTERN = /\$\{env:([A-Z0-9_]+)\}/g;

export function extractEnvReferences(value: string): string[] {
  const matches = value.matchAll(ENV_REFERENCE_PATTERN);
  return Array.from(new Set(Array.from(matches, (match) => match[1] ?? "").filter((entry) => entry.length > 0)));
}

const ENV_REFERENCE_TEST = /\$\{env:[A-Z0-9_]+\}/;

export function hasEnvReference(value: string): boolean {
  return ENV_REFERENCE_TEST.test(value);
}

/** Rewrites every `${env:VAR}` reference with `render(VAR)`. */
export function translateEnvReferences(value: string, render: (name: string) => string): string {
  return value.replace(/\$\{env:([A-Z0-9_]+)\}/g, (_match, name: string) => render(name));
}

/** Codex forwards a variable by name (`env_vars`), so only `KEY: ${env:KEY}` can be expressed. */
export function isCodexForwardedEnvEntry(key: string, value: string): boolean {
  return value === `\${env:${key}}`;
}

function stdioCommandHasEnvReference(server: ServerDefinition): boolean {
  return server.transport === "stdio" && [server.command, ...(server.args ?? [])].some(hasEnvReference);
}

export function getServerStringValues(server: ServerDefinition): string[] {
  if (server.transport === "stdio") {
    return [
      server.command,
      ...(server.args ?? []),
      ...Object.values(server.env ?? {}),
    ];
  }

  const authValues = getRemoteAuthStringValues(server.auth);
  return [
    server.url,
    ...Object.values(server.headers ?? {}),
    ...authValues,
  ];
}

function getRemoteAuthStringValues(auth: RemoteAuth | undefined): string[] {
  if (!auth) {
    return [];
  }

  if (auth.type === "none") {
    return [];
  }

  if (auth.type === "bearer") {
    return [auth.token];
  }

  return [auth.clientId, auth.clientSecret, auth.metadataUrl].filter((value): value is string => typeof value === "string");
}

export function describeServer(server: ServerDefinition | ({ name: string } & ServerDefinition)): string {
  const prefix = "name" in server ? `${server.name} ` : "";

  if (server.transport === "stdio") {
    return `${prefix}[stdio] ${server.command}${server.args && server.args.length > 0 ? ` ${server.args.join(" ")}` : ""}`.trimEnd();
  }

  return `${prefix}[remote/${server.protocol}] ${server.url}`;
}

export function getClientCompatibility(server: ServerDefinition): Record<SupportedClient, ClientCompatibilityCheck> {
  return {
    codex: getCodexCompatibility(server),
    claude: getClaudeCompatibility(server),
    gemini: getGeminiCompatibility(server),
    "copilot-cli": getCopilotCliCompatibility(server),
    "copilot-vscode": getCopilotVsCodeCompatibility(server),
  };
}

export type SkippedServer<T extends ServerDefinition> = { server: T; reason: string };

/** Splits servers into the ones a client can represent and the ones it cannot (with the reason). */
export function partitionServersForClient<T extends ServerDefinition>(
  servers: T[],
  client: SupportedClient,
): { supported: T[]; skipped: SkippedServer<T>[] } {
  const supported: T[] = [];
  const skipped: SkippedServer<T>[] = [];

  for (const server of servers) {
    const compatibility = getClientCompatibility(server)[client];
    if (compatibility.supported) {
      supported.push(server);
    } else {
      skipped.push({ server, reason: compatibility.reason ?? "unsupported" });
    }
  }

  return { supported, skipped };
}

function getCodexCompatibility(server: ServerDefinition): ClientCompatibilityCheck {
  if (server.transport === "stdio") {
    if (stdioCommandHasEnvReference(server)) {
      return { supported: false, reason: "Codex does not expand environment variables in command or args" };
    }

    const unforwardable = Object.entries(server.env ?? {}).find(
      ([key, value]) => hasEnvReference(value) && !isCodexForwardedEnvEntry(key, value),
    );
    if (unforwardable) {
      return {
        supported: false,
        reason: `Codex can only forward an environment variable under its own name (use ${unforwardable[0]}: \${env:${unforwardable[0]}}); got '${unforwardable[1]}'`,
      };
    }

    return { supported: true, reason: null };
  }

  if (hasEnvReference(server.url)) {
    return { supported: false, reason: "Codex does not expand environment variables in remote URLs" };
  }

  if (server.protocol === "sse") {
    return { supported: false, reason: "Codex remote MCP output only supports URL-based remote servers without explicit SSE transport" };
  }

  if (Object.keys(server.headers ?? {}).length > 0) {
    return { supported: false, reason: "Codex config does not support remote MCP headers" };
  }

  if (server.auth && server.auth.type !== "none") {
    return { supported: false, reason: "Codex config does not support persisted remote MCP auth metadata" };
  }

  return { supported: true, reason: null };
}

function getClaudeCompatibility(server: ServerDefinition): ClientCompatibilityCheck {
  if (server.transport === "stdio") {
    return { supported: true, reason: null };
  }

  if (server.auth?.type === "oauth" && server.auth.clientSecret !== undefined) {
    return { supported: false, reason: "Claude Code does not persist an OAuth client secret in config files" };
  }

  if (server.protocol === "auto") {
    return { supported: true, reason: null };
  }

  if (server.protocol === "http" || server.protocol === "sse") {
    return { supported: true, reason: null };
  }

  return { supported: false, reason: "Unsupported Claude transport" };
}

function getGeminiCompatibility(server: ServerDefinition): ClientCompatibilityCheck {
  if (server.transport === "stdio") {
    if (stdioCommandHasEnvReference(server)) {
      return { supported: false, reason: "Gemini only documents environment variable expansion in the env block, not in command or args" };
    }

    return { supported: true, reason: null };
  }

  if (hasEnvReference(server.url)) {
    return { supported: false, reason: "Gemini only documents environment variable expansion in the env block, not in remote URLs" };
  }

  if (server.protocol === "sse") {
    return { supported: false, reason: "Gemini config supports remote HTTP servers, not SSE" };
  }

  if (Object.keys(server.headers ?? {}).length > 0) {
    return { supported: false, reason: "Gemini config does not support remote MCP headers" };
  }

  if (server.auth && server.auth.type !== "none") {
    return { supported: false, reason: "Gemini config does not support persisted remote MCP auth metadata" };
  }

  return { supported: true, reason: null };
}

function getCopilotCliCompatibility(server: ServerDefinition): ClientCompatibilityCheck {
  if (getServerStringValues(server).some(hasEnvReference)) {
    return {
      supported: false,
      reason: "Copilot CLI does not document environment variable expansion in mcp-config.json; use a literal value or exclude this client with --clients",
    };
  }

  if (server.transport === "stdio") {
    return { supported: true, reason: null };
  }

  if (server.auth && server.auth.type !== "none") {
    return { supported: false, reason: "Copilot CLI config does not support persisted remote MCP auth metadata" };
  }

  return { supported: true, reason: null };
}

function getCopilotVsCodeCompatibility(server: ServerDefinition): ClientCompatibilityCheck {
  if (server.transport === "stdio") {
    return { supported: true, reason: null };
  }

  if (server.auth && server.auth.type !== "none") {
    return { supported: false, reason: "VS Code mcp.json does not support persisted remote MCP auth metadata" };
  }

  return { supported: true, reason: null };
}
