import { describe, expect, it } from "vitest";
import { renderClaudeConfig } from "../adapters/claude/writer";
import { renderCodexManagedSection } from "../adapters/codex/writer";
import { renderGeminiConfig } from "../adapters/gemini/writer";
import { renderCopilotVsCodeConfig } from "../adapters/copilot-vscode/writer";
import type { ResolvedServer } from "../types";

const stdio = (overrides: Partial<Extract<ResolvedServer, { transport: "stdio" }>>): ResolvedServer => ({
  name: "gh",
  transport: "stdio",
  command: "npx",
  ...overrides,
});

describe("per-client environment variable translation", () => {
  const server = stdio({ args: ["--k=${env:KEY}"], env: { KEY: "${env:KEY}" } });

  it("uses ${VAR} for Claude Code in command, args, env, url and headers", () => {
    const remote: ResolvedServer = {
      name: "r",
      transport: "remote",
      protocol: "http",
      url: "https://x/mcp?k=${env:KEY}",
      headers: { "X-Key": "${env:KEY}" },
      auth: { type: "bearer", token: "${env:TOKEN}" },
    };
    const rendered = renderClaudeConfig({}, [server, remote]).mcpServers ?? {};

    expect(rendered.gh).toMatchObject({ args: ["--k=${KEY}"], env: { KEY: "${KEY}" } });
    expect(rendered.r).toEqual({
      type: "http",
      url: "https://x/mcp?k=${KEY}",
      headers: { "X-Key": "${KEY}", Authorization: "Bearer ${TOKEN}" },
    });
  });

  it("keeps ${env:VAR} for VS Code", () => {
    const rendered = renderCopilotVsCodeConfig({}, [server]).servers ?? {};
    expect(rendered.gh).toMatchObject({ env: { KEY: "${env:KEY}" }, args: ["--k=${env:KEY}"] });
  });

  it("translates Gemini env values and rejects references outside env", () => {
    expect(renderGeminiConfig({}, [stdio({ env: { KEY: "${env:KEY}" } })]).mcpServers?.gh).toMatchObject({
      env: { KEY: "${KEY}" },
    });
    expect(() => renderGeminiConfig({}, [stdio({ args: ["${env:KEY}"] })])).toThrow("only documents environment variable expansion");
  });

  it("forwards same-name variables to Codex with env_vars and rejects anything else", () => {
    const section = renderCodexManagedSection([stdio({ env: { KEY: "${env:KEY}", PLAIN: "x" } })]);
    expect(section).toContain('env = { PLAIN = "x" }');
    expect(section).toContain('env_vars = ["KEY"]');

    expect(() => renderCodexManagedSection([stdio({ env: { OTHER: "${env:KEY}" } })])).toThrow("under its own name");
    expect(() => renderCodexManagedSection([stdio({ args: ["${env:KEY}"] })])).toThrow("does not expand");
  });
});
