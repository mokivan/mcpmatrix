import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyResolvedServers: vi.fn(),
  loadConfig: vi.fn(),
  detectRepoPath: vi.fn(),
  resolveServers: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../core/apply", () => ({
  applyResolvedServers: mocks.applyResolvedServers,
}));

vi.mock("../../core/config-loader", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("../../core/repo-detector", () => ({
  detectRepoPath: mocks.detectRepoPath,
}));

vi.mock("../../core/resolver", () => ({
  resolveServers: mocks.resolveServers,
}));

vi.mock("../../utils/logger", () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}));

import { runApplyCommand } from "./apply";

describe("runApplyCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyResolvedServers.mockResolvedValue({
      rollbackPerformed: false,
      targets: [
        {
          client: "codex",
          scope: "global",
          filePath: "/tmp/codex.toml",
          backupPath: "/tmp/codex.toml.bak",
        },
      ],
    });
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
      repoPath: "/repo",
      cwd: "/repo",
      detectionMode: "cwd",
    });
    mocks.resolveServers.mockReturnValue({
      repoPath: "/repo",
      matchedRepo: true,
      warnings: [],
      tags: [],
      globalServers: [
        {
          name: "github",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: {},
        },
      ],
      repoScopedServers: [],
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
  });

  it("fails before mutating Codex when Claude config is invalid", async () => {
    mocks.applyResolvedServers.mockRejectedValue(new SyntaxError("Unexpected token"));

    await expect(runApplyCommand()).rejects.toThrow("Unexpected token");
    expect(mocks.applyResolvedServers).toHaveBeenCalled();
  });
});
