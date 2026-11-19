import TOML from "toml";
import { describe, expect, it } from "vitest";
import { mergeCodexConfig, renderCodexManagedSection } from "./writer";
import { ResolvedServer } from "../../types";

const servers: ResolvedServer[] = [
  {
    name: "github",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
    },
  },
  {
    name: "medusa",
    transport: "remote",
    protocol: "auto",
    url: "https://docs.medusajs.com/mcp",
    headers: {},
  },
];

describe("codex writer", () => {
  it("renders the managed section snapshot", () => {
    expect(renderCodexManagedSection(servers)).toMatchSnapshot();
  });

  it("merges managed content without removing unrelated settings", () => {
    const existingContent = 'model = "gpt-5"\n';

    expect(mergeCodexConfig(existingContent, servers)).toMatchSnapshot();
  });

  it("removes orphaned mcpmatrix markers from previously broken content", () => {
    const startMarker = "# BEGIN MCPMATRIX MANAGED MCP SERVERS";
    const endMarker = "# END MCPMATRIX MANAGED MCP SERVERS";
    const existingContent = `model = "gpt-5"\n${endMarker}\n\n${startMarker}\n[mcp_servers."stale"]\nurl = "https://stale.example.com/mcp"\n\n${endMarker}\n`;

    expect(mergeCodexConfig(existingContent, servers)).toContain('model = "gpt-5"');
    expect(mergeCodexConfig(existingContent, servers).match(/# BEGIN MCPMATRIX MANAGED MCP SERVERS/g)).toHaveLength(1);
    expect(mergeCodexConfig(existingContent, servers).match(/# END MCPMATRIX MANAGED MCP SERVERS/g)).toHaveLength(1);
    expect(mergeCodexConfig(existingContent, servers)).not.toContain('[mcp_servers."stale"]');
  });

  it("rejects remote servers that require unsupported codex metadata", () => {
    expect(() =>
      renderCodexManagedSection([
        {
          name: "sentry",
          transport: "remote",
          protocol: "http",
          url: "https://mcp.sentry.dev/mcp",
          headers: {
            Authorization: "Bearer ${env:SENTRY_TOKEN}",
          },
        },
      ]),
    ).toThrow("Codex cannot represent");
  });

  it("keeps hand-written servers but refuses a same-name table outside the managed block", () => {
    const withOther = mergeCodexConfig('[mcp_servers.other]\ncommand = "x"\n', servers);
    expect(() => TOML.parse(withOther)).not.toThrow();
    expect(withOther).toContain("[mcp_servers.other]");

    expect(() => mergeCodexConfig('[mcp_servers.github]\ncommand = "x"\n', servers)).toThrow(
      "outside the mcpmatrix managed block",
    );
  });

  it("renders valid TOML for unusual env keys and control characters", () => {
    const section = renderCodexManagedSection([
      {
        name: "odd",
        transport: "stdio",
        command: "node",
        args: ["line1\nline2"],
        env: { "A B": "x", 'a"b': "y", "A.B": "z", PLAIN_KEY: "tab\there" },
      },
    ]);

    const parsed = TOML.parse(section) as { mcp_servers: { odd: { env: Record<string, string>; args: string[] } } };

    expect(parsed.mcp_servers.odd.env).toEqual({ "A B": "x", 'a"b': "y", "A.B": "z", PLAIN_KEY: "tab\there" });
    expect(parsed.mcp_servers.odd.args).toEqual(["line1\nline2"]);
  });
});
