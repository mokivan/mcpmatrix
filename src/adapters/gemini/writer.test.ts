import { describe, expect, it } from "vitest";
import { renderGeminiConfig } from "./writer";
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
    protocol: "http",
    url: "https://docs.medusajs.com/mcp",
    headers: {},
  },
];

describe("gemini writer", () => {
  it("renders the gemini config snapshot", () => {
    expect(
      JSON.stringify(
        renderGeminiConfig(
          {
            theme: "light",
          },
          servers,
        ),
        null,
        2,
      ),
    ).toMatchSnapshot();
  });
});
