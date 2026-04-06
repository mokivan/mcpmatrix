# Changelog

## 2.0.4

Scoped MCP persistence fix for global and repo-level client configs.

Included in `2.0.4`:

- resolver now partitions active MCPs into `global` and `repo-scoped` sets while preserving deterministic active ordering
- `apply` now writes global and project-level config files for Codex, Claude Code, and Gemini instead of promoting repo MCPs to user-global config
- Codex project config now targets `.codex/config.toml`, Claude project config now targets `.mcp.json`, and Gemini project config now targets `.gemini/settings.json`
- backup storage now tracks exact target metadata, supports separate global and repo-scoped restore points, and adds `--repo` support to `backups list` and `rollback`
- Codex managed block merging now cleans up previously broken orphan markers from older malformed writes
- README, canonical specs, integration coverage, and rollback tests updated to document and verify scoped behavior across all supported clients

Compatibility notes:

- Codex, Claude Code, and Gemini all retain user-global MCP support
- repo-scoped MCPs are now persisted only in project-level client config files when a repo matches `scopes.repos`
- rollback remains transactional within the selected scope

## 2.0.3

Canonical multi-transport MCP release with interactive TUI refresh.

Included in `2.0.3`:

- canonical config schema upgraded from command-only servers to explicit `stdio` and `remote` transports
- Codex import/apply now supports URL-based remote MCP servers
- Claude adapter/import now supports stdio, remote HTTP, and remote SSE MCP definitions
- Gemini adapter/import now supports stdio and remote HTTP MCP definitions via `httpUrl`
- `validate`, `doctor`, and `plan` now understand remote servers and report per-client compatibility
- `mcpmatrix tui` moved from a prompt loop to a full-screen terminal UI powered by `terminal-kit`
- keyboard navigation added for selection, filtering, doctor inspection, refresh, and editor round-trips
- repo-local MCP toggles now update in place and reload the canonical config after each change
- doctor output is rendered as a structured TUI view that includes runtime and client compatibility status
- TUI-focused unit tests added for server classification, toggle rules, doctor formatting, and non-interactive terminal failures
- packaged JSON Schema, canonical specs, README, smoke coverage, and snapshots updated for the multi-transport model

Compatibility notes:

- Codex, Claude Code, and Gemini remain first-class supported clients
- stdio MCP flows remain supported across all three clients
- some remote metadata remains client-specific and may cause `apply` to fail early when a target cannot represent it exactly
- inherited MCPs from `global` or `tags` remain visible but locked in the TUI

## 2.0.2

Backup rollback and documentation guardrail release.

Included in `2.0.2`:

- UTF-8 BOM handling centralized for YAML, TOML, and JSON config reads
- new `backups list` and `rollback` CLI commands for inspecting and restoring versioned backups
- transactional rollback support for restoring the latest backup globally or a selected backup per client
- canonical specs expanded with backup and CLI surface documentation
- automated documentation guard added to fail when CLI commands are not reflected in README and canonical specs
- release smoke and operational docs updated to cover the new public command set

Compatibility notes:

- public binaries remain `mcpmatrix` and `mmx`
- existing `init`, `import`, `validate`, `doctor`, `plan`, `apply`, and `tui` flows remain supported

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
