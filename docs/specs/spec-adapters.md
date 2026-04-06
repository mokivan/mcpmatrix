# mcpmatrix Spec - Client Adapters

Adapters convert the canonical mcpmatrix configuration into specific formats used by AI clients.

## Supported Clients

- Codex CLI
- Claude Code CLI
- Gemini CLI

## Adapter Responsibilities

1. map canonical server definitions to client format
2. preserve supported transport metadata for each client
3. reject unsupported target/client combinations before writing files
4. write global and repo-scoped configuration files to the correct location

## Codex

Files:

- global: `~/.codex/config.toml`
- repo-scoped: `<repo>/.codex/config.toml`

Supported output:

- stdio:

```toml
[mcp_servers."<server-name>"]
command = "<command>"
args = []
env = {}
```

- remote:

```toml
[mcp_servers."<server-name>"]
url = "https://example.com/mcp"
```

Codex adapter limitations:

- remote `sse` is not representable
- remote `headers` and persisted `auth` metadata are not representable

## Claude Code

Files:

- global: `~/.claude.json` using `mcpServers`
- repo-scoped: `<repo>/.mcp.json`

Supported output:

- stdio: `type: "stdio"` with `command`, `args`, and `env`
- remote HTTP: `type: "http"` with `url`, optional `headers`, optional `auth`
- remote SSE: `type: "sse"` with `url`, optional `headers`, optional `auth`

## Gemini

Files:

- global: `~/.gemini/settings.json`
- repo-scoped: `<repo>/.gemini/settings.json`

Section:

`mcpServers`

Supported output:

- stdio: `command`, `args`, `env`
- remote HTTP: `httpUrl`

Gemini adapter limitations:

- remote `sse` is not representable
- remote `headers` and persisted `auth` metadata are not representable

## Adapter Contract

Input:

Resolved canonical MCP server sets partitioned by scope:

- `globalServers`
- `repoScopedServers`

Output:

Client configuration files compatible with the target client and scope, or a clear incompatibility error before any writes occur.
