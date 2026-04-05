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

### `mcpmatrix backups list [--client <codex|claude|gemini>]`

Lists versioned backups from `~/.mcpmatrix/backups/`.

### `mcpmatrix plan [--repo <path>]`

Shows the resolved MCP server set and planned config updates.

### `mcpmatrix apply [--repo <path>]`

Writes resolved MCP config into supported client config files.

### `mcpmatrix validate`

Validates the canonical config structure and local command executability.

### `mcpmatrix doctor [--repo <path>]`

Runs diagnostics for commands, env vars, repo accessibility, and suggestions.

### `mcpmatrix rollback [--client <codex|claude|gemini>] [--backup <name-or-path>]`

Restores the latest or selected versioned backup into live client config files.

### `mcpmatrix tui [--repo <path>]`

Opens the interactive terminal UI.

## Documentation guard

When the public CLI surface changes:

- update `README.md` in the same change
- update this spec in the same change
- keep release smoke and packaging checks aligned with the released command set
