import type { DoctorReport, McpMatrixConfig, ResolutionResult, ResolvedServer } from "../../types";
import { describeServer, extractEnvReferences, getServerStringValues } from "../../core/server-config";

export type TuiServerSource = "repo" | "inherited" | "inactive";
export type TuiSeverity = "info" | "ok" | "warning" | "error";
export type TuiView = "main" | "doctor";

export interface TuiServerRow {
  name: string;
  source: TuiServerSource;
  isActive: boolean;
  isLocked: boolean;
  transportLabel: string;
  commandText: string;
  envVarNames: string[];
}

export interface TuiContext {
  configPath: string;
  config: McpMatrixConfig;
  repoPath: string;
  detectionMode: "flag" | "git" | "cwd";
  matchedRepo: boolean;
  warnings: string[];
  tags: string[];
  activeServers: ResolvedServer[];
  rows: TuiServerRow[];
}

export interface TuiStatusMessage {
  tone: TuiSeverity;
  text: string;
}

export interface TuiState {
  selectedIndex: number;
  filter: string;
  view: TuiView;
  statusMessage: TuiStatusMessage | null;
  isBusy: boolean;
}

export interface DoctorViewSectionItem {
  label: string;
  detail: string;
  severity: TuiSeverity;
}

export interface DoctorViewModel {
  summary: DoctorViewSectionItem[];
  warnings: DoctorViewSectionItem[];
  serverChecks: DoctorViewSectionItem[];
  repoChecks: DoctorViewSectionItem[];
  suggestedTags: DoctorViewSectionItem[];
}

export function buildTuiServerRows(config: McpMatrixConfig, resolution: ResolutionResult): TuiServerRow[] {
  const repoScope = config.scopes?.repos?.[resolution.repoPath];
  const repoEnabled = new Set(repoScope?.enable ?? []);
  const activeServers = new Set(resolution.servers.map((server) => server.name));
  const allServerNames = Object.keys(config.servers).sort((left, right) => left.localeCompare(right));

  return allServerNames.map((serverName) => {
    const definition = config.servers[serverName];
    if (!definition) {
      throw new Error(`Unknown server definition: ${serverName}`);
    }
    const isRepoEnabled = repoEnabled.has(serverName);
    const isActive = activeServers.has(serverName);
    const source: TuiServerSource = isRepoEnabled ? "repo" : isActive ? "inherited" : "inactive";

    return {
      name: serverName,
      source,
      isActive,
      isLocked: source === "inherited",
      transportLabel: definition.transport === "stdio" ? "stdio" : `remote/${definition.protocol}`,
      commandText: describeServer({ name: serverName, ...definition }),
      envVarNames: Array.from(
        new Set(getServerStringValues(definition).flatMap((value) => extractEnvReferences(value))),
      ).sort((left, right) => left.localeCompare(right)),
    };
  });
}

export function createInitialTuiState(): TuiState {
  return {
    selectedIndex: 0,
    filter: "",
    view: "main",
    statusMessage: null,
    isBusy: false,
  };
}

export function filterTuiServerRows(rows: readonly TuiServerRow[], filter: string): TuiServerRow[] {
  const normalizedFilter = filter.trim().toLowerCase();
  if (normalizedFilter === "") {
    return [...rows];
  }

  return rows.filter((row) => row.name.toLowerCase().includes(normalizedFilter));
}

export function clampSelectedIndex(selectedIndex: number, rowCount: number): number {
  if (rowCount <= 0) {
    return 0;
  }

  if (selectedIndex < 0) {
    return 0;
  }

  if (selectedIndex >= rowCount) {
    return rowCount - 1;
  }

  return selectedIndex;
}

export function syncStateWithRows(state: TuiState, rows: readonly TuiServerRow[]): TuiState {
  return {
    ...state,
    selectedIndex: clampSelectedIndex(state.selectedIndex, rows.length),
  };
}

