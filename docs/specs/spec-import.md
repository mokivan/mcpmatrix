# mcpmatrix Spec - Config Import

`mcpmatrix import` converts supported client MCP configuration into the canonical mcpmatrix YAML file.

## Detected Sources

The command checks these files in the user home directory:

- `~/.codex/config.toml`
- `~/.claude.json`
- `~/.gemini/settings.json`

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
- the same server name resolves to conflicting definitions across clients
