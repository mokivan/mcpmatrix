# mcpmatrix

Define MCP servers once and generate client configs from a single canonical configuration.

This version supports:

- Codex CLI
- Claude Code CLI
- Gemini CLI
- config import from existing client files
- explicit config validation
- `doctor` diagnostics
- interactive TUI
- versioned backups with retention

## Install

Global install from npm:

```bash
npm install -g @mokivan/mcpmatrix
```

Available binaries:

- `mcpmatrix`
- `mmx`

Minimum Node.js version:

- `20`

Package contract:

- supported public interface: `mcpmatrix`, `mmx`, and documented CLI flags
- unsupported: programmatic imports from package internals or `dist/*`

## Quick Start

1. Create the default config:

```bash
mcpmatrix init
```

2. Edit `~/.mcpmatrix/config.yml` with your MCP servers and scopes:

```yaml
servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${env:GITHUB_TOKEN}

  browser:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-browser"]

scopes:
  global:
    enable:
      - github

  tags:
    ecommerce:
      enable:
        - browser

  repos:
    "/Users/ivan/dev/store":
      tags: ["ecommerce"]
      enable: []
```

3. Validate, preview, and apply:

```bash
mcpmatrix validate
mcpmatrix doctor
mcpmatrix plan
mcpmatrix apply
mcpmatrix backups list
mcpmatrix rollback --client codex
```

Optional interactive workflow:

```bash
mcpmatrix tui
```

## Import Existing Configs

Import MCP servers from the supported client files into `~/.mcpmatrix/config.yml`:

```bash
mcpmatrix import
```

Detected sources:

- Codex: `~/.codex/config.toml`
- Claude Code: `~/.claude.json`
- Gemini: `~/.gemini/settings.json`

Import rules:

- import fails if `~/.mcpmatrix/config.yml` already exists
- imported servers become `servers`
- imported server names are enabled in `scopes.global.enable`
- conflicting definitions for the same server name cause import to fail

## Commands

### `mcpmatrix init`

Creates the initial config file at `~/.mcpmatrix/config.yml`.

### `mcpmatrix import`

Imports existing MCP client configs into the canonical YAML file.

### `mcpmatrix validate`

Validates:

- YAML syntax
- env reference syntax
- scope references to defined servers
- server commands available in PATH or by executable path

### `mcpmatrix doctor [--repo <path>]`

Runs a fuller diagnostic pass:

- MCP commands resolve locally
- referenced environment variables are defined
- configured repo paths are accessible
- the detected repo can be resolved and inspected
- stack files suggest tags without modifying config automatically

Suggested stack tags:

- `package.json` -> `node`
- `pom.xml` -> `java`
- `.csproj` -> `dotnet`

### `mcpmatrix plan [--repo <path>]`

Resolves the active server set for the current repository and shows:

- detected repo path
- active tags
- active servers
- files that would be updated
- estimated diff size

Repository detection order:

1. `--repo <path>`
2. search upward for `.git`
3. current working directory

### `mcpmatrix apply [--repo <path>]`

Resolves the same server set and writes client configs.

Client outputs:

- Codex: `~/.codex/config.toml`
- Claude Code: `~/.claude.json`
- Gemini: `~/.gemini/settings.json`

Write behavior:

- Codex updates only a managed `mcpmatrix` block inside `config.toml`, using named TOML tables under `mcp_servers`
- Claude updates only the `mcpServers` section inside `.claude.json`
- Gemini updates only the `mcpServers` section inside `settings.json`
- existing content outside those managed areas is preserved
- existing files are backed up before overwrite
- `apply` is transactional across supported clients: either all targets are updated or the previous state is restored

Backup files:

- stored in `~/.mcpmatrix/backups/`
- filenames are versioned by target, for example `config-YYYY-MM-DD-HH-MM.toml`
- latest 3 backups are retained per target

Rollback behavior:

- if any target write fails, `mcpmatrix apply` exits non-zero
- mcpmatrix restores all supported client files to their pre-apply state
- a failed apply should never leave a mixed client state behind

Compatibility note:

- mcpmatrix tolerates UTF-8 BOM-prefixed YAML, TOML, and JSON config files when loading canonical config or importing/updating client configs

