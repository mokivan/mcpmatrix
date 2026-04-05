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
  it("loads a valid stdio config", async () => {
    const configPath = await writeConfig(`servers:
  github:
    transport: stdio
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

    expect(config.servers.github.transport).toBe("stdio");
    expect(config.scopes?.global?.enable).toEqual(["github"]);
  });

  it("loads a valid remote config with interpolated headers", async () => {
    const configPath = await writeConfig(`servers:
  sentry:
    transport: remote
    protocol: http
    url: https://mcp.sentry.dev/mcp
    headers:
      Authorization: Bearer \${env:SENTRY_TOKEN}
    auth:
      type: oauth
      clientId: \${env:SENTRY_CLIENT_ID}
      callbackPort: 8080
scopes:
  global:
    enable:
      - sentry
`);

    const config = await loadConfig(configPath);

    expect(config.servers.sentry.transport).toBe("remote");
    if (config.servers.sentry.transport === "remote") {
      expect(config.servers.sentry.headers?.Authorization).toBe("Bearer ${env:SENTRY_TOKEN}");
      expect(config.servers.sentry.auth?.type).toBe("oauth");
    }
  });

  it("loads a valid config with a UTF-8 BOM", async () => {
    const configPath = await writeConfig(`\uFEFFservers:
  github:
    transport: stdio
    command: npx
scopes:
  global:
    enable:
      - github
`);

    const config = await loadConfig(configPath);

    expect(config.servers.github.transport).toBe("stdio");
  });

  it("writes an initial config with a yaml-language-server schema header", async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-config-"));
    const configPath = path.join(tempDir, "config.yml");
    tempDirs.push(tempDir);

    const { writeInitialConfig } = await import("./config-loader");
    await writeInitialConfig(configPath);

    const contents = await fs.promises.readFile(configPath, "utf8");
    expect(contents.startsWith("# yaml-language-server: $schema=file:///")).toBe(true);
    expect(contents).toContain("transport: stdio");
  });

  it("rejects invalid YAML with a file-specific error", async () => {
    const configPath = await writeConfig("servers: [\n");

    await expect(loadConfig(configPath)).rejects.toThrow(`Invalid YAML in configuration file ${configPath}`);
  });

  it("rejects undefined server references during config load", async () => {
    const configPath = await writeConfig(`servers:
  github:
    transport: stdio
    command: npx
scopes:
  global:
    enable:
      - browser
`);

    await expect(loadConfig(configPath)).rejects.toThrow("references undefined server 'browser'");
  });

  it("rejects mixed stdio and remote fields", async () => {
    const configPath = await writeConfig(`servers:
  github:
    transport: stdio
    command: npx
    url: https://example.com/mcp
scopes:
  global:
    enable:
      - github
`);

    await expect(loadConfig(configPath)).rejects.toThrow("stdio servers must not define remote-only fields");
  });

  it("rejects invalid env reference syntax in any string field", async () => {
    const configPath = await writeConfig(`servers:
  sentry:
    transport: remote
    protocol: http
    url: https://mcp.sentry.dev/mcp
    headers:
      Authorization: Bearer \${bad:SENTRY_TOKEN}
scopes:
  global:
    enable:
      - sentry
`);

    await expect(loadConfig(configPath)).rejects.toThrow("env references must use the form");
  });
});
