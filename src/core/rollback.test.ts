import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLatestBackup: vi.fn(),
  getAllBackupTargets: vi.fn(),
  resolveBackupSelection: vi.fn(),
  writeFileAtomic: vi.fn(),
  existsSync: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("../utils/backup", () => ({
  getLatestBackup: mocks.getLatestBackup,
  getAllBackupTargets: mocks.getAllBackupTargets,
  resolveBackupSelection: mocks.resolveBackupSelection,
  writeFileAtomic: mocks.writeFileAtomic,
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mocks.existsSync,
    promises: {
      readFile: mocks.readFile,
      rm: mocks.rm,
    },
  },
}));

import { rollbackToBackup } from "./rollback";

describe("rollbackToBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllBackupTargets.mockReturnValue([
      { client: "codex", filePath: "/tmp/codex.toml", stem: "config", extension: ".toml" },
      { client: "claude", filePath: "/tmp/claude.json", stem: "claude", extension: ".json" },
      { client: "gemini", filePath: "/tmp/gemini.json", stem: "settings", extension: ".json" },
    ]);
    mocks.existsSync.mockReturnValue(true);
    mocks.readFile.mockImplementation(async (filePath: string) => Buffer.from(`contents:${filePath}`));
    mocks.writeFileAtomic.mockResolvedValue(undefined);
    mocks.rm.mockResolvedValue(undefined);
  });

  it("restores the latest backup for all clients", async () => {
    mocks.getLatestBackup
      .mockResolvedValueOnce({ client: "codex", scope: "global", filePath: "/tmp/codex.toml", backupPath: "/bak/config.toml", backupFileName: "config-1.toml", timestamp: "2026-01-01-10-00" })
      .mockResolvedValueOnce({ client: "claude", scope: "global", filePath: "/tmp/claude.json", backupPath: "/bak/claude.json", backupFileName: "claude-1.json", timestamp: "2026-01-01-10-00" })
      .mockResolvedValueOnce({ client: "gemini", scope: "global", filePath: "/tmp/gemini.json", backupPath: "/bak/settings.json", backupFileName: "settings-1.json", timestamp: "2026-01-01-10-00" });

    const result = await rollbackToBackup();

    expect(result.targets.map((target) => target.client)).toEqual(["codex", "claude", "gemini"]);
    expect(mocks.writeFileAtomic).toHaveBeenCalledTimes(3);
  });

  it("fails before mutating files when a required latest backup is missing", async () => {
    mocks.getLatestBackup
      .mockResolvedValueOnce({ client: "codex", scope: "global", filePath: "/tmp/codex.toml", backupPath: "/bak/config.toml", backupFileName: "config-1.toml", timestamp: "2026-01-01-10-00" })
      .mockResolvedValueOnce(null);

    await expect(rollbackToBackup()).rejects.toThrow("No global backup found for claude");
    expect(mocks.writeFileAtomic).not.toHaveBeenCalled();
  });

  it("restores a single explicitly selected backup", async () => {
    mocks.resolveBackupSelection.mockResolvedValue({
      client: "claude",
      scope: "global",
      filePath: "/tmp/claude.json",
      backupPath: "/bak/claude.json",
      backupFileName: "claude-1.json",
      timestamp: "2026-01-01-10-00",
    });

    const result = await rollbackToBackup({ backup: "claude-1.json" });

    expect(result.targets).toEqual([
      {
        client: "claude",
        scope: "global",
        filePath: "/tmp/claude.json",
        backupPath: "/bak/claude.json",
      },
    ]);
    expect(mocks.writeFileAtomic).toHaveBeenCalledTimes(1);
  });

  it("rejects a selected backup that does not match the requested client", async () => {
    mocks.resolveBackupSelection.mockResolvedValue({
      client: "claude",
      scope: "global",
      filePath: "/tmp/claude.json",
      backupPath: "/bak/claude.json",
      backupFileName: "claude-1.json",
      timestamp: "2026-01-01-10-00",
    });

    await expect(rollbackToBackup({ client: "codex", backup: "claude-1.json" })).rejects.toThrow(
      "does not belong to codex",
    );
  });

  it("restores already modified targets if a later rollback write fails", async () => {
    mocks.getLatestBackup
      .mockResolvedValueOnce({ client: "codex", scope: "global", filePath: "/tmp/codex.toml", backupPath: "/bak/config.toml", backupFileName: "config-1.toml", timestamp: "2026-01-01-10-00" })
      .mockResolvedValueOnce({ client: "claude", scope: "global", filePath: "/tmp/claude.json", backupPath: "/bak/claude.json", backupFileName: "claude-1.json", timestamp: "2026-01-01-10-00" })
      .mockResolvedValueOnce({ client: "gemini", scope: "global", filePath: "/tmp/gemini.json", backupPath: "/bak/settings.json", backupFileName: "settings-1.json", timestamp: "2026-01-01-10-00" });
    mocks.writeFileAtomic
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);

    await expect(rollbackToBackup()).rejects.toThrow("rollback: failed to restore backup.");
    expect(mocks.writeFileAtomic).toHaveBeenNthCalledWith(3, "/tmp/codex.toml", Buffer.from("contents:/tmp/codex.toml"));
  });

  it("restores the latest repo-scoped backups for a repository", async () => {
    mocks.getLatestBackup
      .mockResolvedValueOnce({ client: "codex", scope: "repo", filePath: "/repo/.codex/config.toml", backupPath: "/bak/codex-repo.toml", backupFileName: "codex-repo-1.toml", timestamp: "2026-01-01-10-00", repoPath: "/repo" })
      .mockResolvedValueOnce({ client: "claude", scope: "repo", filePath: "/repo/.mcp.json", backupPath: "/bak/claude-repo.json", backupFileName: "claude-repo-1.json", timestamp: "2026-01-01-10-00", repoPath: "/repo" })
      .mockResolvedValueOnce({ client: "gemini", scope: "repo", filePath: "/repo/.gemini/settings.json", backupPath: "/bak/gemini-repo.json", backupFileName: "gemini-repo-1.json", timestamp: "2026-01-01-10-00", repoPath: "/repo" });

    const result = await rollbackToBackup({ repoPath: "/repo" });

    expect(result.targets.map((target) => `${target.client}:${target.scope}`)).toEqual([
      "codex:repo",
      "claude:repo",
      "gemini:repo",
    ]);
  });
});
