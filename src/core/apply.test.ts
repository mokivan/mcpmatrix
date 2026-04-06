import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readCodexConfig: vi.fn(),
  mergeCodexConfig: vi.fn(),
  readClaudeConfig: vi.fn(),
  renderClaudeConfig: vi.fn(),
  readGeminiConfig: vi.fn(),
  renderGeminiConfig: vi.fn(),
  createBackupIfExists: vi.fn(),
  restoreFromBackupOrRemove: vi.fn(),
  writeFileAtomic: vi.fn(),
  getCodexConfigPath: vi.fn(),
  getClaudeConfigPath: vi.fn(),
  getGeminiConfigPath: vi.fn(),
  getRepoCodexConfigPath: vi.fn(),
  getRepoClaudeConfigPath: vi.fn(),
  getRepoGeminiConfigPath: vi.fn(),
}));

vi.mock("../adapters/codex/writer", () => ({
  readCodexConfig: mocks.readCodexConfig,
  mergeCodexConfig: mocks.mergeCodexConfig,
}));

vi.mock("../adapters/claude/writer", () => ({
  readClaudeConfig: mocks.readClaudeConfig,
  renderClaudeConfig: mocks.renderClaudeConfig,
}));

vi.mock("../adapters/gemini/writer", () => ({
  readGeminiConfig: mocks.readGeminiConfig,
  renderGeminiConfig: mocks.renderGeminiConfig,
}));

vi.mock("../utils/backup", () => ({
  createBackupIfExists: mocks.createBackupIfExists,
  restoreFromBackupOrRemove: mocks.restoreFromBackupOrRemove,
  writeFileAtomic: mocks.writeFileAtomic,
}));

vi.mock("../utils/paths", () => ({
  getCodexConfigPath: mocks.getCodexConfigPath,
  getClaudeConfigPath: mocks.getClaudeConfigPath,
  getGeminiConfigPath: mocks.getGeminiConfigPath,
  getRepoCodexConfigPath: mocks.getRepoCodexConfigPath,
  getRepoClaudeConfigPath: mocks.getRepoClaudeConfigPath,
  getRepoGeminiConfigPath: mocks.getRepoGeminiConfigPath,
}));

import { applyResolvedServers } from "./apply";

const githubServer = {
  name: "github",
  transport: "stdio" as const,
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-github"],
  env: {},
};

const medusaServer = {
  name: "medusajs",
  transport: "remote" as const,
  protocol: "http" as const,
  url: "https://docs.medusajs.com/mcp",
  headers: {},
};

describe("applyResolvedServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCodexConfigPath.mockReturnValue("/tmp/codex.toml");
    mocks.getClaudeConfigPath.mockReturnValue("/tmp/claude.json");
    mocks.getGeminiConfigPath.mockReturnValue("/tmp/gemini.json");
    mocks.getRepoCodexConfigPath.mockReturnValue("/repo/.codex/config.toml");
    mocks.getRepoClaudeConfigPath.mockReturnValue("/repo/.mcp.json");
    mocks.getRepoGeminiConfigPath.mockReturnValue("/repo/.gemini/settings.json");

    mocks.readCodexConfig.mockResolvedValue("model = \"gpt-5\"\n");
    mocks.readClaudeConfig.mockResolvedValue({ theme: "dark" });
    mocks.readGeminiConfig.mockResolvedValue({ theme: "light" });

    mocks.mergeCodexConfig.mockReturnValue("codex-next");
    mocks.renderClaudeConfig.mockReturnValue({ mcpServers: { github: { command: "npx" } } });
    mocks.renderGeminiConfig.mockReturnValue({ mcpServers: { github: { command: "npx" } } });

    mocks.createBackupIfExists
      .mockResolvedValueOnce("/tmp/codex.toml.bak")
      .mockResolvedValueOnce("/tmp/claude.json.bak")
      .mockResolvedValueOnce("/tmp/gemini.json.bak")
      .mockResolvedValueOnce("/repo/.codex/config.toml.bak")
      .mockResolvedValueOnce("/repo/.mcp.json.bak")
      .mockResolvedValueOnce("/repo/.gemini/settings.json.bak");
    mocks.writeFileAtomic.mockResolvedValue(undefined);
    mocks.restoreFromBackupOrRemove.mockResolvedValue(undefined);
  });

  it("writes global and repo targets after preparing backups", async () => {
    const result = await applyResolvedServers({
      repoPath: "/repo",
      matchedRepo: true,
      warnings: [],
      tags: ["medusajs"],
      globalServers: [githubServer],
      repoScopedServers: [medusaServer],
      servers: [githubServer, medusaServer],
    });

    expect(mocks.createBackupIfExists).toHaveBeenCalledTimes(6);
    expect(mocks.writeFileAtomic).toHaveBeenCalledTimes(6);
    expect(result.targets.map((target) => `${target.client}:${target.scope}`)).toEqual([
      "codex:global",
      "claude:global",
      "gemini:global",
      "codex:repo",
      "claude:repo",
      "gemini:repo",
    ]);
    expect(result.rollbackPerformed).toBe(false);
  });

  it("rolls back every target if a later write fails", async () => {
    mocks.writeFileAtomic
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("disk full"));

    await expect(
      applyResolvedServers({
        repoPath: "/repo",
        matchedRepo: true,
        warnings: [],
        tags: ["medusajs"],
        globalServers: [githubServer],
        repoScopedServers: [medusaServer],
        servers: [githubServer, medusaServer],
      }),
    ).rejects.toThrow("apply: failed to update gemini config; restored previous state.");

    expect(mocks.restoreFromBackupOrRemove).toHaveBeenCalledTimes(6);
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(1, "/tmp/codex.toml", "/tmp/codex.toml.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(2, "/tmp/claude.json", "/tmp/claude.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(3, "/tmp/gemini.json", "/tmp/gemini.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(4, "/repo/.codex/config.toml", "/repo/.codex/config.toml.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(5, "/repo/.mcp.json", "/repo/.mcp.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(6, "/repo/.gemini/settings.json", "/repo/.gemini/settings.json.bak");
  });
});
