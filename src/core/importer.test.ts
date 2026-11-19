import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importExistingConfigs, writeImportedConfig } from "./importer";
import { getCopilotVsCodeConfigPath } from "../utils/paths";

const tempDirs: string[] = [];
let originalHome: string | undefined;
let originalUserProfile: string | undefined;
let originalAppData: string | undefined;
let originalXdgConfigHome: string | undefined;

beforeEach(() => {
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  originalAppData = process.env.APPDATA;
  originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
});

afterEach(async () => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  process.env.APPDATA = originalAppData;
  process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

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
  process.env.APPDATA = path.join(tempHome, "AppData", "Roaming");
  process.env.XDG_CONFIG_HOME = path.join(tempHome, ".config");
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

  it("imports copilot-cli and copilot-vscode global configs", async () => {
    const homeDir = await createTempHome();
    const vscodeConfigPath = getCopilotVsCodeConfigPath();

    await fs.promises.mkdir(path.join(homeDir, ".copilot"), { recursive: true });
    await fs.promises.writeFile(
      path.join(homeDir, ".copilot", "mcp-config.json"),
      JSON.stringify(
        {
          mcpServers: {
            playwright: {
              type: "local",
              command: "npx",
              args: ["@playwright/mcp@latest"],
              env: {},
              tools: ["*"],
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await fs.promises.mkdir(path.dirname(vscodeConfigPath), { recursive: true });
    await fs.promises.writeFile(
      vscodeConfigPath,
      JSON.stringify(
        {
          servers: {
            context7: {
              type: "http",
              url: "https://mcp.context7.com/mcp",
              headers: {
                CONTEXT7_API_KEY: "${env:CONTEXT7_API_KEY}",
              },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const imported = await importExistingConfigs();

    expect(imported.importedSources.map((source) => source.client)).toEqual(["copilot-cli", "copilot-vscode"]);
    expect(imported.config.servers.playwright).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["@playwright/mcp@latest"],
      env: {},
    });
    expect(imported.config.servers.context7).toEqual({
      transport: "remote",
      protocol: "http",
      url: "https://mcp.context7.com/mcp",
      headers: {
        CONTEXT7_API_KEY: "${env:CONTEXT7_API_KEY}",
      },
    });
  });

  it("rejects copilot-cli tool filtering because it is not representable canonically", async () => {
    const homeDir = await createTempHome();

    await fs.promises.mkdir(path.join(homeDir, ".copilot"), { recursive: true });
    await fs.promises.writeFile(
      path.join(homeDir, ".copilot", "mcp-config.json"),
      JSON.stringify(
        {
          mcpServers: {
            playwright: {
              type: "local",
              command: "npx",
              args: ["@playwright/mcp@latest"],
              env: {},
              tools: ["browser_navigate"],
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(importExistingConfigs()).rejects.toThrow("only tools [\"*\"] can be normalized");
  });

  it("rejects copilot-vscode inputs because they are not representable canonically", async () => {
    await createTempHome();
    const vscodeConfigPath = getCopilotVsCodeConfigPath();

    await fs.promises.mkdir(path.dirname(vscodeConfigPath), { recursive: true });
    await fs.promises.writeFile(
      vscodeConfigPath,
      JSON.stringify(
        {
          inputs: [
            {
              type: "promptString",
              id: "api-key",
              description: "API key",
              password: true,
            },
          ],
          servers: {
            context7: {
              type: "http",
              url: "https://mcp.context7.com/mcp",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(importExistingConfigs()).rejects.toThrow("copilot-vscode.inputs");
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

  it("fails with a clear error when the codex config.toml is malformed", async () => {
    const homeDir = await createTempHome();

    await fs.promises.mkdir(path.join(homeDir, ".codex"), { recursive: true });
    await fs.promises.writeFile(path.join(homeDir, ".codex", "config.toml"), "[mcp_servers.broken\ncommand = ", "utf8");

    await expect(importExistingConfigs()).rejects.toThrow("Invalid TOML in Codex config");
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
