import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readCodexConfig: vi.fn(),
  mergeCodexConfig: vi.fn(),
  readClaudeConfig: vi.fn(),
  renderClaudeConfig: vi.fn(),
  readGeminiConfig: vi.fn(),
  renderGeminiConfig: vi.fn(),
  readCopilotCliConfig: vi.fn(),
  renderCopilotCliConfig: vi.fn(),
  readCopilotVsCodeConfig: vi.fn(),
  renderCopilotVsCodeConfig: vi.fn(),
  createBackupIfExists: vi.fn(),
  restoreFromBackupOrRemove: vi.fn(),
  writeFileAtomic: vi.fn(),
  getCodexConfigPath: vi.fn(),
  getClaudeConfigPath: vi.fn(),
  getGeminiConfigPath: vi.fn(),
  getCopilotCliConfigPath: vi.fn(),
  getCopilotVsCodeConfigPath: vi.fn(),
  getRepoCodexConfigPath: vi.fn(),
  getRepoClaudeConfigPath: vi.fn(),
  getRepoGeminiConfigPath: vi.fn(),
  getRepoCopilotCliConfigPath: vi.fn(),
  getRepoCopilotVsCodeConfigPath: vi.fn(),
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

vi.mock("../adapters/copilot-cli/writer", () => ({
  readCopilotCliConfig: mocks.readCopilotCliConfig,
  renderCopilotCliConfig: mocks.renderCopilotCliConfig,
}));

vi.mock("../adapters/copilot-vscode/writer", () => ({
  readCopilotVsCodeConfig: mocks.readCopilotVsCodeConfig,
  renderCopilotVsCodeConfig: mocks.renderCopilotVsCodeConfig,
}));

