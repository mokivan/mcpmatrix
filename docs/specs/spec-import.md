# mcpmatrix Spec - Config Import

`mcpmatrix import` converts supported client MCP configuration into the canonical mcpmatrix YAML file.

## Detected Sources

The command checks these files in the user home directory:

- `~/.codex/config.toml`
- `~/.claude.json`
- `~/.gemini/settings.json`
- `~/.copilot/mcp-config.json`
- VS Code default user profile `mcp.json`

Only existing files are imported.

## Output

Destination file:

`~/.mcpmatrix/config.yml`

Generated structure:

- `servers` contains every imported MCP server
- `scopes.global.enable` contains the imported server names in import order
- `scopes.tags` is empty
- `scopes.repos` is empty

## Codex Input

Codex MCP servers are read from:

`[mcp_servers.<name>]`

Legacy array-style `[[mcp_servers]]` entries may also be imported for backward compatibility.

Each imported entry must provide exactly one transport:

- `command` for canonical `transport: stdio`
- `url` for canonical `transport: remote` with `protocol: auto`

## Claude Input

Claude MCP servers are read from:

`mcpServers`

Supported import shapes:

- stdio: `type: "stdio"` or command-based entries with `command`
- remote HTTP: `type: "http"` with `url`
- remote SSE: `type: "sse"` with `url`

Optional Claude remote fields:

- `headers`
- `auth`

## Gemini Input

Gemini MCP servers are read from:

`mcpServers`

Supported import shapes:

- stdio: `command`
- remote HTTP: `httpUrl`

## GitHub Copilot CLI Input

GitHub Copilot CLI MCP servers are read from:

`mcpServers`

Supported import shapes:

- stdio: `type: "local"` or `type: "stdio"` with `command`
- remote HTTP: `type: "http"` with `url`
- remote SSE: `type: "sse"` with `url`

Accepted optional fields:

- `args`
- `env`
- `headers`
- `tools` only when the value is exactly `["*"]`

## GitHub Copilot VS Code Input

VS Code MCP servers are read from:

`servers`

Supported import shapes:

- stdio: `type: "stdio"` with `command`
- remote HTTP: `type: "http"` with `url`
- remote SSE: `type: "sse"` with `url`

Accepted optional fields:

- `args`
- `env`
- `headers`

Unsupported VS Code MCP fields such as `inputs`, `envFile`, sandbox, and development-mode metadata make import fail because they are not representable in the canonical config.

## Conflict Rules

If the same server name is detected in more than one client file:

- import succeeds only when the normalized canonical definitions are identical
- import fails when transport, protocol, url, command, args, env, headers, or auth differ

## Failure Conditions

`mcpmatrix import` must fail when:

- `~/.mcpmatrix/config.yml` already exists
- no supported client config files exist
- supported client files exist but none define MCP servers
- an imported client file is invalid for its format
- an imported server definition is incomplete or malformed
- an imported Copilot or VS Code server definition contains MCP metadata that cannot be normalized into the canonical model
- the same server name resolves to conflicting definitions across clients
