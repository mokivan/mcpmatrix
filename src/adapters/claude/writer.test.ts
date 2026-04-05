import { describe, expect, it } from "vitest";
import { renderClaudeConfig } from "./writer";
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
    protocol: "sse",
    url: "https://docs.medusajs.com/mcp",
    headers: {
      Authorization: "Bearer ${env:MEDUSA_TOKEN}",
    },
    auth: {
      type: "bearer",
      token: "${env:MEDUSA_TOKEN}",
    },
  },
];

describe("claude writer", () => {
  it("renders the claude config snapshot", () => {
    expect(
      JSON.stringify(
        renderClaudeConfig(
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
});
