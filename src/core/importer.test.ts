import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importExistingConfigs, writeImportedConfig } from "./importer";

const tempDirs: string[] = [];
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
});

afterEach(async () => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;

  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  }
});

async function createTempHome(): Promise<string> {
  const tempHome = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-import-"));
  tempDirs.push(tempHome);
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  return tempHome;
}

describe("importer", () => {
  it("imports stdio servers from codex config.toml", async () => {
    const homeDir = await createTempHome();

    await fs.promises.mkdir(path.join(homeDir, ".codex"), { recursive: true });
    await fs.promises.writeFile(
      path.join(homeDir, ".codex", "config.toml"),
      `[mcp_servers.github]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
env = { GITHUB_TOKEN = "\${env:GITHUB_TOKEN}" }
`,
      "utf8",
    );

    const imported = await importExistingConfigs();

    expect(imported.importedSources.map((source) => source.client)).toEqual(["codex"]);
    expect(imported.config.servers.github).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
      },
    });
  });

  it("imports remote url servers from codex config.toml", async () => {
    const homeDir = await createTempHome();

    await fs.promises.mkdir(path.join(homeDir, ".codex"), { recursive: true });
    await fs.promises.writeFile(
      path.join(homeDir, ".codex", "config.toml"),
      `[mcp_servers.medusa]
url = "https://docs.medusajs.com/mcp"
`,
      "utf8",
    );

    const imported = await importExistingConfigs();

    expect(imported.config.servers.medusa).toEqual({
      transport: "remote",
      protocol: "auto",
      url: "https://docs.medusajs.com/mcp",
      headers: {},
    });
  });

  it("imports legacy array-based codex servers for backward compatibility", async () => {
    const homeDir = await createTempHome();

    await fs.promises.mkdir(path.join(homeDir, ".codex"), { recursive: true });
    await fs.promises.writeFile(
      path.join(homeDir, ".codex", "config.toml"),
      `[[mcp_servers]]
name = "github"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
`,
      "utf8",
    );

    const imported = await importExistingConfigs();

    expect(imported.config.servers.github).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {},
    });
  });

  it("imports stdio and remote servers from claude and gemini configs", async () => {
    const homeDir = await createTempHome();

    await fs.promises.writeFile(
      path.join(homeDir, ".claude.json"),
      JSON.stringify(
        {
          mcpServers: {
            github: {
              type: "stdio",
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-github"],
              env: {
                GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
              },
            },
            medusa: {
              type: "http",
              url: "https://docs.medusajs.com/mcp",
              headers: {
                Authorization: "Bearer ${env:MEDUSA_TOKEN}",
              },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await fs.promises.mkdir(path.join(homeDir, ".gemini"), { recursive: true });
    await fs.promises.writeFile(
      path.join(homeDir, ".gemini", "settings.json"),
      JSON.stringify(
        {
          mcpServers: {
            browser: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-browser"],
              env: {},
            },
            remoteBrowser: {
              httpUrl: "https://example.com/mcp",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const imported = await importExistingConfigs();

    expect(imported.importedSources.map((source) => source.client)).toEqual(["claude", "gemini"]);
    expect(Object.keys(imported.config.servers)).toEqual(["github", "medusa", "browser", "remoteBrowser"]);
    expect(imported.config.servers.medusa.transport).toBe("remote");
    expect(imported.config.servers.remoteBrowser.transport).toBe("remote");
  });

  it("imports JSON client configs with a UTF-8 BOM", async () => {
    const homeDir = await createTempHome();

    await fs.promises.writeFile(
      path.join(homeDir, ".claude.json"),
      `\uFEFF${JSON.stringify(
        {
          mcpServers: {
            github: {
              command: "node",
              args: ["--version"],
              env: {},
            },
          },
        },
        null,
        2,
      )}`,
      "utf8",
    );

    const imported = await importExistingConfigs();

    expect(imported.importedSources.map((source) => source.client)).toEqual(["claude"]);
    expect(imported.config.servers.github.transport).toBe("stdio");
  });

  it("merges identical imported definitions regardless of key order", async () => {
    const homeDir = await createTempHome();

    await fs.promises.writeFile(
      path.join(homeDir, ".claude.json"),
      JSON.stringify(
        {
          mcpServers: {
            medusa: {
              type: "http",
              url: "https://docs.medusajs.com/mcp",
              headers: {
                EXTRA_TOKEN: "${env:EXTRA_TOKEN}",
                GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
              },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await fs.promises.mkdir(path.join(homeDir, ".gemini"), { recursive: true });
    await fs.promises.writeFile(
      path.join(homeDir, ".gemini", "settings.json"),
      JSON.stringify(
        {
          mcpServers: {
            medusa: {
              httpUrl: "https://docs.medusajs.com/mcp",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(importExistingConfigs()).rejects.toThrow("Conflicting definitions");
  });

  it("fails when the same server name maps to different definitions", async () => {
    const homeDir = await createTempHome();

    await fs.promises.writeFile(
      path.join(homeDir, ".claude.json"),
      JSON.stringify(
        {
          mcpServers: {
            github: {
              command: "npx",
              args: ["github"],
              env: {},
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await fs.promises.mkdir(path.join(homeDir, ".gemini"), { recursive: true });
    await fs.promises.writeFile(
      path.join(homeDir, ".gemini", "settings.json"),
      JSON.stringify(
        {
          mcpServers: {
            github: {
              httpUrl: "https://example.com/mcp",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(importExistingConfigs()).rejects.toThrow("Conflicting definitions");
  });

  it("refuses to overwrite an existing canonical config", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".mcpmatrix", "config.yml");

    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, "servers: {}\n", "utf8");

    await expect(
      writeImportedConfig(
        {
          servers: {
            github: {
              transport: "stdio",
              command: "npx",
            },
          },
          scopes: {
            global: {
              enable: ["github"],
            },
            tags: {},
            repos: {},
          },
        },
        configPath,
      ),
    ).rejects.toThrow(`Configuration file already exists: ${configPath}`);
  });
});
