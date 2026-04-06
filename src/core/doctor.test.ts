import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctor } from "./doctor";

const tempDirs: string[] = [];
let originalHome: string | undefined;
let originalUserProfile: string | undefined;
let originalAppData: string | undefined;
let originalXdgConfigHome: string | undefined;

function trackTempDir(tempDir: string): string {
  tempDirs.push(tempDir);
  return tempDir;
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
  return trackTempDir(tempHome);
}

afterEach(async () => {
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

describe("runDoctor", () => {
  it("reports missing env vars, repo accessibility, and stack suggestions", async () => {
    const homeDir = await createTempHome();
    const configPath = path.join(homeDir, ".mcpmatrix", "config.yml");
    const repoDir = trackTempDir(await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-repo-")));
    const missingRepo = path.join(repoDir, "missing-repo");

    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(
      configPath,
      `servers:
  github:
    transport: remote
    protocol: sse
    url: https://example.com/mcp
    headers:
      Authorization: Bearer \${env:GITHUB_TOKEN}
scopes:
  global:
    enable:
      - github
  repos:
    "${missingRepo.replace(/\\/g, "\\\\")}":
      tags: []
      enable: []
`,
      "utf8",
    );

    await fs.promises.writeFile(path.join(repoDir, "package.json"), "{\n  \"name\": \"repo\"\n}\n", "utf8");
    delete process.env.GITHUB_TOKEN;

    const report = await runDoctor({ repo: repoDir });

    expect(report.serverChecks).toHaveLength(1);
    expect(report.serverChecks[0]?.missingEnvVars).toEqual(["GITHUB_TOKEN"]);
    expect(report.serverChecks[0]?.compatibility.codex.supported).toBe(false);
    expect(report.serverChecks[0]?.compatibility["copilot-cli"].supported).toBe(true);
    expect(report.serverChecks[0]?.compatibility["copilot-vscode"].supported).toBe(true);
    expect(report.repoChecks.some((check) => check.repoPath === missingRepo && !check.accessible)).toBe(true);
    expect(report.suggestedTags).toHaveLength(1);
    expect(report.suggestedTags[0]?.tag).toBe("node");
    expect(report.suggestedTags[0]?.evidence).toBe(path.join(report.detectedRepoPath, "package.json"));
  });
});
