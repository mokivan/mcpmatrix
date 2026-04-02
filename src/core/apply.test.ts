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
}));

import { applyResolvedServers } from "./apply";

describe("applyResolvedServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCodexConfigPath.mockReturnValue("/tmp/codex.toml");
    mocks.getClaudeConfigPath.mockReturnValue("/tmp/claude.json");
    mocks.getGeminiConfigPath.mockReturnValue("/tmp/gemini.json");

    mocks.readCodexConfig.mockResolvedValue("model = \"gpt-5\"\n");
    mocks.readClaudeConfig.mockResolvedValue({ theme: "dark" });
    mocks.readGeminiConfig.mockResolvedValue({ theme: "light" });

    mocks.mergeCodexConfig.mockReturnValue("codex-next");
    mocks.renderClaudeConfig.mockReturnValue({ mcpServers: { github: { command: "npx" } } });
    mocks.renderGeminiConfig.mockReturnValue({ mcpServers: { github: { command: "npx" } } });

    mocks.createBackupIfExists
      .mockResolvedValueOnce("/tmp/codex.toml.bak")
      .mockResolvedValueOnce("/tmp/claude.json.bak")
      .mockResolvedValueOnce("/tmp/gemini.json.bak");
    mocks.writeFileAtomic.mockResolvedValue(undefined);
    mocks.restoreFromBackupOrRemove.mockResolvedValue(undefined);
  });

  it("writes all targets after preparing backups", async () => {
    const result = await applyResolvedServers([
      {
        name: "github",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {},
      },
    ]);

    expect(mocks.createBackupIfExists).toHaveBeenCalledTimes(3);
    expect(mocks.writeFileAtomic).toHaveBeenCalledTimes(3);
    expect(result.targets.map((target) => target.client)).toEqual(["codex", "claude", "gemini"]);
    expect(result.rollbackPerformed).toBe(false);
  });

  it("rolls back every target if a later write fails", async () => {
    mocks.writeFileAtomic
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("disk full"));

    await expect(
      applyResolvedServers([
        {
          name: "github",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: {},
        },
      ]),
    ).rejects.toThrow("apply: failed to update gemini config; restored previous state.");

    expect(mocks.restoreFromBackupOrRemove).toHaveBeenCalledTimes(3);
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(1, "/tmp/codex.toml", "/tmp/codex.toml.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(2, "/tmp/claude.json", "/tmp/claude.json.bak");
    expect(mocks.restoreFromBackupOrRemove).toHaveBeenNthCalledWith(3, "/tmp/gemini.json", "/tmp/gemini.json.bak");
  });
});
