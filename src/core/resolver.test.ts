import { describe, expect, it } from "vitest";
import { resolveServers } from "./resolver";
import { McpMatrixConfig } from "../types";

const baseConfig: McpMatrixConfig = {
  servers: {
    github: { transport: "stdio", command: "npx", args: ["github"] },
    browser: { transport: "stdio", command: "npx", args: ["browser"] },
    postgres: { transport: "stdio", command: "npx", args: ["postgres"] },
    medusa: { transport: "remote", protocol: "http", url: "https://docs.medusajs.com/mcp" },
  },
  scopes: {
    global: { enable: ["github"] },
    tags: {
      ecommerce: { enable: ["browser", "github"] },
      data: { enable: ["postgres", "medusa"] },
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

    expect(result.globalServers.map((server) => server.name)).toEqual(["github"]);
    expect(result.repoScopedServers.map((server) => server.name)).toEqual(["browser", "postgres"]);
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
    expect(result.globalServers.map((server) => server.name)).toEqual(["github"]);
    expect(result.repoScopedServers.map((server) => server.name)).toEqual(["browser", "postgres", "medusa"]);
    expect(result.servers.map((server) => server.name)).toEqual(["github", "browser", "postgres", "medusa"]);
  });

  it("falls back to global scope and warns when the repo is unknown", () => {
    const result = resolveServers(baseConfig, "/srv/unknown");

    expect(result.matchedRepo).toBe(false);
    expect(result.globalServers.map((server) => server.name)).toEqual(["github"]);
    expect(result.repoScopedServers).toEqual([]);
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

    expect(result.globalServers.map((server) => server.name)).toEqual(["github"]);
    expect(result.repoScopedServers.map((server) => server.name)).toEqual(["browser"]);
    expect(result.servers.map((server) => server.name)).toEqual(["github", "browser"]);
  });
});
