# mcpmatrix Roadmap - v1

## Goal

Turn the MVP into a publicly usable tool.

New capabilities:

- Gemini CLI support
- import from existing configs
- npm distribution
- stronger validation
- better multi-platform repo handling

## Config Import

Command:

`mcpmatrix import`

Detects:

- `~/.codex/config.toml`
- `~/.claude.json`
- `~/.gemini/settings.json`

and converts them into YAML.

## Gemini Support

New adapter:

```text
src/adapters/gemini/
  reader.ts
  writer.ts
```

Output file:

`~/.gemini/settings.json`

Used section:

`mcpServers`

## npm Distribution

Publish with:

`npm publish`

CLI available as:

- `mcpmatrix`
- `mmx`

Install with:

`npm install -g mcpmatrix`

## Configuration Validation

Command:

`mcpmatrix validate`

Checks:

- valid YAML
- valid env references
- defined MCP commands

## Resolver Improvements

Add support for:

- multiple tags per repo
- Windows, Linux, and macOS path normalization

Example paths:

- `C:\dev\project`
- `/home/ivan/project`
- `/Users/ivan/project`

## Additional Tests

Add:

- resolver tests
- adapter tests
- import tests

## Documentation

Expand `README.md` with:

- quick start
- configuration
- examples

## Acceptance Criteria

`v1` is complete when:

- it works with Codex
- it works with Claude
- it works with Gemini
- it can import existing configs
- it can be installed from npm