### `mcpmatrix backups list [--client <codex|claude|gemini>]`

Lists versioned backups stored in `~/.mcpmatrix/backups/`.

Output includes:

- client group
- backup file name
- inferred timestamp
- full backup path

If no backups exist, the command prints an empty-state message and exits successfully.

### `mcpmatrix rollback [--client <codex|claude|gemini>] [--backup <name-or-path>]`

Restores versioned backups into the live client config files.

Behavior:

- without flags, restores the latest backup for Codex, Claude, and Gemini
- with `--client`, restores only the latest backup for that client
- with `--backup`, restores a specific backup file by base name from `~/.mcpmatrix/backups/` or by absolute path
- when `--backup` and `--client` are both provided, the backup must belong to that client

Failure rules:

- global rollback is strict: if any required client backup is missing, nothing is restored
- single-client rollback fails when no backup exists for that client
- an invalid or mismatched backup argument exits non-zero
- rollback does not create a new backup entry for the restored files

### `mcpmatrix tui [--repo <path>]`

Opens an interactive terminal UI for the detected repo. The TUI can:

- visualize active MCP servers
- inspect repo status and `doctor` output
- open `~/.mcpmatrix/config.yml` in `$EDITOR`
- enable or disable repo-local MCPs in `scopes.repos.<repo>.enable`

Current limitation from the canonical schema:

- inherited servers from `global` or `tags` are visible in the TUI but cannot be disabled there, because scope merging is additive only

## Configuration

Global config location:

```text
~/.mcpmatrix/config.yml
```

Public schema:

```yaml
servers:
  <server-name>:
    command: string
    args: string[]
    env:
      <ENV_NAME>: string

scopes:
  global:
    enable: string[]

  tags:
    <tag-name>:
      enable: string[]

  repos:
    <absolute-path>:
      tags: string[]
      enable: string[]
```

Rules:

- server names must be unique
- scopes are additive
- resolution order is `global -> tags -> repo`
- duplicate server names are removed while preserving first appearance
- env references must use `${env:VAR_NAME}` when interpolation syntax is used
- repo matching uses normalized absolute paths across Windows, Linux, and macOS

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run checks:

```bash
npm run lint
npm run typecheck
npm test
npm run test:docs
npm run test:smoke
npm run pack:check
```

## Release

The public scoped package `@mokivan/mcpmatrix` is published from GitHub Actions, either after merges to `master` or from a manual run of the `Release` workflow. The workflow is guarded by version and registry checks. Release workflow details live in [`docs/releasing.md`](/c:/Users/ivan_/repos/mcpmatrix/docs/releasing.md).

## Compatibility

- supported runtime: Node.js `20+`
- supported clients: Codex CLI, Claude Code CLI, Gemini CLI
- semver applies to the documented CLI only
- importing package internals is outside the support contract and may break without notice

## Troubleshooting

- `validate` failing on a command usually means the executable is not available in local `PATH` or is not an executable file path
- `doctor` fails when a referenced env var is missing or a configured repo path no longer exists
- `import` fails when `~/.mcpmatrix/config.yml` already exists or when the same server name has conflicting definitions across clients
- `apply` failures should restore the previous client state; inspect the reported target path and backup files if the error persists
- if a client config contains a UTF-8 BOM on Windows, mcpmatrix should still parse it correctly; if it does not, treat that as a bug
- use `mcpmatrix backups list` to inspect available restore points before running `mcpmatrix rollback`

## Documentation Guard

When a roadmap phase is implemented or the supported client matrix changes, update this README in the same change.

Minimum README updates for that case:

- supported clients
- user-facing commands or setup changes
- release and install instructions if package metadata changes
- keep `docs/specs/spec-cli.md` aligned with the public CLI surface
- keep `npm run test:docs` passing

## Source of Truth

Implementation follows this order:

1. roadmap documents in [`docs/`](/c:/Users/ivan_/repos/mcpmatrix/docs)
2. canonical specifications in [`docs/specs/`](/c:/Users/ivan_/repos/mcpmatrix/docs/specs)
3. code in [`src/`](/c:/Users/ivan_/repos/mcpmatrix/src)

Canonical specs are the files prefixed with `spec-`.
