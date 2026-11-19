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
      GITHUB_TOKEN: "literal-token",
    },
  },
  {
    name: "context7",
    transport: "remote",
    protocol: "sse",
    url: "https://mcp.context7.com/mcp",
    headers: {
      CONTEXT7_API_KEY: "literal-key",
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

  it("rejects environment variable references because Copilot CLI does not document expansion", () => {
    expect(() =>
      renderCopilotCliConfig({}, [
        { name: "gh", transport: "stdio", command: "npx", env: { TOKEN: "${env:TOKEN}" } },
      ]),
    ).toThrow("does not document environment variable expansion");
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
