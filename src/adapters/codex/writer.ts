import fs from "fs";
import TOML from "toml";
import type { ResolvedServer } from "../../types";
import { getCodexConfigPath } from "../../utils/paths";
import { readTextFile } from "../../utils/text";
import { getClientCompatibility, hasEnvReference } from "../../core/server-config";

const START_MARKER = "# BEGIN MCPMATRIX MANAGED MCP SERVERS";
const END_MARKER = "# END MCPMATRIX MANAGED MCP SERVERS";

function escapeTomlString(value: string): string {
  return (
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/[\u0000-\u001f\u007f]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`)
  );
}

function formatTomlKey(value: string): string {
  return `"${escapeTomlString(value)}"`;
}

function formatEnvKey(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : formatTomlKey(value);
}

function formatArray(values: string[]): string {
  return `[${values.map((value) => `"${escapeTomlString(value)}"`).join(", ")}]`;
}

function formatEnvTable(env: Record<string, string>): string {
  const entries = Object.entries(env);
  if (entries.length === 0) {
    return "{}";
  }

  return `{ ${entries.map(([key, value]) => `${formatEnvKey(key)} = "${escapeTomlString(value)}"`).join(", ")} }`;
}

function assertCodexSupported(server: ResolvedServer): void {
  const compatibility = getClientCompatibility(server).codex;
  if (!compatibility.supported) {
    throw new Error(`Codex cannot represent server '${server.name}': ${compatibility.reason}`);
  }
}

export function renderCodexManagedSection(servers: ResolvedServer[]): string {
  const lines = [START_MARKER];

  for (const server of servers) {
    assertCodexSupported(server);

    lines.push(`[mcp_servers.${formatTomlKey(server.name)}]`);

    if (server.transport === "stdio") {
      lines.push(`command = "${escapeTomlString(server.command)}"`);
      lines.push(`args = ${formatArray(server.args ?? [])}`);
      const forwarded = Object.entries(server.env ?? {}).filter(([, value]) => hasEnvReference(value)).map(([key]) => key);
      const literalEnv = Object.fromEntries(Object.entries(server.env ?? {}).filter(([, value]) => !hasEnvReference(value)));
      lines.push(`env = ${formatEnvTable(literalEnv)}`);
      if (forwarded.length > 0) {
        // Codex forwards these variables from its own environment instead of storing their values.
        lines.push(`env_vars = ${formatArray(forwarded)}`);
      }
    } else {
      lines.push(`url = "${escapeTomlString(server.url)}"`);
    }

    lines.push("");
  }

  if (servers.length === 0) {
    lines.push("# No MCP servers resolved by mcpmatrix");
  }

  lines.push(END_MARKER);
  lines.push("");

  return lines.join("\n");
}

function assertNoUnmanagedNameCollision(contentOutsideManagedBlock: string, servers: ResolvedServer[]): void {
  let parsed: { mcp_servers?: unknown };
  try {
    parsed = TOML.parse(contentOutsideManagedBlock) as { mcp_servers?: unknown };
  } catch {
    // Not parseable here: leave it to the client to report its own invalid file.
    return;
  }

  const handWritten = parsed.mcp_servers;
  if (typeof handWritten !== "object" || handWritten === null || Array.isArray(handWritten)) {
    return;
  }

  for (const server of servers) {
    if (Object.prototype.hasOwnProperty.call(handWritten, server.name)) {
      throw new Error(
        `Codex config already defines [mcp_servers.${server.name}] outside the mcpmatrix managed block; remove or rename it, then run apply again`,
      );
    }
  }
}

export function mergeCodexConfig(existingContent: string, servers: ResolvedServer[]): string {
  const managedSection = renderCodexManagedSection(servers);
  const escapedStartMarker = START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEndMarker = END_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const managedBlockPattern = new RegExp(`${escapedStartMarker}[\\s\\S]*?${escapedEndMarker}\\n?`, "gm");
  const orphanMarkerPattern = new RegExp(`^(${escapedStartMarker}|${escapedEndMarker})\\s*$\\r?\\n?`, "gm");

  if (managedBlockPattern.test(existingContent)) {
    const preservedContent = existingContent.replace(managedBlockPattern, "").replace(orphanMarkerPattern, "").trimEnd();
    assertNoUnmanagedNameCollision(preservedContent, servers);
    if (preservedContent.length === 0) {
      return managedSection;
    }

    return `${preservedContent}\n\n${managedSection}`;
  }

  const trimmed = existingContent.replace(orphanMarkerPattern, "").trimEnd();
  assertNoUnmanagedNameCollision(trimmed, servers);
  if (trimmed.length === 0) {
    return managedSection;
  }

  return `${trimmed}\n\n${managedSection}`;
}

export async function readCodexConfig(filePath = getCodexConfigPath()): Promise<string> {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return readTextFile(filePath);
}
