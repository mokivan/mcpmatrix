import fs from "fs";
import type { SupportedClient } from "../types";
import { commandExists } from "./config-validator";
import {
  getClaudeConfigPath,
  getCodexConfigPath,
  getGeminiConfigPath,
  getRepoClaudeConfigPath,
  getRepoCodexConfigPath,
  getRepoGeminiConfigPath,
} from "../utils/paths";

export const SUPPORTED_CLIENTS: SupportedClient[] = ["codex", "claude", "gemini"];

type ClientSelectionMode = "all" | "auto" | "explicit";

export interface ClientDetection {
  client: SupportedClient;
  selected: boolean;
  configured: boolean;
  installed: boolean;
  configPaths: string[];
  installedCommands: string[];
}

export interface ResolvedClientSelection {
  mode: ClientSelectionMode;
  clients: SupportedClient[];
  detections: ClientDetection[];
}

const CLIENT_COMMANDS: Record<SupportedClient, string[]> = {
  codex: ["codex"],
  claude: ["claude"],
  gemini: ["gemini"],
};

function getClientConfigPaths(client: SupportedClient, repoPath?: string, matchedRepo?: boolean): string[] {
  if (client === "codex") {
    return matchedRepo ? [getCodexConfigPath(), getRepoCodexConfigPath(repoPath ?? "")] : [getCodexConfigPath()];
  }

  if (client === "claude") {
    return matchedRepo ? [getClaudeConfigPath(), getRepoClaudeConfigPath(repoPath ?? "")] : [getClaudeConfigPath()];
  }

  return matchedRepo ? [getGeminiConfigPath(), getRepoGeminiConfigPath(repoPath ?? "")] : [getGeminiConfigPath()];
}

function getConfiguredPaths(paths: string[]): string[] {
  return paths.filter((candidatePath) => fs.existsSync(candidatePath));
}

function getInstalledCommands(client: SupportedClient): string[] {
  return CLIENT_COMMANDS[client].filter((command) => commandExists(command));
}

export function parseClientSelection(rawValue?: string): ResolvedClientSelection {
  if (!rawValue || rawValue.trim() === "" || rawValue.trim() === "all") {
    return {
      mode: "all",
      clients: [...SUPPORTED_CLIENTS],
      detections: [],
    };
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (normalizedValue === "auto") {
    return {
      mode: "auto",
      clients: [],
      detections: [],
    };
  }

  const requestedClients = normalizedValue
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (requestedClients.length === 0) {
    throw new Error("Invalid --clients value: expected all, auto, or a comma-separated client list");
  }

  const invalidClients = requestedClients.filter((client) => !SUPPORTED_CLIENTS.includes(client as SupportedClient));
  if (invalidClients.length > 0) {
    throw new Error(`Invalid --clients value: unsupported client(s): ${invalidClients.join(", ")}`);
  }

  return {
    mode: "explicit",
    clients: [...new Set(requestedClients as SupportedClient[])],
    detections: [],
  };
}

export function resolveClientSelection(
  selection: ResolvedClientSelection,
  options: { repoPath: string; matchedRepo: boolean },
): ResolvedClientSelection {
  if (selection.mode !== "auto") {
    return selection;
  }

  const detections = SUPPORTED_CLIENTS.map<ClientDetection>((client) => {
    const configPaths = getConfiguredPaths(getClientConfigPaths(client, options.repoPath, options.matchedRepo));
    const installedCommands = getInstalledCommands(client);
    return {
      client,
      selected: configPaths.length > 0 || installedCommands.length > 0,
      configured: configPaths.length > 0,
      installed: installedCommands.length > 0,
      configPaths,
      installedCommands,
    };
  });

  return {
    mode: "auto",
    clients: detections.filter((detection) => detection.selected).map((detection) => detection.client),
    detections,
  };
}
