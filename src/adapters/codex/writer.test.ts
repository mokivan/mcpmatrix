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
});
