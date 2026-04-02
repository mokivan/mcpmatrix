import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  writeCodexConfig: vi.fn(),
  readClaudeConfig: vi.fn(),
  writeClaudeConfig: vi.fn(),
  loadConfig: vi.fn(),
  detectRepoPath: vi.fn(),
  resolveServers: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../adapters/codex/writer", () => ({
  writeCodexConfig: mocks.writeCodexConfig,
}));

vi.mock("../../adapters/claude/writer", () => ({
  readClaudeConfig: mocks.readClaudeConfig,
  writeClaudeConfig: mocks.writeClaudeConfig,
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
    mocks.loadConfig.mockResolvedValue({
      servers: {
        github: {
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
      servers: [
        {
          name: "github",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: {},
        },
      ],
    });
  });

  it("fails before mutating Codex when Claude config is invalid", async () => {
    mocks.readClaudeConfig.mockRejectedValue(new SyntaxError("Unexpected token"));

    await expect(runApplyCommand()).rejects.toThrow("Unexpected token");
    expect(mocks.writeCodexConfig).not.toHaveBeenCalled();
    expect(mocks.writeClaudeConfig).not.toHaveBeenCalled();
  });
});
