import { describe, expect, it } from "vitest";
import { mergeCodexConfig, renderCodexManagedSection } from "./writer";
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

describe("codex writer", () => {
  it("renders the managed section snapshot", () => {
    expect(renderCodexManagedSection(servers)).toMatchSnapshot();
  });

  it("merges managed content without removing unrelated settings", () => {
    const existingContent = 'model = "gpt-5"\n';

    expect(mergeCodexConfig(existingContent, servers)).toMatchSnapshot();
  });
});
