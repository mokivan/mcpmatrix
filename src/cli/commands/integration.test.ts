import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runApplyCommand } from "./apply";
import { runListBackupsCommand } from "./backups";
import { runInitCommand } from "./init";
import { runPlanCommand } from "./plan";
import { runRollbackCommand } from "./rollback";
import { runSchemaCommand } from "./schema";
import {
  getBackupsDir,
  getCopilotCliConfigPath,
  getCopilotVsCodeConfigPath,
  getRepoCopilotCliConfigPath,
  getRepoCopilotVsCodeConfigPath,
} from "../../utils/paths";

const tempDirs: string[] = [];
let originalHome: string | undefined;
let originalUserProfile: string | undefined;
let originalAppData: string | undefined;
let originalXdgConfigHome: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

function trackTempDir(tempDir: string): string {
  tempDirs.push(tempDir);
  return tempDir;
}

async function createTempHome(): Promise<string> {
  const tempHome = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-home-"));
  trackTempDir(tempHome);
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  process.env.APPDATA = path.join(tempHome, "AppData", "Roaming");
  process.env.XDG_CONFIG_HOME = path.join(tempHome, ".config");
  return tempHome;
}

async function writeUserConfig(homeDir: string, contents: string): Promise<void> {
  const configPath = path.join(homeDir, ".mcpmatrix", "config.yml");
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, contents, "utf8");
}

async function createRepoDir(): Promise<string> {
  const repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-repo-"));
  await fs.promises.mkdir(path.join(repoDir, ".git"));
  return trackTempDir(repoDir);
}

beforeEach(() => {
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  originalAppData = process.env.APPDATA;
  originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(async () => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  process.env.APPDATA = originalAppData;
  process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  }
});

