import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commandExists: vi.fn(),
  getCodexConfigPath: vi.fn(),
  getClaudeConfigPath: vi.fn(),
  getGeminiConfigPath: vi.fn(),
  getRepoCodexConfigPath: vi.fn(),
  getRepoClaudeConfigPath: vi.fn(),
  getRepoGeminiConfigPath: vi.fn(),
}));

vi.mock("./config-validator", () => ({
  commandExists: mocks.commandExists,
}));

vi.mock("../utils/paths", () => ({
  getCodexConfigPath: mocks.getCodexConfigPath,
  getClaudeConfigPath: mocks.getClaudeConfigPath,
  getGeminiConfigPath: mocks.getGeminiConfigPath,
  getRepoCodexConfigPath: mocks.getRepoCodexConfigPath,
  getRepoClaudeConfigPath: mocks.getRepoClaudeConfigPath,
  getRepoGeminiConfigPath: mocks.getRepoGeminiConfigPath,
}));

import { parseClientSelection, resolveClientSelection } from "./client-selection";

let tempDir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-client-selection-"));

  mocks.commandExists.mockReturnValue(false);
  mocks.getCodexConfigPath.mockReturnValue(path.join(tempDir, ".codex", "config.toml"));
  mocks.getClaudeConfigPath.mockReturnValue(path.join(tempDir, ".claude.json"));
  mocks.getGeminiConfigPath.mockReturnValue(path.join(tempDir, ".gemini", "settings.json"));
  mocks.getRepoCodexConfigPath.mockImplementation((repoPath: string) => path.join(repoPath, ".codex", "config.toml"));
  mocks.getRepoClaudeConfigPath.mockImplementation((repoPath: string) => path.join(repoPath, ".mcp.json"));
  mocks.getRepoGeminiConfigPath.mockImplementation((repoPath: string) => path.join(repoPath, ".gemini", "settings.json"));
});

afterEach(async () => {
  if (tempDir && fs.existsSync(tempDir)) {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});

describe("client selection", () => {
  it("parses an explicit client list and removes duplicates", () => {
    const selection = parseClientSelection("codex, gemini, codex");

    expect(selection.mode).toBe("explicit");
    expect(selection.clients).toEqual(["codex", "gemini"]);
  });

  it("rejects unsupported clients", () => {
    expect(() => parseClientSelection("codex,unknown")).toThrow("unsupported client(s): unknown");
  });

  it("auto-selects clients with existing config files or detected CLI commands", async () => {
    const repoDir = path.join(tempDir, "repo");
    const claudeConfigPath = path.join(tempDir, ".claude.json");
    await fs.promises.mkdir(repoDir, { recursive: true });
    await fs.promises.writeFile(claudeConfigPath, "{\n  \"mcpServers\": {}\n}\n", "utf8");
    mocks.commandExists.mockImplementation((command: string) => command === "gemini");

    const resolved = resolveClientSelection(parseClientSelection("auto"), {
      repoPath: repoDir,
      matchedRepo: true,
    });

    expect(resolved.mode).toBe("auto");
    expect(resolved.clients).toEqual(["claude", "gemini"]);
    expect(resolved.detections).toEqual([
      expect.objectContaining({ client: "codex", selected: false, configured: false, installed: false }),
      expect.objectContaining({ client: "claude", selected: true, configured: true, installed: false }),
      expect.objectContaining({ client: "gemini", selected: true, configured: false, installed: true }),
    ]);
  });
});
