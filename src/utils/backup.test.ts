import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackupIfExists, getLatestBackup, listBackups, resolveBackupSelection, restoreFromBackupOrRemove, writeFileAtomic } from "./backup";
import { getBackupsDir } from "./paths";

const tempPaths: string[] = [];
let originalHome: string | undefined;
let originalUserProfile: string | undefined;
let originalAppData: string | undefined;
let originalXdgConfigHome: string | undefined;

function trackPath(targetPath: string): void {
  tempPaths.push(targetPath);
}

afterEach(async () => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  process.env.APPDATA = originalAppData;
  process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

  while (tempPaths.length > 0) {
    const targetPath = tempPaths.pop();
    if (targetPath && fs.existsSync(targetPath)) {
      await fs.promises.rm(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  }
});

async function createTempFile(fileName: string, contents: string): Promise<string> {
  const filePath = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-backup-")), fileName);
  await fs.promises.writeFile(filePath, contents, "utf8");
  trackPath(path.dirname(filePath));
  trackPath(filePath);
  return filePath;
}

async function createTempHome(): Promise<string> {
  const tempHome = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-home-"));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  originalAppData = process.env.APPDATA;
  originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  process.env.APPDATA = path.join(tempHome, "AppData", "Roaming");
  process.env.XDG_CONFIG_HOME = path.join(tempHome, ".config");
  trackPath(tempHome);
  return tempHome;
}

describe("createBackupIfExists", () => {
  it("stores versioned backups under ~/.mcpmatrix/backups", async () => {
    await createTempHome();
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");
    const backupPath = await createBackupIfExists(configPath);

    expect(backupPath).toContain(getBackupsDir());
    expect(path.basename(backupPath ?? "")).toMatch(/^codex-global-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(?:-\d+)?\.toml$/);
    expect(fs.readFileSync(backupPath ?? "", "utf8")).toBe("model = \"gpt-5\"\n");
    expect(fs.existsSync(`${backupPath}.meta.json`)).toBe(true);
  });

  it("sanitizes dotfile names when creating versioned backups", async () => {
    await createTempHome();
    const claudePath = await createTempFile(".claude.json", "{\n  \"mcpServers\": {}\n}\n");
    const backupPath = await createBackupIfExists(claudePath);

    expect(path.basename(backupPath ?? "")).toMatch(/^claude-global-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(?:-\d+)?\.json$/);
    expect(fs.readFileSync(backupPath ?? "", "utf8")).toContain("\"mcpServers\"");
  });

  it("creates versioned backup names for copilot clients", async () => {
    await createTempHome();
    const copilotCliPath = await createTempFile("mcp-config.json", "{\n  \"mcpServers\": {}\n}\n");
    const copilotVsCodePath = await createTempFile("mcp.json", "{\n  \"servers\": {}\n}\n");

    const copilotCliBackup = await createBackupIfExists(copilotCliPath, {
      client: "copilot-cli",
      scope: "global",
    });
    const copilotVsCodeBackup = await createBackupIfExists(copilotVsCodePath, {
      client: "copilot-vscode",
      scope: "global",
    });

    expect(path.basename(copilotCliBackup ?? "")).toMatch(/^copilot-cli-global-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(?:-\d+)?\.json$/);
    expect(path.basename(copilotVsCodeBackup ?? "")).toMatch(/^copilot-vscode-global-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(?:-\d+)?\.json$/);
  });

  it("retains the latest three backups per target stem plus the original one", async () => {
    await createTempHome();
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");

    for (let index = 0; index < 5; index += 1) {
      await fs.promises.writeFile(configPath, `model = "gpt-${index}"\n`, "utf8");
      await createBackupIfExists(configPath);
    }

    const backups = (await fs.promises.readdir(getBackupsDir())).filter(
      (entry) => entry.startsWith("codex-global-") && !entry.endsWith(".meta.json"),
    );
    expect(backups).toHaveLength(4);
  });

  it("lists backups grouped by client metadata and resolves the latest one", async () => {
    await createTempHome();
    const codexPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");
    const claudePath = await createTempFile(".claude.json", "{\n  \"mcpServers\": {}\n}\n");

    const codexBackup = await createBackupIfExists(codexPath);
    const claudeBackup = await createBackupIfExists(claudePath);
    const backups = await listBackups();

    expect(backups.map((entry) => entry.client).sort()).toEqual(["claude", "codex"]);
    expect(backups.some((entry) => entry.backupPath === claudeBackup)).toBe(true);
    expect(backups.some((entry) => entry.backupPath === codexBackup)).toBe(true);
    expect((await getLatestBackup({ client: "codex" }))?.backupPath).toBe(codexBackup);
    expect((await getLatestBackup({ client: "claude" }))?.backupPath).toBe(claudeBackup);
  });

  it("resolves a backup by file name inside the backups directory", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".codex", "config.toml");
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, "model = \"gpt-5\"\n", "utf8");
    const backupPath = await createBackupIfExists(configPath);

    const resolved = await resolveBackupSelection(path.basename(backupPath ?? ""));

    expect(resolved.client).toBe("codex");
    expect(resolved.backupPath).toBe(backupPath);
  });

  it("never rotates out the original backup", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".codex", "config.toml");
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });

    for (let version = 0; version < 6; version += 1) {
      await fs.promises.writeFile(configPath, `version = ${version}\n`, "utf8");
      await createBackupIfExists(configPath);
    }

    const backups = await listBackups({ client: "codex", scope: "global" });
    const contents = await Promise.all(backups.map((entry) => fs.promises.readFile(entry.backupPath, "utf8")));

    expect(backups).toHaveLength(4);
    expect(contents).toContain("version = 0\n");
    expect(contents).toContain("version = 5\n");
  });

  it("rejects backup selections outside the backups directory", async () => {
    const homeDir = await createTempHome();
    const outsidePath = path.join(homeDir, "outside.toml");
    await fs.promises.writeFile(outsidePath, "x = 1\n", "utf8");

    await expect(resolveBackupSelection(outsidePath)).rejects.toThrow("Backup must be inside");
    await expect(resolveBackupSelection(path.join("..", "outside.toml"))).rejects.toThrow("Backup must be inside");
  });

  it("rejects backups whose metadata points at an unexpected target path", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".codex", "config.toml");
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, "model = \"gpt-5\"\n", "utf8");
    const backupPath = (await createBackupIfExists(configPath)) ?? "";

    const metaPath = `${backupPath}.meta.json`;
    const metadata = JSON.parse(await fs.promises.readFile(metaPath, "utf8")) as { filePath: string };
    metadata.filePath = path.join(homeDir, "somewhere", "else.json");
    await fs.promises.writeFile(metaPath, JSON.stringify(metadata), "utf8");

    await expect(resolveBackupSelection(path.basename(backupPath))).rejects.toThrow("unexpected path");
  });

  it.skipIf(process.platform === "win32")("keeps the destination permissions when replacing a file", async () => {
    const configPath = await createTempFile("config.toml", "a = 1\n");
    await fs.promises.chmod(configPath, 0o600);

    await writeFileAtomic(configPath, "a = 2\n");

    expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
  });

  it("creates new files and replaces existing ones", async () => {
    const configPath = await createTempFile("config.toml", "a = 1\n");
    await fs.promises.rm(configPath);

    await writeFileAtomic(configPath, "a = 2\n");
    await writeFileAtomic(configPath, "a = 3\n");

    expect(fs.readFileSync(configPath, "utf8")).toBe("a = 3\n");
  });

  it("filters repo-scoped backups by repo path", async () => {
    await createTempHome();
    const repoConfigPath = await createTempFile("settings.json", "{\n  \"mcpServers\": {}\n}\n");

    await createBackupIfExists(repoConfigPath, {
      client: "gemini",
      scope: "repo",
      repoPath: "/repo",
    });

    const repoBackups = await listBackups({ client: "gemini", scope: "repo", repoPath: "/repo" });
    expect(repoBackups).toHaveLength(1);
    expect(repoBackups[0]?.scope).toBe("repo");
    expect(repoBackups[0]?.repoPath).toBe("/repo");
  });

  it("writes files through a temp file and replaces the target content", async () => {
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");

    await writeFileAtomic(configPath, "model = \"gpt-5.4\"\n");

    expect(fs.readFileSync(configPath, "utf8")).toBe("model = \"gpt-5.4\"\n");
    expect(
      fs.readdirSync(path.dirname(configPath)).some((entry) => entry.endsWith(".tmp")),
    ).toBe(false);
  });

  it("restores a file from backup when rollback is needed", async () => {
    await createTempHome();
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");
    const backupPath = await createBackupIfExists(configPath);

    await writeFileAtomic(configPath, "model = \"gpt-5.4\"\n");
    await restoreFromBackupOrRemove(configPath, backupPath);

    expect(fs.readFileSync(configPath, "utf8")).toBe("model = \"gpt-5\"\n");
  });

  it("removes a newly created file when no backup exists", async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-backup-"));
    trackPath(tempDir);
    const filePath = path.join(tempDir, "generated.json");

    await writeFileAtomic(filePath, "{\n  \"mcpServers\": {}\n}\n");
    await restoreFromBackupOrRemove(filePath, null);

    expect(fs.existsSync(filePath)).toBe(false);
  });
});