vi.mock("./managed-state", () => ({
  loadManagedState: vi.fn().mockResolvedValue({ version: 1, managed: {} }),
  saveManagedState: vi.fn().mockResolvedValue(undefined),
  getManagedNames: vi.fn().mockReturnValue([]),
  setManagedNames: vi.fn(),
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
  getCopilotCliConfigPath: mocks.getCopilotCliConfigPath,
  getCopilotVsCodeConfigPath: mocks.getCopilotVsCodeConfigPath,
  getRepoCodexConfigPath: mocks.getRepoCodexConfigPath,
  getRepoClaudeConfigPath: mocks.getRepoClaudeConfigPath,
  getRepoGeminiConfigPath: mocks.getRepoGeminiConfigPath,
  getRepoCopilotCliConfigPath: mocks.getRepoCopilotCliConfigPath,
  getRepoCopilotVsCodeConfigPath: mocks.getRepoCopilotVsCodeConfigPath,
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
    mocks.getCopilotCliConfigPath.mockReturnValue("/tmp/copilot-mcp.json");
    mocks.getCopilotVsCodeConfigPath.mockReturnValue("/tmp/vscode-mcp.json");
    mocks.getRepoCodexConfigPath.mockReturnValue("/repo/.codex/config.toml");
    mocks.getRepoClaudeConfigPath.mockReturnValue("/repo/.mcp.json");
    mocks.getRepoGeminiConfigPath.mockReturnValue("/repo/.gemini/settings.json");
    mocks.getRepoCopilotCliConfigPath.mockReturnValue("/repo/.github/mcp.json");
    mocks.getRepoCopilotVsCodeConfigPath.mockReturnValue("/repo/.vscode/mcp.json");

    mocks.readCodexConfig.mockResolvedValue("model = \"gpt-5\"\n");
    mocks.readClaudeConfig.mockResolvedValue({ theme: "dark" });
    mocks.readGeminiConfig.mockResolvedValue({ theme: "light" });
    mocks.readCopilotCliConfig.mockResolvedValue({ theme: "dark" });
    mocks.readCopilotVsCodeConfig.mockResolvedValue({ inputs: [] });

    mocks.mergeCodexConfig.mockReturnValue("codex-next");
    mocks.renderClaudeConfig.mockReturnValue({ mcpServers: { github: { command: "npx" } } });
    mocks.renderGeminiConfig.mockReturnValue({ mcpServers: { github: { command: "npx" } } });
    mocks.renderCopilotCliConfig.mockReturnValue({ mcpServers: { github: { command: "npx" } } });
    mocks.renderCopilotVsCodeConfig.mockReturnValue({ servers: { github: { command: "npx" } } });

    mocks.createBackupIfExists
      .mockResolvedValueOnce("/tmp/codex.toml.bak")
      .mockResolvedValueOnce("/tmp/claude.json.bak")
      .mockResolvedValueOnce("/tmp/gemini.json.bak")
      .mockResolvedValueOnce("/tmp/copilot-mcp.json.bak")
      .mockResolvedValueOnce("/tmp/vscode-mcp.json.bak")
      .mockResolvedValueOnce("/repo/.codex/config.toml.bak")
      .mockResolvedValueOnce("/repo/.mcp.json.bak")
      .mockResolvedValueOnce("/repo/.gemini/settings.json.bak")
      .mockResolvedValueOnce("/repo/.github/mcp.json.bak")
      .mockResolvedValueOnce("/repo/.vscode/mcp.json.bak");
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

    expect(mocks.createBackupIfExists).toHaveBeenCalledTimes(10);
    expect(mocks.writeFileAtomic).toHaveBeenCalledTimes(10);
    expect(result.targets.map((target) => `${target.client}:${target.scope}`)).toEqual([
      "codex:global",
      "claude:global",
      "gemini:global",
      "copilot-cli:global",
      "copilot-vscode:global",
      "codex:repo",
      "claude:repo",
      "gemini:repo",
      "copilot-cli:repo",
      "copilot-vscode:repo",
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
    ).rejects.toThrow("apply: failed to update copilot-vscode config; restored previous state.");

    expect(mocks.restoreFromBackupOrRemove).toHaveBeenCalledTimes(10);
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(1, "/tmp/codex.toml", "/tmp/codex.toml.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(2, "/tmp/claude.json", "/tmp/claude.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(3, "/tmp/gemini.json", "/tmp/gemini.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(4, "/tmp/copilot-mcp.json", "/tmp/copilot-mcp.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(5, "/tmp/vscode-mcp.json", "/tmp/vscode-mcp.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(6, "/repo/.codex/config.toml", "/repo/.codex/config.toml.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(7, "/repo/.mcp.json", "/repo/.mcp.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(8, "/repo/.gemini/settings.json", "/repo/.gemini/settings.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(9, "/repo/.github/mcp.json", "/repo/.github/mcp.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(10, "/repo/.vscode/mcp.json", "/repo/.vscode/mcp.json.bak");
  });

  it("writes only the selected clients when apply options narrow the target set", async () => {
    const result = await applyResolvedServers(
      {
        repoPath: "/repo",
        matchedRepo: true,
        warnings: [],
        tags: ["medusajs"],
        globalServers: [githubServer],
        repoScopedServers: [medusaServer],
        servers: [githubServer, medusaServer],
      },
      { clients: ["claude"] },
    );

    expect(mocks.createBackupIfExists).toHaveBeenCalledTimes(2);
    expect(mocks.writeFileAtomic).toHaveBeenCalledTimes(2);
    expect(result.targets.map((target) => `${target.client}:${target.scope}`)).toEqual(["claude:global", "claude:repo"]);
  });

  it("does not read configs for clients outside the selected target set", async () => {
    mocks.readGeminiConfig.mockRejectedValue(new Error("should not read gemini"));
    mocks.readCopilotCliConfig.mockRejectedValue(new Error("should not read copilot-cli"));
    mocks.readCopilotVsCodeConfig.mockRejectedValue(new Error("should not read copilot-vscode"));

    const result = await applyResolvedServers(
      {
        repoPath: "/repo",
        matchedRepo: true,
        warnings: [],
        tags: ["medusajs"],
        globalServers: [githubServer],
        repoScopedServers: [medusaServer],
        servers: [githubServer, medusaServer],
      },
      { clients: ["codex"] },
    );

    expect(mocks.readGeminiConfig).not.toHaveBeenCalled();
    expect(mocks.readCopilotCliConfig).not.toHaveBeenCalled();
    expect(mocks.readCopilotVsCodeConfig).not.toHaveBeenCalled();
    expect(result.targets.map((target) => `${target.client}:${target.scope}`)).toEqual(["codex:global", "codex:repo"]);
  });
});
