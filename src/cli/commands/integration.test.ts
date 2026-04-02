import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runApplyCommand } from "./apply";
import { runInitCommand } from "./init";
import { runPlanCommand } from "./plan";

const tempDirs: string[] = [];
let originalHome: string | undefined;
let originalUserProfile: string | undefined;
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
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(async () => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;

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
  });

  it("plans active servers and target files for an unconfigured repo", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();

    await writeUserConfig(
      homeDir,
      `servers:
  github:
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
    expect(logSpy.mock.calls.flat().join("\n")).toContain("- github -> npx -y @modelcontextprotocol/server-github");
    expect(logSpy.mock.calls.flat().join("\n")).toContain(path.join(homeDir, ".codex", "config.toml"));
    expect(warnSpy.mock.calls.flat().join("\n")).toContain("Repository is not configured");
  });

  it("applies config, preserves unmanaged content, and creates backups", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();
    const codexPath = path.join(homeDir, ".codex", "config.toml");
    const claudePath = path.join(homeDir, ".claude.json");

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: \${env:GITHUB_TOKEN}
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
    await fs.promises.writeFile(codexPath, 'model = "gpt-5"\n', "utf8");
    await fs.promises.writeFile(claudePath, '{\n  "theme": "dark"\n}\n', "utf8");

    await runApplyCommand({ repo: repoDir });

    const codexContent = await fs.promises.readFile(codexPath, "utf8");
    const claudeContent = JSON.parse(await fs.promises.readFile(claudePath, "utf8")) as {
      theme: string;
      mcpServers: Record<string, unknown>;
    };

    expect(codexContent).toContain('model = "gpt-5"');
    expect(codexContent).toContain("[[mcp_servers]]");
    expect(claudeContent.theme).toBe("dark");
    expect(Object.keys(claudeContent.mcpServers)).toEqual(["github"]);
    expect(fs.existsSync(`${codexPath}.bak`)).toBe(true);
    expect(fs.existsSync(`${claudePath}.bak`)).toBe(true);
  });

  it("fails without mutating configs when Claude JSON is invalid", async () => {
    const homeDir = await createTempHome();
    const repoDir = await createRepoDir();
    const codexPath = path.join(homeDir, ".codex", "config.toml");
    const claudePath = path.join(homeDir, ".claude.json");
    const originalCodex = 'model = "gpt-5"\n';

    await writeUserConfig(
      homeDir,
      `servers:
  github:
    command: npx
scopes:
  global:
    enable:
      - github
`,
    );

    await fs.promises.mkdir(path.dirname(codexPath), { recursive: true });
    await fs.promises.writeFile(codexPath, originalCodex, "utf8");
    await fs.promises.writeFile(claudePath, "{ invalid json\n", "utf8");

    await expect(runApplyCommand({ repo: repoDir })).rejects.toThrow("Invalid JSON in Claude config");
    expect(await fs.promises.readFile(codexPath, "utf8")).toBe(originalCodex);
    expect(fs.existsSync(`${codexPath}.bak`)).toBe(false);
  });
});
