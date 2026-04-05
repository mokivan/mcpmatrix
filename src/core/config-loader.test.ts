import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config-loader";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  }
});

async function writeConfig(contents: string): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-config-"));
  const configPath = path.join(tempDir, "config.yml");
  tempDirs.push(tempDir);
  await fs.promises.writeFile(configPath, contents, "utf8");
  return configPath;
}

describe("loadConfig", () => {
  it("loads a valid config", async () => {
    const configPath = await writeConfig(`servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: \${env:GITHUB_TOKEN}
scopes:
  global:
    enable:
      - github
`);

    const config = await loadConfig(configPath);

    expect(config.servers.github.command).toBe("npx");
    expect(config.scopes?.global?.enable).toEqual(["github"]);
  });

  it("loads a valid config with a UTF-8 BOM", async () => {
    const configPath = await writeConfig(`\uFEFFservers:
  github:
    command: npx
scopes:
  global:
    enable:
      - github
`);

    const config = await loadConfig(configPath);

    expect(config.servers.github.command).toBe("npx");
  });

  it("writes an initial config with a yaml-language-server schema header", async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-config-"));
    const configPath = path.join(tempDir, "config.yml");
    tempDirs.push(tempDir);

    const { writeInitialConfig } = await import("./config-loader");
    await writeInitialConfig(configPath);

    const contents = await fs.promises.readFile(configPath, "utf8");
    expect(contents.startsWith("# yaml-language-server: $schema=file:///")).toBe(true);
  });

  it("rejects invalid YAML with a file-specific error", async () => {
    const configPath = await writeConfig("servers: [\n");

    await expect(loadConfig(configPath)).rejects.toThrow(`Invalid YAML in configuration file ${configPath}`);
  });

  it("rejects undefined server references during config load", async () => {
    const configPath = await writeConfig(`servers:
  github:
    command: npx
scopes:
  global:
    enable:
      - browser
`);

    await expect(loadConfig(configPath)).rejects.toThrow("references undefined server 'browser'");
  });

  it("rejects invalid env reference syntax", async () => {
    const configPath = await writeConfig(`servers:
  github:
    command: npx
    env:
      GITHUB_TOKEN: \${bad:GITHUB_TOKEN}
`);

    await expect(loadConfig(configPath)).rejects.toThrow("env references must use the form");
  });
});
