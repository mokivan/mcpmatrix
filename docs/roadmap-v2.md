# mcpmatrix Roadmap - v2

## Goal

Turn `mcpmatrix` into a mature tool.

Add:

- TUI
- config versioning
- MCP server validation
- better diagnostics

## TUI

Command:

`mcpmatrix tui`

Functions:

- visualize active servers
- edit config
- inspect repo status
- enable or disable MCPs

Suggested implementation:

`ink`

## Config Versioning

Current backups:

`config.toml.bak`

New system:

`~/.mcpmatrix/backups/`

Format:

`config-YYYY-MM-DD-HH-MM.toml`

Retention:

keep the latest 3 backups

## Doctor

Command:

`mcpmatrix doctor`

Checks:

- MCP commands exist
- required env vars exist
- configuration is consistent
- repos are accessible

## Advanced Auto-Detection

Suggest tags from stack files:

- `package.json` -> `node`
- `pom.xml` -> `java`
- `.csproj` -> `dotnet`

Never apply automatically, only suggest.

## MCP Server Validation

Verify:

- command exists
- executable is accessible
- env vars are defined

## UX Improvements

- CLI colors
- clearer logs
- useful warnings

## Additional Tests

Add:

- full integration tests
- multi-platform tests
- simulated repo tests

## Acceptance Criteria

`v2` is complete when:

- the tool is usable through the TUI
- MCP servers are validated correctly
- versioned backups are maintained
- full diagnostics work