describe("CLI command integration", () => {
  it("creates the initial config in the user home", async () => {
    const homeDir = await createTempHome();

    await runInitCommand();

    const configPath = path.join(homeDir, ".mcpmatrix", "config.yml");
    expect(fs.existsSync(configPath)).toBe(true);
    expect(await fs.promises.readFile(configPath, "utf8")).toContain("servers:");
    expect(await fs.promises.readFile(configPath, "utf8")).toContain("# yaml-language-server: $schema=file:///");
  });

  it("prints the local schema path and URI", async () => {
    await runSchemaCommand();

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("Schema path:");
    expect(output).toContain("Schema URI:");
    expect(output).toContain("mcpmatrix-config.schema.json");
  });

  it("plans active servers and target files for an unconfigured repo", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
scopes:
  global:
    enable:
      - github
`,
    );

    await runPlanCommand({ repo: repoDir });

    expect(logSpy.mock.calls.flat().join("\n")).toContain("Active servers:");
    expect(logSpy.mock.calls.flat().join("\n")).toContain("- github [stdio] npx -y @modelcontextprotocol/server-github");
    expect(logSpy.mock.calls.flat().join("\n")).toContain(path.join(homeDir, ".codex", "config.toml"));
    expect(logSpy.mock.calls.flat().join("\n")).toContain(getCopilotCliConfigPath());
    expect(logSpy.mock.calls.flat().join("\n")).toContain(getCopilotVsCodeConfigPath());
    expect(warnSpy.mock.calls.flat().join("\n")).toContain("Repository is not configured");
  });

  it("applies config, preserves unmanaged content, and creates backups", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();
    const codexPath = path.join(homeDir, ".codex", "config.toml");
    const claudePath = path.join(homeDir, ".claude.json");
    const geminiPath = path.join(homeDir, ".gemini", "settings.json");
    const copilotCliPath = getCopilotCliConfigPath();
    const copilotVsCodePath = getCopilotVsCodeConfigPath();
    const repoCodexPath = path.join(repoDir, ".codex", "config.toml");
    const repoClaudePath = path.join(repoDir, ".mcp.json");
    const repoGeminiPath = path.join(repoDir, ".gemini", "settings.json");
    const repoCopilotCliPath = getRepoCopilotCliConfigPath(repoDir);
    const repoCopilotVsCodePath = getRepoCopilotVsCodeConfigPath(repoDir);

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: literal-token
scopes:
  global:
    enable:
      - github
  repos:
    "${repoDir.replace(/\\/g, "\\\\")}":
      tags: []
      enable: []
`,
    );

    await fs.promises.mkdir(path.dirname(codexPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(geminiPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(copilotCliPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(copilotVsCodePath), { recursive: true });
    await fs.promises.writeFile(codexPath, 'model = "gpt-5"\n', "utf8");
    await fs.promises.writeFile(claudePath, '{\n  "theme": "dark"\n}\n', "utf8");
    await fs.promises.writeFile(geminiPath, '{\n  "theme": "light"\n}\n', "utf8");
    await fs.promises.writeFile(copilotCliPath, '{\n  "theme": "dark"\n}\n', "utf8");
    await fs.promises.writeFile(copilotVsCodePath, '{\n  "inputs": []\n}\n', "utf8");

    await runApplyCommand({ repo: repoDir });

    const codexContent = await fs.promises.readFile(codexPath, "utf8");
    const claudeContent = JSON.parse(await fs.promises.readFile(claudePath, "utf8")) as {
      theme: string;
      mcpServers: Record<string, unknown>;
    };
    const geminiContent = JSON.parse(await fs.promises.readFile(geminiPath, "utf8")) as {
      theme: string;
      mcpServers: Record<string, unknown>;
    };
    const copilotCliContent = JSON.parse(await fs.promises.readFile(copilotCliPath, "utf8")) as {
      theme: string;
      mcpServers: Record<string, unknown>;
    };
    const copilotVsCodeContent = JSON.parse(await fs.promises.readFile(copilotVsCodePath, "utf8")) as {
      inputs: unknown[];
      servers: Record<string, unknown>;
    };
    const repoClaudeContent = JSON.parse(await fs.promises.readFile(repoClaudePath, "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    const repoGeminiContent = JSON.parse(await fs.promises.readFile(repoGeminiPath, "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    const repoCopilotCliContent = JSON.parse(await fs.promises.readFile(repoCopilotCliPath, "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    const repoCopilotVsCodeContent = JSON.parse(await fs.promises.readFile(repoCopilotVsCodePath, "utf8")) as {
      servers: Record<string, unknown>;
    };
    const repoCodexContent = await fs.promises.readFile(repoCodexPath, "utf8");

    expect(codexContent).toContain('model = "gpt-5"');
    expect(codexContent).toContain("[mcp_servers.\"github\"]");
    expect(claudeContent.theme).toBe("dark");
    expect(Object.keys(claudeContent.mcpServers)).toEqual(["github"]);
    expect(geminiContent.theme).toBe("light");
    expect(Object.keys(geminiContent.mcpServers)).toEqual(["github"]);
    expect(copilotCliContent.theme).toBe("dark");
    expect(Object.keys(copilotCliContent.mcpServers)).toEqual(["github"]);
    expect(copilotVsCodeContent.inputs).toEqual([]);
    expect(Object.keys(copilotVsCodeContent.servers)).toEqual(["github"]);
    expect(repoCodexContent).toContain("# No MCP servers resolved by mcpmatrix");
    expect(repoClaudeContent.mcpServers).toEqual({});
    expect(repoGeminiContent.mcpServers).toEqual({});
    expect(repoCopilotCliContent.mcpServers).toEqual({});
    expect(repoCopilotVsCodeContent.servers).toEqual({});
    const backups = await fs.promises.readdir(getBackupsDir());
    expect(backups.some((entry) => entry.startsWith("codex-global-") && entry.endsWith(".toml"))).toBe(true);
    expect(backups.some((entry) => entry.startsWith("claude-global-") && entry.endsWith(".json"))).toBe(true);
    expect(backups.some((entry) => entry.startsWith("gemini-global-") && entry.endsWith(".json"))).toBe(true);
    expect(backups.some((entry) => entry.startsWith("copilot-cli-global-") && entry.endsWith(".json"))).toBe(true);
    expect(backups.some((entry) => entry.startsWith("copilot-vscode-global-") && entry.endsWith(".json"))).toBe(true);
  });

  it("applies config when Claude and Gemini JSON files contain a UTF-8 BOM", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();
    const codexPath = path.join(homeDir, ".codex", "config.toml");
    const claudePath = path.join(homeDir, ".claude.json");
    const geminiPath = path.join(homeDir, ".gemini", "settings.json");
    const copilotCliPath = getCopilotCliConfigPath();
    const copilotVsCodePath = getCopilotVsCodeConfigPath();

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    transport: stdio
    command: node
    args: ["--version"]
scopes:
  global:
    enable:
      - github
`,
    );

    await fs.promises.mkdir(path.dirname(codexPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(geminiPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(copilotCliPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(copilotVsCodePath), { recursive: true });
    await fs.promises.writeFile(codexPath, 'model = "gpt-5"\n', "utf8");
    await fs.promises.writeFile(claudePath, `\uFEFF{"theme":"dark"}`, "utf8");
    await fs.promises.writeFile(geminiPath, `\uFEFF{"theme":"light"}`, "utf8");
    await fs.promises.writeFile(copilotCliPath, `\uFEFF{"theme":"dark"}`, "utf8");
    await fs.promises.writeFile(copilotVsCodePath, `\uFEFF{"inputs":[]}`, "utf8");

    await runApplyCommand({ repo: repoDir });

    const claudeContent = JSON.parse(await fs.promises.readFile(claudePath, "utf8")) as { mcpServers: Record<string, unknown> };
    const geminiContent = JSON.parse(await fs.promises.readFile(geminiPath, "utf8")) as { mcpServers: Record<string, unknown> };
    const copilotCliContent = JSON.parse(await fs.promises.readFile(copilotCliPath, "utf8")) as { mcpServers: Record<string, unknown> };
    const copilotVsCodeContent = JSON.parse(await fs.promises.readFile(copilotVsCodePath, "utf8")) as { servers: Record<string, unknown> };

    expect(Object.keys(claudeContent.mcpServers)).toEqual(["github"]);
    expect(Object.keys(geminiContent.mcpServers)).toEqual(["github"]);
    expect(Object.keys(copilotCliContent.mcpServers)).toEqual(["github"]);
    expect(Object.keys(copilotVsCodeContent.servers)).toEqual(["github"]);
  });

  it("lists backups and rolls back the latest config for a single client", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();
    const codexPath = path.join(homeDir, ".codex", "config.toml");
    const claudePath = path.join(homeDir, ".claude.json");
    const geminiPath = path.join(homeDir, ".gemini", "settings.json");
    const copilotCliPath = getCopilotCliConfigPath();
    const copilotVsCodePath = getCopilotVsCodeConfigPath();

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    transport: stdio
    command: node
    args: ["--version"]
scopes:
  global:
    enable:
      - github
`,
    );

    await fs.promises.mkdir(path.dirname(codexPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(geminiPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(copilotCliPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(copilotVsCodePath), { recursive: true });
    await fs.promises.writeFile(codexPath, 'model = "gpt-5"\n', "utf8");
    await fs.promises.writeFile(claudePath, '{\n  "theme": "dark"\n}\n', "utf8");
    await fs.promises.writeFile(geminiPath, '{\n  "theme": "light"\n}\n', "utf8");
    await fs.promises.writeFile(copilotCliPath, '{\n  "theme": "dark"\n}\n', "utf8");
    await fs.promises.writeFile(copilotVsCodePath, '{\n  "inputs": []\n}\n', "utf8");

    await runApplyCommand({ repo: repoDir });
    await runListBackupsCommand({ client: "codex" });
    expect(logSpy.mock.calls.flat().join("\n")).toContain("codex:");

    await fs.promises.writeFile(codexPath, 'model = "gpt-5.4"\n', "utf8");
    await runRollbackCommand({ client: "codex" });

    expect(await fs.promises.readFile(codexPath, "utf8")).toContain('model = "gpt-5"');
    expect(await fs.promises.readFile(claudePath, "utf8")).toContain('"github"');
    expect(await fs.promises.readFile(geminiPath, "utf8")).toContain('"github"');
  });

  it("fails without mutating configs when Gemini JSON is invalid", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();
    const codexPath = path.join(homeDir, ".codex", "config.toml");
    const claudePath = path.join(homeDir, ".claude.json");
    const geminiPath = path.join(homeDir, ".gemini", "settings.json");
    const originalCodex = 'model = "gpt-5"\n';

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    transport: stdio
    command: npx
scopes:
  global:
    enable:
      - github
`,
    );

    await fs.promises.mkdir(path.dirname(codexPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(geminiPath), { recursive: true });
    await fs.promises.writeFile(codexPath, originalCodex, "utf8");
    await fs.promises.writeFile(claudePath, '{\n  "theme": "dark"\n}\n', "utf8");
    await fs.promises.writeFile(geminiPath, "{ invalid json\n", "utf8");

    await expect(runApplyCommand({ repo: repoDir })).rejects.toThrow("Invalid JSON in Gemini config");
    expect(await fs.promises.readFile(codexPath, "utf8")).toBe(originalCodex);
    await expect(fs.promises.access(getBackupsDir())).rejects.toThrow();
  });

  it("translates env references per client and skips clients that cannot express them", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    transport: stdio
    command: npx
    env:
      GITHUB_TOKEN: \${env:GITHUB_TOKEN}
scopes:
  global:
    enable:
      - github
`,
    );

    await runApplyCommand({ repo: repoDir });

    const claude = JSON.parse(await fs.promises.readFile(path.join(homeDir, ".claude.json"), "utf8")) as {
      mcpServers: { github: { env: Record<string, string> } };
    };
    expect(claude.mcpServers.github.env.GITHUB_TOKEN).toBe("${GITHUB_TOKEN}");
    expect(await fs.promises.readFile(path.join(homeDir, ".codex", "config.toml"), "utf8")).toContain('env_vars = ["GITHUB_TOKEN"]');

    const copilotCli = JSON.parse(await fs.promises.readFile(getCopilotCliConfigPath(), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(copilotCli.mcpServers).toEqual({});

    await expect(runApplyCommand({ repo: repoDir, clients: "copilot-cli" })).rejects.toThrow(
      "Copilot CLI cannot represent server 'github'",
    );
  });

  it("keeps servers added by hand and removes only the ones mcpmatrix wrote earlier", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();
    const claudePath = path.join(homeDir, ".claude.json");

    await fs.promises.writeFile(
      claudePath,
      JSON.stringify({ numStartups: 5, mcpServers: { manual: { command: "node", args: [] } } }),
      "utf8",
    );

    const writeServers = (names: string[]) =>
      writeUserConfig(
        homeDir,
        `servers:
${names.map((name) => `  ${name}:
    transport: stdio
    command: node
`).join("")}scopes:
  global:
    enable: [${names.join(", ")}]
`,
      );

    await writeServers(["alpha", "beta"]);
    await runApplyCommand({ repo: repoDir, clients: "claude" });
    let claude = JSON.parse(await fs.promises.readFile(claudePath, "utf8")) as { numStartups: number; mcpServers: Record<string, unknown> };
    expect(Object.keys(claude.mcpServers).sort()).toEqual(["alpha", "beta", "manual"]);
    expect(claude.numStartups).toBe(5);

    await writeServers(["alpha"]);
    await runApplyCommand({ repo: repoDir, clients: "claude" });
    claude = JSON.parse(await fs.promises.readFile(claudePath, "utf8")) as { numStartups: number; mcpServers: Record<string, unknown> };
    expect(Object.keys(claude.mcpServers).sort()).toEqual(["alpha", "manual"]);
  });

  it("imports existing configs into the canonical YAML", async () => {
    const homeDir = await createTempHome();
    const claudePath = path.join(homeDir, ".claude.json");

    await fs.promises.writeFile(
      claudePath,
      JSON.stringify(
        {
          mcpServers: {
            github: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-github"],
              env: {
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

    const { runImportCommand } = await import("./import");
    await runImportCommand();

    const configPath = path.join(homeDir, ".mcpmatrix", "config.yml");
    expect(await fs.promises.readFile(configPath, "utf8")).toContain("github:");
  });

  it("validates the canonical config against local commands", async () => {
    const homeDir = await createTempHome();

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    transport: stdio
    command: node
scopes:
  global:
    enable:
      - github
`,
    );

    const { runValidateCommand } = await import("./validate");
    await expect(runValidateCommand()).resolves.toBeUndefined();
  });
});
