import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackupIfExists, restoreFromBackupOrRemove, writeFileAtomic } from "./backup";

const tempPaths: string[] = [];

afterEach(async () => {
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
  tempPaths.push(path.dirname(filePath));
  tempPaths.push(filePath);
  tempPaths.push(`${filePath}.bak`);
  return filePath;
}

describe("createBackupIfExists", () => {
  it("appends .bak to the full filename", async () => {
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");
    const backupPath = await createBackupIfExists(configPath);

    expect(backupPath).toBe(`${configPath}.bak`);
    expect(fs.readFileSync(`${configPath}.bak`, "utf8")).toBe("model = \"gpt-5\"\n");
  });

  it("preserves dotfile names when appending .bak", async () => {
    const claudePath = await createTempFile(".claude.json", "{\n  \"mcpServers\": {}\n}\n");
    const backupPath = await createBackupIfExists(claudePath);

    expect(backupPath).toBe(`${claudePath}.bak`);
    expect(fs.readFileSync(`${claudePath}.bak`, "utf8")).toContain("\"mcpServers\"");
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
    const configPath = await createTempFile("config.toml", "model = \"gpt-5\"\n");
    const backupPath = await createBackupIfExists(configPath);

    await writeFileAtomic(configPath, "model = \"gpt-5.4\"\n");
    await restoreFromBackupOrRemove(configPath, backupPath);

    expect(fs.readFileSync(configPath, "utf8")).toBe("model = \"gpt-5\"\n");
  });

  it("removes a newly created file when no backup exists", async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-backup-"));
    tempPaths.push(tempDir);
    const filePath = path.join(tempDir, "generated.json");

    await writeFileAtomic(filePath, "{\n  \"mcpServers\": {}\n}\n");
    await restoreFromBackupOrRemove(filePath, null);

    expect(fs.existsSync(filePath)).toBe(false);
  });
});
