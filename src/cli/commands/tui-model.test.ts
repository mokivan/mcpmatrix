import { describe, expect, it } from "vitest";
import type { DoctorReport, McpMatrixConfig, ResolutionResult } from "../../types";
import {
  buildTuiServerRows,
  canToggleServerRow,
  clampSelectedIndex,
  createDoctorViewModel,
  createInitialTuiState,
  filterTuiServerRows,
  moveSelection,
  setFilter,
} from "./tui-model";

const config: McpMatrixConfig = {
  servers: {
    browser: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-browser"],
    },
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
      },
    },
    postgres: {
      command: "uvx",
      args: ["postgres-server"],
    },
  },
  scopes: {
    global: {
      enable: ["github"],
    },
    repos: {
      "/repo": {
        enable: ["browser"],
        tags: ["backend"],
      },
    },
  },
};

const resolution: ResolutionResult = {
  repoPath: "/repo",
  matchedRepo: true,
  warnings: [],
  tags: ["backend"],
  servers: [
    {
      name: "github",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
      },
    },
    {
      name: "browser",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-browser"],
      env: {},
    },
  ],
};

describe("tui-model", () => {
  it("classifies repo, inherited, and inactive servers", () => {
    const rows = buildTuiServerRows(config, resolution);

    expect(rows).toEqual([
      {
        name: "browser",
        source: "repo",
        isActive: true,
        isLocked: false,
        commandText: "npx -y @modelcontextprotocol/server-browser",
        envVarNames: [],
      },
      {
        name: "github",
        source: "inherited",
        isActive: true,
        isLocked: true,
        commandText: "npx -y @modelcontextprotocol/server-github",
        envVarNames: ["GITHUB_TOKEN"],
      },
      {
        name: "postgres",
        source: "inactive",
        isActive: false,
        isLocked: false,
        commandText: "uvx postgres-server",
        envVarNames: [],
      },
    ]);
  });

  it("blocks disabling inherited servers but allows toggling repo or inactive servers", () => {
    const rows = buildTuiServerRows(config, resolution);
    const repoRow = rows[0] ?? null;
    const inheritedRow = rows[1] ?? null;
    const inactiveRow = rows[2] ?? null;

    expect(canToggleServerRow(repoRow)).toEqual({
      allowed: true,
      nextEnabled: false,
    });
    expect(canToggleServerRow(inheritedRow)).toEqual({
      allowed: false,
      nextEnabled: false,
      reason: "Inherited servers cannot be disabled from repo scope.",
    });
    expect(canToggleServerRow(inactiveRow)).toEqual({
      allowed: true,
      nextEnabled: true,
    });
  });

  it("filters rows and resets selection safely", () => {
    const rows = buildTuiServerRows(config, resolution);
    const filtered = filterTuiServerRows(rows, "git");
    const state = setFilter(
      {
        ...createInitialTuiState(),
        selectedIndex: 2,
      },
      "git",
      filtered.length,
    );

    expect(filtered.map((row) => row.name)).toEqual(["github"]);
    expect(state.selectedIndex).toBe(0);
  });

  it("clamps and moves selection within visible row bounds", () => {
    expect(clampSelectedIndex(-1, 3)).toBe(0);
    expect(clampSelectedIndex(10, 3)).toBe(2);

    const nextState = moveSelection(
      {
        ...createInitialTuiState(),
        selectedIndex: 1,
      },
      3,
      1,
    );

    expect(nextState.selectedIndex).toBe(2);
  });

  it("formats doctor report into renderable sections", () => {
    const report: DoctorReport = {
      configPath: "/home/.mcpmatrix/config.yml",
      detectedRepoPath: "/repo",
      detectionMode: "git",
      matchedRepo: false,
      warnings: ["Repository is not configured: /repo"],
      activeServers: [],
      serverChecks: [
        {
          serverName: "github",
          command: {
            command: "npx",
            exists: true,
            resolvedPath: "/usr/bin/npx",
          },
          missingEnvVars: [],
        },
        {
          serverName: "postgres",
          command: {
            command: "uvx",
            exists: false,
            resolvedPath: null,
          },
          missingEnvVars: ["DATABASE_URL"],
        },
      ],
      repoChecks: [
        {
          repoPath: "/repo",
          accessible: false,
        },
      ],
      suggestedTags: [
        {
          tag: "node",
          evidence: "package.json",
        },
      ],
    };

    const viewModel = createDoctorViewModel(report);

    expect(viewModel.summary[3]).toEqual({
      label: "matched repo",
      detail: "no",
      severity: "warning",
    });
    expect(viewModel.warnings).toEqual([
      {
        label: "warning",
        detail: "Repository is not configured: /repo",
        severity: "warning",
      },
    ]);
    expect(viewModel.serverChecks[1]).toEqual({
      label: "postgres",
      detail: "command missing | missing env: DATABASE_URL",
      severity: "error",
    });
    expect(viewModel.repoChecks[0]?.severity).toBe("error");
    expect(viewModel.suggestedTags[0]?.detail).toBe("package.json");
  });
});
