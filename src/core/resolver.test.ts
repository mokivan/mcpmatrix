import { describe, expect, it } from "vitest";
import { resolveServers } from "./resolver";
import { McpMatrixConfig } from "../types";

describe("resolver", () => {
  it("applies global, tags, and repo scopes in deterministic order", () => {
    const config: McpMatrixConfig = {
      servers: {
        github: { command: "npx", args: ["github"] },
        browser: { command: "npx", args: ["browser"] },
        postgres: { command: "npx", args: ["postgres"] },
      },
      scopes: {
        global: { enable: ["github"] },
        tags: {
          ecommerce: { enable: ["browser", "github"] },
        },
        repos: {
          "C:\\repo": {
            tags: ["ecommerce"],
            enable: ["postgres", "browser"],
          },
        },
      },
    };

    const result = resolveServers(config, "C:\\repo");

    expect(result.servers.map((server) => server.name)).toEqual(["github", "browser", "postgres"]);
  });
});
