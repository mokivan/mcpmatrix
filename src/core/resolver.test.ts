import { describe, expect, it } from "vitest";
import { resolveServers } from "./resolver";
import { McpMatrixConfig } from "../types";

const baseConfig: McpMatrixConfig = {
  servers: {
    github: { command: "npx", args: ["github"] },
    browser: { command: "npx", args: ["browser"] },
    postgres: { command: "npx", args: ["postgres"] },
    redis: { command: "npx", args: ["redis"] },
  },
  scopes: {
    global: { enable: ["github"] },
    tags: {
      ecommerce: { enable: ["browser", "github"] },
      data: { enable: ["postgres", "redis"] },
    },
    repos: {},
  },
};

describe("resolver", () => {
  it("applies global, tags, and repo scopes in deterministic order", () => {
    const config: McpMatrixConfig = {
      ...baseConfig,
      scopes: {
        ...baseConfig.scopes,
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

  it("supports multiple tags per repo while keeping stable deduplication order", () => {
    const result = resolveServers(
      {
        ...baseConfig,
        scopes: {
          ...baseConfig.scopes,
          repos: {
            "/srv/store": {
              tags: ["ecommerce", "data"],
              enable: ["browser"],
            },
          },
        },
      },
      "/srv/store",
    );

    expect(result.tags).toEqual(["ecommerce", "data"]);
    expect(result.servers.map((server) => server.name)).toEqual(["github", "browser", "postgres", "redis"]);
  });

  it("falls back to global scope and warns when the repo is unknown", () => {
    const result = resolveServers(baseConfig, "/srv/unknown");

    expect(result.matchedRepo).toBe(false);
    expect(result.servers.map((server) => server.name)).toEqual(["github"]);
    expect(result.warnings).toHaveLength(1);
  });

  it("matches configured repo paths after normalization", () => {
    const result = resolveServers(
      {
        ...baseConfig,
        scopes: {
          ...baseConfig.scopes,
          repos: {
            "C:\\Users\\Ivan\\repo": {
              tags: ["ecommerce"],
              enable: [],
            },
            "/Users/ivan/repo": {
              tags: ["data"],
              enable: [],
            },
          },
        },
      },
      "C:/Users/Ivan/repo",
    );

    expect(result.servers.map((server) => server.name)).toEqual(["github", "browser"]);
  });
});
