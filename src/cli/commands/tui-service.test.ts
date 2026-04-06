import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  writeConfig: vi.fn(),
  runDoctor: vi.fn(),
  detectRepoPath: vi.fn(),
  resolveServers: vi.fn(),
  getGlobalConfigPath: vi.fn(),
  openConfigInEditor: vi.fn(),
}));

import {
  assertInteractiveTerminal,
  buildTuiContext,
  editConfigAndReload,
  loadDoctorViewModel,
  toggleRepoServerSelection,
} from "./tui-service";

describe("tui-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGlobalConfigPath.mockReturnValue("/home/.mcpmatrix/config.yml");
    mocks.loadConfig.mockResolvedValue({
      servers: {
        github: {
          transport: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
        },
      },
      scopes: {
        global: {
          enable: ["github"],
        },
      },
    });
    mocks.detectRepoPath.mockReturnValue({
      cwd: "/repo",
      repoPath: "/repo",
      detectionMode: "git",
    });
    mocks.resolveServers.mockReturnValue({
      repoPath: "/repo",
      matchedRepo: true,
      warnings: [],
      tags: ["node"],
      servers: [
        {
          name: "github",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: {},
        },
      ],
    });
    mocks.runDoctor.mockResolvedValue({
      configPath: "/home/.mcpmatrix/config.yml",
      detectedRepoPath: "/repo",
      detectionMode: "git",
      matchedRepo: true,
      warnings: [],
      activeServers: [
        {
          name: "github",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: {},
        },
      ],
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
      ],
      repoChecks: [],
      suggestedTags: [],
    });
  });

  it("rejects non-interactive terminals", () => {
    expect(() =>
      assertInteractiveTerminal(
        { isTTY: false } as Pick<NodeJS.ReadStream, "isTTY">,
        { isTTY: true } as Pick<NodeJS.WriteStream, "isTTY">,
      ),
    ).toThrow("mcpmatrix tui requires an interactive terminal.");
  });

  it("builds a renderable tui context", async () => {
    const context = await buildTuiContext(
      { repo: "/repo" },
      {
        loadConfig: mocks.loadConfig,
        writeConfig: mocks.writeConfig,
        runDoctor: mocks.runDoctor,
        detectRepoPath: mocks.detectRepoPath,
        resolveServers: mocks.resolveServers,
        getGlobalConfigPath: mocks.getGlobalConfigPath,
        openConfigInEditor: mocks.openConfigInEditor,
      },
    );

    expect(context.repoPath).toBe("/repo");
    expect(context.rows[0]?.name).toBe("github");
    expect(context.tags).toEqual(["node"]);
  });

  it("writes the updated repo toggle and rebuilds context", async () => {
    const context = await buildTuiContext(
      { repo: "/repo" },
      {
        loadConfig: mocks.loadConfig,
        writeConfig: mocks.writeConfig,
        runDoctor: mocks.runDoctor,
        detectRepoPath: mocks.detectRepoPath,
        resolveServers: mocks.resolveServers,
        getGlobalConfigPath: mocks.getGlobalConfigPath,
        openConfigInEditor: mocks.openConfigInEditor,
      },
    );

    await toggleRepoServerSelection(
      context,
      "github",
      true,
      { repo: "/repo" },
      {
        loadConfig: mocks.loadConfig,
        writeConfig: mocks.writeConfig,
        runDoctor: mocks.runDoctor,
        detectRepoPath: mocks.detectRepoPath,
        resolveServers: mocks.resolveServers,
        getGlobalConfigPath: mocks.getGlobalConfigPath,
        openConfigInEditor: mocks.openConfigInEditor,
      },
    );

    expect(mocks.writeConfig).toHaveBeenCalledOnce();
    expect(mocks.loadConfig).toHaveBeenCalledTimes(2);
  });

  it("propagates editor errors during reload", async () => {
    mocks.openConfigInEditor.mockImplementation(() => {
      throw new Error("editor failed");
    });

    await expect(
      editConfigAndReload(
        { repo: "/repo" },
        {
          loadConfig: mocks.loadConfig,
          writeConfig: mocks.writeConfig,
          runDoctor: mocks.runDoctor,
          detectRepoPath: mocks.detectRepoPath,
          resolveServers: mocks.resolveServers,
          getGlobalConfigPath: mocks.getGlobalConfigPath,
          openConfigInEditor: mocks.openConfigInEditor,
        },
      ),
    ).rejects.toThrow("editor failed");
  });

  it("formats doctor data through the service layer", async () => {
    const viewModel = await loadDoctorViewModel(
      { repo: "/repo" },
      {
        loadConfig: mocks.loadConfig,
        writeConfig: mocks.writeConfig,
        runDoctor: mocks.runDoctor,
        detectRepoPath: mocks.detectRepoPath,
        resolveServers: mocks.resolveServers,
        getGlobalConfigPath: mocks.getGlobalConfigPath,
        openConfigInEditor: mocks.openConfigInEditor,
      },
    );

    expect(viewModel.summary[0]?.detail).toBe("/home/.mcpmatrix/config.yml");
    expect(viewModel.serverChecks[0]?.severity).toBe("ok");
  });
});
