import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctor } from "./doctor";

const tempDirs: string[] = [];
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

function trackTempDir(tempDir: string): string {
  tempDirs.push(tempDir);
  return tempDir;
}

async function createTempHome(): Promise<string> {
  const tempHome = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-home-"));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  return trackTempDir(tempHome);
}

afterEach(async () => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;

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
    command: node
    env:
      GITHUB_TOKEN: \${env:GITHUB_TOKEN}
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
    expect(report.repoChecks.some((check) => check.repoPath === missingRepo && !check.accessible)).toBe(true);
    expect(report.suggestedTags).toHaveLength(1);
    expect(report.suggestedTags[0]?.tag).toBe("node");
    expect(report.suggestedTags[0]?.evidence).toBe(path.join(report.detectedRepoPath, "package.json"));
  });
});