export function moveSelection(state: TuiState, rowCount: number, direction: -1 | 1): TuiState {
  return {
    ...state,
    selectedIndex: clampSelectedIndex(state.selectedIndex + direction, rowCount),
  };
}

export function setFilter(state: TuiState, filter: string, rowCount: number): TuiState {
  return {
    ...state,
    filter,
    selectedIndex: clampSelectedIndex(0, rowCount),
  };
}

export function getSelectedRow(rows: readonly TuiServerRow[], selectedIndex: number): TuiServerRow | null {
  return rows[selectedIndex] ?? null;
}

export function canToggleServerRow(row: TuiServerRow | null): { allowed: boolean; nextEnabled: boolean; reason?: string } {
  if (!row) {
    return {
      allowed: false,
      nextEnabled: false,
      reason: "No server selected.",
    };
  }

  if (row.isLocked) {
    return {
      allowed: false,
      nextEnabled: false,
      reason: "Inherited servers cannot be disabled from repo scope.",
    };
  }

  return {
    allowed: true,
    nextEnabled: row.source !== "repo",
  };
}

function toWarningItem(detail: string): DoctorViewSectionItem {
  return {
    label: "warning",
    detail,
    severity: "warning",
  };
}

export function createDoctorViewModel(report: DoctorReport): DoctorViewModel {
  return {
    summary: [
      {
        label: "config",
        detail: report.configPath,
        severity: "info",
      },
      {
        label: "repo",
        detail: report.detectedRepoPath,
        severity: "info",
      },
      {
        label: "detection",
        detail: report.detectionMode,
        severity: "info",
      },
      {
        label: "matched repo",
        detail: report.matchedRepo ? "yes" : "no",
        severity: report.matchedRepo ? "ok" : "warning",
      },
      {
        label: "active servers",
        detail: report.activeServers.map((server) => server.name).join(", ") || "(none)",
        severity: report.activeServers.length > 0 ? "ok" : "warning",
      },
    ],
    warnings: report.warnings.map(toWarningItem),
    serverChecks: report.serverChecks.map((check) => {
      const compatibilityIssues = Object.entries(check.compatibility)
        .filter(([, entry]) => !entry.supported)
        .map(([client, entry]) => `${client}: ${entry.reason ?? "unsupported"}`);
      const hasErrors =
        (check.runtime.transport === "stdio" && !check.runtime.exists) ||
        (check.runtime.transport === "remote" && !check.runtime.valid) ||
        check.missingEnvVars.length > 0 ||
        compatibilityIssues.length > 0;
      const parts: string[] = [check.transport];

      if (check.runtime.transport === "stdio") {
        parts.push(`command ${check.runtime.exists ? "ok" : "missing"}`);
        if (check.runtime.resolvedPath) {
          parts.push(check.runtime.resolvedPath);
        }
      } else {
        parts.push(`remote ${check.runtime.valid ? "ok" : "invalid"}`);
        parts.push(check.runtime.url);
        if (check.runtime.issues.length > 0) {
          parts.push(`issues: ${check.runtime.issues.join(", ")}`);
        }
      }

      if (check.missingEnvVars.length > 0) {
        parts.push(`missing env: ${check.missingEnvVars.join(", ")}`);
      }

      if (compatibilityIssues.length > 0) {
        parts.push(`compat: ${compatibilityIssues.join("; ")}`);
      }

      return {
        label: check.serverName,
        detail: parts.join(" | "),
        severity: hasErrors ? "error" : "ok",
      };
    }),
    repoChecks: report.repoChecks.map((check) => ({
      label: check.repoPath,
      detail: check.accessible ? "accessible" : "missing or inaccessible",
      severity: check.accessible ? "ok" : "error",
    })),
    suggestedTags: report.suggestedTags.map((suggestion) => ({
      label: suggestion.tag,
      detail: suggestion.evidence,
      severity: "info",
    })),
  };
}
