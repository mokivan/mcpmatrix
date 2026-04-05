import fs from "fs";
import type { ResolvedServer } from "../../types";
import { createBackupIfExists, writeFileAtomic } from "../../utils/backup";
import { getCodexConfigPath } from "../../utils/paths";

const START_MARKER = "# BEGIN MCPMATRIX MANAGED MCP SERVERS";
const END_MARKER = "# END MCPMATRIX MANAGED MCP SERVERS";

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatTomlKey(value: string): string {
  return `"${escapeTomlString(value)}"`;
}

function formatArray(values: string[]): string {
  return `[${values.map((value) => `"${escapeTomlString(value)}"`).join(", ")}]`;
}

function formatEnvTable(env: Record<string, string>): string {
  const entries = Object.entries(env);
  if (entries.length === 0) {
    return "{}";
  }

  return `{ ${entries.map(([key, value]) => `${key} = "${escapeTomlString(value)}"`).join(", ")} }`;
}

export function renderCodexManagedSection(servers: ResolvedServer[]): string {
  const lines = [START_MARKER];

  for (const server of servers) {
    lines.push(`[mcp_servers.${formatTomlKey(server.name)}]`);
    lines.push(`command = "${escapeTomlString(server.command)}"`);
    lines.push(`args = ${formatArray(server.args)}`);
    lines.push(`env = ${formatEnvTable(server.env)}`);
    lines.push("");
  }

  if (servers.length === 0) {
    lines.push("# No MCP servers resolved by mcpmatrix");
  }

  lines.push(END_MARKER);
  lines.push("");

  return lines.join("\n");
}

export function mergeCodexConfig(existingContent: string, servers: ResolvedServer[]): string {
  const managedSection = renderCodexManagedSection(servers);
  const managedBlockPattern = new RegExp(
    `${START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
    "m",
  );

  if (managedBlockPattern.test(existingContent)) {
    return existingContent.replace(managedBlockPattern, managedSection).trimEnd() + "\n";
  }

  const trimmed = existingContent.trimEnd();
  if (trimmed.length === 0) {
    return managedSection;
  }

  return `${trimmed}\n\n${managedSection}`;
}

export async function readCodexConfig(filePath = getCodexConfigPath()): Promise<string> {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.promises.readFile(filePath, "utf8");
}

export async function writeCodexConfig(servers: ResolvedServer[], filePath = getCodexConfigPath()): Promise<string | null> {
  const existingContent = await readCodexConfig(filePath);
  const nextContent = mergeCodexConfig(existingContent, servers);

  const backupPath = await createBackupIfExists(filePath);
  await writeFileAtomic(filePath, nextContent);

  return backupPath;
}
