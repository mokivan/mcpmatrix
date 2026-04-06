import { describe, expect, it } from "vitest";
import { renderCopilotCliConfig } from "./writer";
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
    name: "context7",
    transport: "remote",
    protocol: "sse",
    url: "https://mcp.context7.com/mcp",
    headers: {
      CONTEXT7_API_KEY: "${env:CONTEXT7_API_KEY}",
    },
  },
];

describe("copilot-cli writer", () => {
  it("renders the copilot cli config snapshot", () => {
    expect(
      JSON.stringify(
        renderCopilotCliConfig(
          {
            theme: "dark",
          },
          servers,
        ),
        null,
        2,
      ),
    ).toMatchSnapshot();
  });

  it("rejects persisted auth metadata", () => {
    expect(() =>
      renderCopilotCliConfig(
        {},
        [
          {
            name: "secured",
            transport: "remote",
            protocol: "http",
            url: "https://example.com/mcp",
            headers: {},
            auth: {
              type: "bearer",
              token: "${env:API_TOKEN}",
            },
          },
        ],
      ),
    ).toThrow("Copilot CLI cannot represent");
  });
});
