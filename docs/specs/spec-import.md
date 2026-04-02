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

`[[mcp_servers]]`

Each imported entry must provide:

- `name`
- `command`
- optional `args`
- optional `env`

## Claude and Gemini Input

Claude and Gemini MCP servers are read from:

`mcpServers`

Each imported entry must provide:

- `command`
- optional `args`
- optional `env`

## Conflict Rules

If the same server name is detected in more than one client file:

- import succeeds only when `command`, `args`, and `env` are identical
- import fails when any of those values differ

## Failure Conditions

`mcpmatrix import` must fail when:

- `~/.mcpmatrix/config.yml` already exists
- no supported client config files exist
- supported client files exist but none define MCP servers
- an imported client file is invalid for its format
- an imported server definition is incomplete or malformed
- the same server name resolves to conflicting definitions across clients
