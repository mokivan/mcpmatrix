import { describe, expect, it } from "vitest";
import { renderCopilotVsCodeConfig } from "./writer";
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
    protocol: "http",
    url: "https://mcp.context7.com/mcp",
    headers: {
      Authorization: "Bearer ${env:CONTEXT7_API_KEY}",
    },
  },
];

describe("copilot-vscode writer", () => {
  it("renders the copilot vscode config snapshot", () => {
    expect(
      JSON.stringify(
        renderCopilotVsCodeConfig(
          {
            inputs: [
              {
                type: "promptString",
                id: "api-key",
                description: "API key",
                password: true,
              },
            ],
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
      renderCopilotVsCodeConfig(
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
    ).toThrow("Copilot VS Code cannot represent");
  });
});
