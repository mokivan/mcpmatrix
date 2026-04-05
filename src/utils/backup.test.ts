import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackupIfExists, getLatestBackup, listBackups, resolveBackupSelection, restoreFromBackupOrRemove, writeFileAtomic } from "./backup";
import { getBackupsDir } from "./paths";

const tempPaths: string[] = [];
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

function trackPath(targetPath: string): void {
  tempPaths.push(targetPath);
}

afterEach(async () => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;

  while (tempPaths.length > 0) {
    const targetPath = tempPaths.pop();
    if (targetPath && fs.existsSync(targetPath)) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
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
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  trackPath(tempHome);
  return tempHome;
}

describe("createBackupIfExists", () => {
  it("stores versioned backups under ~/.mcpmatrix/backups", async () => {
    await createTempHome();
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");
    const backupPath = await createBackupIfExists(configPath);

    expect(backupPath).toContain(getBackupsDir());
    expect(path.basename(backupPath ?? "")).toMatch(/^config-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(?:-\d+)?\.toml$/);
    expect(fs.readFileSync(backupPath ?? "", "utf8")).toBe("model = \"gpt-5\"\n");
  });

  it("sanitizes dotfile names when creating versioned backups", async () => {
    await createTempHome();
    const claudePath = await createTempFile(".claude.json", "{\n  \"mcpServers\": {}\n}\n");
    const backupPath = await createBackupIfExists(claudePath);

    expect(path.basename(backupPath ?? "")).toMatch(/^claude-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(?:-\d+)?\.json$/);
    expect(fs.readFileSync(backupPath ?? "", "utf8")).toContain("\"mcpServers\"");
  });

  it("retains only the latest three backups per target stem", async () => {
    await createTempHome();
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");

    for (let index = 0; index < 4; index += 1) {
      await fs.promises.writeFile(configPath, `model = "gpt-${index}"\n`, "utf8");
      await createBackupIfExists(configPath);
    }

    const backups = (await fs.promises.readdir(getBackupsDir())).filter((entry) => entry.startsWith("config-"));
    expect(backups).toHaveLength(3);
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
    expect((await getLatestBackup("codex"))?.backupPath).toBe(codexBackup);
    expect((await getLatestBackup("claude"))?.backupPath).toBe(claudeBackup);
  });

  it("resolves a backup by file name inside the backups directory", async () => {
    await createTempHome();
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");
    const backupPath = await createBackupIfExists(configPath);

    const resolved = await resolveBackupSelection(path.basename(backupPath ?? ""));

    expect(resolved.client).toBe("codex");
    expect(resolved.backupPath).toBe(backupPath);
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
