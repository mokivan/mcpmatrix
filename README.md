# mcpmatrix

Define MCP servers once and generate client configs from a single canonical configuration.

Current project phase: `v0.1` MVP.

Supported in `v0.1`:

- Codex CLI
- Claude Code CLI

Planned after `v0.1`:

- Gemini CLI in `v1`
- import from existing client configs in `v1`
- TUI and diagnostics in `v2`

## Principles

- resolver output must be deterministic
- adapters must not contain business logic
- resolver returns the canonical server list

## Source of Truth

Implementation must follow this order:

1. roadmap documents in [`docs/`](/c:/Users/ivan_/repos/mcpmatrix/docs)
2. canonical specifications in [`docs/specs/`](/c:/Users/ivan_/repos/mcpmatrix/docs/specs)
3. code in [`src/`](/c:/Users/ivan_/repos/mcpmatrix/src)

Canonical specs are the files prefixed with `spec-`.
The shorter non-prefixed docs in `docs/specs/` are reference summaries.

## MVP Scope

`v0.1` targets:

- central YAML config at `~/.mcpmatrix/config.yml`
- scope resolution for `global`, `tags`, and `repos`
- repository detection
- `plan` and `apply` commands
- backups before overwriting client config files

`v0.1` explicitly does not include Gemini support.

## Development

Install:

```bash
npm install
```

Run in development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Documentation Guard

When a roadmap phase is implemented or the supported client matrix changes, update this README in the same change.

Minimum README updates for that case:

- current project phase
- supported clients
- planned clients and deferred scope
- user-facing commands or setup changes
