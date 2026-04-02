import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackupIfExists } from "./backup";

const tempPaths: string[] = [];

afterEach(async () => {
  while (tempPaths.length > 0) {
    const targetPath = tempPaths.pop();
    if (targetPath && fs.existsSync(targetPath)) {
      await fs.promises.rm(targetPath, { force: true });
    }
  }
});

async function createTempFile(fileName: string, contents: string): Promise<string> {
  const filePath = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-backup-")), fileName);
  await fs.promises.writeFile(filePath, contents, "utf8");
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
});
