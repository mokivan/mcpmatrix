import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getVsCodeMcpPath(homeDir) {
  if (process.platform === "win32") {
    return path.join(homeDir, "AppData", "Roaming", "Code", "User", "mcp.json");
  }

  if (process.platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "Code", "User", "mcp.json");
  }

  return path.join(homeDir, ".config", "Code", "User", "mcp.json");
}

async function runCli(args, env) {
  return execFileAsync(process.execPath, [path.join(process.cwd(), "dist", "cli", "index.js"), ...args], {
    cwd: process.cwd(),
    env,
  });
}

async function main() {
  const packageJson = JSON.parse(await fs.readFile(path.join(process.cwd(), "package.json"), "utf8"));
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-smoke-"));

  try {
    const env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
      APPDATA: path.join(tempHome, "AppData", "Roaming"),
      XDG_CONFIG_HOME: path.join(tempHome, ".config"),
    };

    const { stdout: versionOutput } = await runCli(["--version"], env);
    if (versionOutput.trim() !== packageJson.version) {
      throw new Error(`Unexpected CLI version: ${versionOutput.trim()}`);
    }

    await runCli(["schema"], env);

    await runCli(["init"], env);

    const configPath = path.join(tempHome, ".mcpmatrix", "config.yml");
    const repoPath = path.join(tempHome, "repo");
    await fs.mkdir(path.join(repoPath, ".git"), { recursive: true });

    await fs.writeFile(
      configPath,
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
      "utf8",
    );

    await fs.mkdir(path.join(tempHome, ".codex"), { recursive: true });
    await fs.mkdir(path.join(tempHome, ".gemini"), { recursive: true });
    await fs.writeFile(path.join(tempHome, ".codex", "config.toml"), 'model = "gpt-5"\n', "utf8");
    await fs.writeFile(path.join(tempHome, ".claude.json"), '{\n  "theme": "dark"\n}\n', "utf8");
    await fs.writeFile(path.join(tempHome, ".gemini", "settings.json"), '{\n  "theme": "light"\n}\n', "utf8");

    await runCli(["validate"], env);
    await runCli(["plan", "--repo", repoPath], env);
    await runCli(["apply", "--repo", repoPath], env);
    await runCli(["backups", "list", "--client", "codex"], env);
    await runCli(["rollback", "--client", "codex"], env);

    await fs.access(path.join(tempHome, ".codex", "config.toml"));
    await fs.access(path.join(tempHome, ".claude.json"));
    await fs.access(path.join(tempHome, ".gemini", "settings.json"));
    await fs.access(path.join(tempHome, ".copilot", "mcp-config.json"));
    await fs.access(getVsCodeMcpPath(tempHome));

    const importHome = await fs.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-import-smoke-"));

    try {
      const importEnv = {
        ...process.env,
        HOME: importHome,
        USERPROFILE: importHome,
        APPDATA: path.join(importHome, "AppData", "Roaming"),
        XDG_CONFIG_HOME: path.join(importHome, ".config"),
      };

      await fs.writeFile(
        path.join(importHome, ".claude.json"),
        JSON.stringify(
          {
            mcpServers: {
              github: {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: {},
              },
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      await runCli(["import"], importEnv);
      await runCli(["validate"], importEnv);
      await fs.access(path.join(importHome, ".mcpmatrix", "config.yml"));
    } finally {
      await fs.rm(importHome, { recursive: true, force: true });
    }
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
