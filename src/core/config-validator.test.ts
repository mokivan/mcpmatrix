import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { commandExists, getMissingEnvVars, validateServerDefinitions } from "./config-validator";
import { McpMatrixConfig } from "../types";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  }
});

async function createTempCommand(scriptName: string): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mcpmatrix-command-"));
  tempDirs.push(tempDir);
  const scriptPath = path.join(tempDir, scriptName);
  await fs.promises.writeFile(scriptPath, "echo test\n", "utf8");
  return scriptPath;
}

describe("config-validator", () => {
  it("finds commands available in PATH", () => {
    expect(commandExists("node")).toBe(true);
  });

  it("finds commands by absolute path", async () => {
    const scriptPath = await createTempCommand(
      process.platform === "win32" ? "mcpmatrix-test-command.cmd" : "mcpmatrix-test-command",
    );

    if (process.platform !== "win32") {
      await fs.promises.chmod(scriptPath, 0o755);
    }

    expect(commandExists(scriptPath)).toBe(true);
  });

  it("rejects path-based commands that are not executable", async () => {
    const scriptPath = await createTempCommand(
      process.platform === "win32" ? "mcpmatrix-test-command.txt" : "mcpmatrix-test-command",
    );

    if (process.platform !== "win32") {
      await fs.promises.chmod(scriptPath, 0o644);
    }

    expect(commandExists(scriptPath)).toBe(false);
  });

  it("rejects missing stdio commands during validation", () => {
    const config: McpMatrixConfig = {
      servers: {
        github: {
          transport: "stdio",
          command: "definitely-not-a-real-command",
        },
      },
    };

    expect(() => validateServerDefinitions(config)).toThrow("Command not found");
  });

  it("accepts valid remote server definitions", () => {
    const config: McpMatrixConfig = {
      servers: {
        medusa: {
          transport: "remote",
          protocol: "http",
          url: "https://docs.medusajs.com/mcp",
        },
      },
    };

    expect(() => validateServerDefinitions(config)).not.toThrow();
  });

  it("rejects invalid remote URLs during validation", () => {
    const config: McpMatrixConfig = {
      servers: {
        medusa: {
          transport: "remote",
          protocol: "http",
          url: "not-a-url",
        },
      },
    };

    expect(() => validateServerDefinitions(config)).toThrow("Invalid remote server");
  });

  it("collects missing env vars from stdio and remote strings", () => {
    const missing = getMissingEnvVars({
      transport: "remote",
      protocol: "http",
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer ${env:REMOTE_TOKEN}",
      },
      auth: {
        type: "oauth",
        clientId: "${env:REMOTE_CLIENT_ID}",
      },
    });

    expect(missing).toContain("REMOTE_TOKEN");
    expect(missing).toContain("REMOTE_CLIENT_ID");
  });
});
