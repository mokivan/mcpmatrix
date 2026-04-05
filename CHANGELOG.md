# Changelog

## 2.0.1

Release workflow fix for npm Trusted Publisher and GitHub release generation.

Included in `2.0.1`:

- release publish job updated to use Node.js `22.14.0`
- npm upgraded to `11.5.1` in the release workflow before publish
- release runtime diagnostics added to the GitHub Actions logs
- npm publish flow aligned with current Trusted Publisher behavior
- release docs updated to match the hardened publish flow

Compatibility notes:

- published CLI contract is unchanged from `2.0.0`
- this release only hardens automation around publishing and release creation

## 1.1.0

Hardening release for `@mokivan/mcpmatrix`.

Included in `1.1.0`:

- package contract clarified as CLI-only
- `exports` locked down to avoid unsupported internal imports
- package version sourced from `package.json` instead of hardcoded copies
- transactional `apply` with rollback across Codex, Claude, and Gemini targets
- stronger backup and restore helpers for failed applies
- explicit `typecheck` gate in local scripts and CI
- tarball verification script for publish hygiene
- GitHub release notes generated from `CHANGELOG.md`
- updated README and release docs covering compatibility, rollback, and support boundaries

Compatibility notes:

- documented CLI commands remain the supported public interface
- importing package internals is unsupported and may break without notice

## 1.0.0

First stable feature-complete release of `@mokivan/mcpmatrix`.

Included in `1.0.0`:

- canonical YAML config in `~/.mcpmatrix/config.yml`
- deterministic resolver for `global`, `tags`, and `repos`
- repository detection with `--repo`, git root search, and cwd fallback
- `init`, `import`, `validate`, `plan`, and `apply` CLI commands
- Codex CLI output via a managed block in `~/.codex/config.toml`
- Claude Code output via `mcpServers` in `~/.claude.json`
- Gemini CLI output via `mcpServers` in `~/.gemini/settings.json`
- config import from Codex, Claude Code, and Gemini client files
- local command validation for canonical server definitions
- Node.js 20 as the minimum supported runtime
- `.bak` backups before overwriting client config files
- build, lint, unit tests, integration tests, and smoke coverage
- CI matrix for Windows, Linux, and macOS

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
