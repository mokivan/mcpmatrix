# mcpmatrix Spec - Client Adapters

Adapters convert the canonical mcpmatrix configuration into specific formats used by AI clients.

## Supported Clients

- Codex CLI
- Claude Code CLI
- Gemini CLI
- GitHub Copilot CLI
- GitHub Copilot VS Code

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

## GitHub Copilot CLI

Files:

- global: `~/.copilot/mcp-config.json`
- repo-scoped: `<repo>/.github/mcp.json`

Section:

`mcpServers`

Supported output:

- stdio: `type: "local"` with `command`, `args`, `env`, and `tools: ["*"]`
- remote HTTP: `type: "http"` with `url`, optional `headers`, and `tools: ["*"]`
- remote SSE: `type: "sse"` with `url`, optional `headers`, and `tools: ["*"]`

GitHub Copilot CLI adapter limitations:

- persisted remote `auth` metadata is not representable
- canonical tool filtering is not modeled; mcpmatrix always writes `tools: ["*"]`

## GitHub Copilot VS Code

Files:

- global: VS Code default user profile `mcp.json`
- repo-scoped: `<repo>/.vscode/mcp.json`

Default user profile path:

- Windows: `%APPDATA%/Code/User/mcp.json`
- macOS: `~/Library/Application Support/Code/User/mcp.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/Code/User/mcp.json`

Section:

`servers`

Supported output:

- stdio: `type: "stdio"` with `command`, optional `args`, and optional `env`
- remote HTTP: `type: "http"` with `url` and optional `headers`
- remote SSE: `type: "sse"` with `url` and optional `headers`

GitHub Copilot VS Code adapter limitations:

- persisted remote `auth` metadata is not representable
- VS Code-specific `inputs`, `envFile`, sandbox, and development-mode fields are outside the canonical model and are preserved only when already present outside the managed `servers` object

## Adapter Contract

Input:

Resolved canonical MCP server sets partitioned by scope:

- `globalServers`
- `repoScopedServers`

Output:

Client configuration files compatible with the target client and scope, or a clear incompatibility error before any writes occur.
