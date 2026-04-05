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
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-browser"],
    },
    github: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
      },
    },
    postgres: {
      transport: "remote",
      protocol: "http",
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer ${env:POSTGRES_TOKEN}",
      },
    },
    remoteSse: {
      transport: "remote",
      protocol: "sse",
      url: "https://example.com/sse",
    },
    shell: {
      transport: "stdio",
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
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
      },
    },
    {
      name: "browser",
      transport: "stdio",
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
        transportLabel: "stdio",
        commandText: "browser [stdio] npx -y @modelcontextprotocol/server-browser",
        envVarNames: [],
      },
      {
        name: "github",
        source: "inherited",
        isActive: true,
        isLocked: true,
        transportLabel: "stdio",
        commandText: "github [stdio] npx -y @modelcontextprotocol/server-github",
        envVarNames: ["GITHUB_TOKEN"],
      },
      {
        name: "postgres",
        source: "inactive",
        isActive: false,
        isLocked: false,
        transportLabel: "remote/http",
        commandText: "postgres [remote/http] https://example.com/mcp",
        envVarNames: ["POSTGRES_TOKEN"],
      },
      {
        name: "remoteSse",
        source: "inactive",
        isActive: false,
        isLocked: false,
        transportLabel: "remote/sse",
        commandText: "remoteSse [remote/sse] https://example.com/sse",
        envVarNames: [],
      },
      {
        name: "shell",
        source: "inactive",
        isActive: false,
        isLocked: false,
        transportLabel: "stdio",
        commandText: "shell [stdio] uvx postgres-server",
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
          transport: "stdio",
          runtime: {
            transport: "stdio",
            command: "npx",
            exists: true,
            resolvedPath: "/usr/bin/npx",
          },
          compatibility: {
            codex: { supported: true, reason: null },
            claude: { supported: true, reason: null },
            gemini: { supported: true, reason: null },
          },
          missingEnvVars: [],
        },
        {
          serverName: "postgres",
          transport: "remote",
          runtime: {
            transport: "remote",
            url: "https://example.com/sse",
            protocol: "sse",
            valid: false,
            issues: ["invalid URL"],
          },
          compatibility: {
            codex: { supported: false, reason: "Codex cannot persist SSE metadata" },
            claude: { supported: true, reason: null },
            gemini: { supported: false, reason: "Gemini does not support SSE" },
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
      detail:
        "remote | remote invalid | https://example.com/sse | issues: invalid URL | missing env: DATABASE_URL | compat: codex: Codex cannot persist SSE metadata; gemini: Gemini does not support SSE",
      severity: "error",
    });
    expect(viewModel.repoChecks[0]?.severity).toBe("error");
    expect(viewModel.suggestedTags[0]?.detail).toBe("package.json");
  });
});
