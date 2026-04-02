import { describe, expect, it } from "vitest";
import { renderGeminiConfig } from "./writer";
import { ResolvedServer } from "../../types";

const servers: ResolvedServer[] = [
  {
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
    },
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
