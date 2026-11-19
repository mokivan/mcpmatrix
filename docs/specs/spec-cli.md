# mcpmatrix Spec - Public CLI Surface

This file defines the public command surface that must remain documented and supported for the current release line.

## Public binaries

- `mcpmatrix`
- `mmx`

## Public commands

### `mcpmatrix init`

Creates the initial canonical config file.

### `mcpmatrix import`

Imports supported client MCP configs into the canonical YAML file.

### `mcpmatrix schema`

Prints the local packaged JSON Schema path and file URI for editor integration.

### `mcpmatrix backups list [--client <codex|claude|gemini|copilot-cli|copilot-vscode>] [--repo <path>]`

Lists versioned backups from `~/.mcpmatrix/backups/`.

### `mcpmatrix plan [--repo <path>]`

Shows the resolved MCP server set and planned config updates.

### `mcpmatrix apply [--repo <path>] [--clients <all|auto|client1,client2,...>]`

Writes resolved MCP config into supported client config files.

- with `--clients all` (default) or `auto`, servers a client cannot represent are skipped for that client with a warning
- with an explicit client list, an unrepresentable server is an error and nothing is written
- servers added by hand to client files are preserved; mcpmatrix only replaces or removes the names it recorded in `~/.mcpmatrix/state.json`

### `mcpmatrix validate`

Validates the canonical config structure and local command executability.

### `mcpmatrix doctor [--repo <path>]`

Runs diagnostics for commands, env vars, repo accessibility, and suggestions.

### `mcpmatrix rollback [--client <codex|claude|gemini|copilot-cli|copilot-vscode>] [--backup <name-or-path>] [--repo <path>]`

Restores the latest or selected versioned backup into live client config files.

### `mcpmatrix tui [--repo <path>]`

Opens the interactive terminal UI with keyboard navigation for inspecting doctor status, editing config, and toggling repo-local MCP servers.

## Documentation guard

When the public CLI surface changes:

- update `README.md` in the same change
- update this spec in the same change
- keep release smoke and packaging checks aligned with the released command set
