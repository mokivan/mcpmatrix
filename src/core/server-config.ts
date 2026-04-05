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
  };
}

function getCodexCompatibility(server: ServerDefinition): ClientCompatibilityCheck {
  if (server.transport === "stdio") {
    return { supported: true, reason: null };
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
    return { supported: true, reason: null };
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
