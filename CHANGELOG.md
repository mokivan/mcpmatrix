# Changelog

## Unreleased

Planned for the next public release from this branch:

- Gemini CLI output via `mcpServers` in `~/.gemini/settings.json`
- `import` command for Codex, Claude Code, and Gemini configs
- `validate` command for YAML, env references, server references, and local command existence
- stronger repo-path normalization coverage across Windows, Linux, and macOS
- expanded integration and smoke coverage for the v1 command set

## 0.1.0

Initial public release of `@mokivan/mcpmatrix`.

Included in `0.1.0`:

- canonical YAML config in `~/.mcpmatrix/config.yml`
- deterministic resolver for `global`, `tags`, and `repos`
- repository detection with `--repo`, git root search, and cwd fallback
- `init`, `plan`, and `apply` CLI commands
- Codex CLI output via a managed block in `~/.codex/config.toml`
- Claude Code output via `mcpServers` in `~/.claude.json`
- `.bak` backups before overwriting client config files
- build, lint, unit tests, integration tests, and smoke coverage
- CI matrix for Windows, Linux, and macOS

Not included in `0.1.0`:

- Gemini CLI
- config import
- `validate` command
- TUI or doctor commands
