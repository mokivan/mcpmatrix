# mcpmatrix

**One config for every MCP client. Per-project servers without copy-pasting JSON.**

[![npm](https://img.shields.io/npm/v/@mokivan/mcpmatrix)](https://www.npmjs.com/package/@mokivan/mcpmatrix)
[![CI](https://github.com/mokivan/mcpmatrix/actions/workflows/ci.yml/badge.svg)](https://github.com/mokivan/mcpmatrix/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@mokivan/mcpmatrix)](LICENSE)
[![node](https://img.shields.io/node/v/@mokivan/mcpmatrix)](https://nodejs.org)

## The problem

Codex uses TOML. Claude Code, Gemini CLI, and GitHub Copilot each use their own JSON shape, in different files, at different scopes. Add a few MCP servers, want some of them only in certain projects, and you end up hand-editing five files that drift apart.

mcpmatrix keeps **one** YAML file and generates all of them.

## Before / after

You write this once, in `~/.mcpmatrix/config.yml`:

```yaml
servers:
  github:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${env:GITHUB_TOKEN}
  medusa:
    transport: remote
    protocol: http
    url: https://docs.medusajs.com/mcp

scopes:
  global:
    enable: [github]
  repos:
    "/home/you/dev/store":
      enable: [medusa]
```

`mcpmatrix apply` then writes the right format to the right place for each client:

| Client | Global | Repo-scoped |
|--------|--------|-------------|
| Codex CLI | `~/.codex/config.toml` | `<repo>/.codex/config.toml` |
| Claude Code | `~/.claude.json` | `<repo>/.mcp.json` |
| Gemini CLI | `~/.gemini/settings.json` | `<repo>/.gemini/settings.json` |
| Copilot CLI | `~/.copilot/mcp-config.json` | `<repo>/.github/mcp.json` |
| Copilot VS Code | user profile `mcp.json` | `<repo>/.vscode/mcp.json` |

![Recording: the YAML config, mcpmatrix plan, mcpmatrix apply, and the resulting ~/.claude.json](https://raw.githubusercontent.com/mokivan/mcpmatrix/master/docs/assets/demo.gif)

*Real output from a throwaway home directory; paths are shown as `~`. Note that `my-notes`, a server added by hand, is kept, and `${env:GITHUB_TOKEN}` becomes `${GITHUB_TOKEN}` for Claude Code.*

## Why mcpmatrix

- **Scopes that stack:** `global → tags → repo`. Enable a server everywhere, for a stack (tag), or for one repository.
- **Safe writes:** every write is backed up and `apply` is transactional across all selected clients. A failure restores the previous state. `mcpmatrix rollback` restores backups on demand.
- **Scoped writes:** only the MCP section of each client file is rewritten (`mcpServers` / `servers`, or a managed block in Codex's TOML). Everything else is preserved, including servers you added by hand: mcpmatrix remembers the names it wrote (in `~/.mcpmatrix/state.json`) and only updates or removes those.
- **Look before you write:** `mcpmatrix plan` shows exactly which files change; `mcpmatrix doctor` checks commands, env vars, and per-client compatibility.
- **Start from what you have:** `mcpmatrix import` builds the YAML from your existing client configs.

## How it compares

Several tools sync MCP configs across AI clients. Going by their READMEs as of November 2026:

- [`add-mcp`](https://github.com/neondatabase/add-mcp) installs a server into many agents with one command (project or global). It is imperative: there is no central file describing what should be enabled where.
- [`mcpick`](https://github.com/spences10/mcpick) manages servers interactively with profiles, audits, and backups.
- [`agents`](https://github.com/amtiYo/agents) keeps one `.agents` source per project and syncs MCP servers, skills, and instructions from it.
- [`mcpm`](https://github.com/pathintegral-institute/mcpm.sh) is a package manager and registry with profiles and a router.

mcpmatrix is for the case where you want **one declarative file for your whole machine**: servers enabled globally, per stack (tags), or per repository, applied to every client in its own format, with `plan` before and rollback after. If you only need to add a server to a few clients, each client's own `mcp add` or `add-mcp` is simpler.

## What it does not do

- It does not install MCP servers or run them.
- It does not store secrets: reference environment variables with `${env:VAR_NAME}`.
- It is a CLI. Importing its internals as a library is unsupported.

## Try it without installing

```bash
npx @mokivan/mcpmatrix import   # build the YAML from your existing client configs
npx @mokivan/mcpmatrix plan     # preview what would change
npx @mokivan/mcpmatrix apply    # write the client configs (with backups)
```

Contributing and the spec-driven workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Supported clients

This version supports:

- Codex CLI
- Claude Code CLI
- Gemini CLI
- GitHub Copilot CLI
- GitHub Copilot VS Code
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
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${env:GITHUB_TOKEN}

  medusa:
    transport: remote
    protocol: http
    url: https://docs.medusajs.com/mcp

scopes:
  global:
    enable:
      - github

  tags:
    ecommerce:
      enable:
        - medusa

  repos:
    "/home/you/dev/store":
      tags: ["ecommerce"]
      enable: []
```

3. Validate, preview, and apply:

```bash
mcpmatrix validate
mcpmatrix doctor
mcpmatrix schema
mcpmatrix plan
mcpmatrix apply
mcpmatrix apply --clients auto
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
- GitHub Copilot CLI: `~/.copilot/mcp-config.json`
- GitHub Copilot VS Code: default user profile `mcp.json`

Import rules:

- import fails if `~/.mcpmatrix/config.yml` already exists
- imported servers become `servers`
- imported server names are enabled in `scopes.global.enable`
- Codex imports `command` as `transport: stdio` and `url` as `transport: remote`
- Claude imports stdio, remote HTTP, and remote SSE entries
- Gemini imports stdio and remote HTTP entries using `httpUrl`
- GitHub Copilot CLI imports stdio plus remote HTTP and SSE entries from `mcpServers`; `tools` must be `["*"]`
- GitHub Copilot VS Code imports stdio plus remote HTTP and SSE entries from `servers`; configs using `inputs` or other VS Code-only MCP metadata are rejected
- conflicting canonical definitions for the same server name cause import to fail

## Commands

### `mcpmatrix init`

Creates the initial config file at `~/.mcpmatrix/config.yml`.

### `mcpmatrix import`

Imports existing MCP client configs into the canonical YAML file.

### `mcpmatrix schema`

Prints the packaged JSON Schema path and `file://` URI for `~/.mcpmatrix/config.yml`.

This is useful when your editor does not automatically pick up the schema header or when you want to configure schema association manually.

### `mcpmatrix validate`

Validates:

- YAML syntax
- env reference syntax
- scope references to defined servers
- stdio commands available in PATH or by executable path
- remote MCP URLs and auth structure

### `mcpmatrix doctor [--repo <path>]`

Runs a fuller diagnostic pass:

- MCP commands resolve locally
- remote MCP URLs are structurally valid
- referenced environment variables are defined
- configured repo paths are accessible
- the detected repo can be resolved and inspected
- stack files suggest tags without modifying config automatically
- compatibility is reported for Codex, Claude, Gemini, GitHub Copilot CLI, and GitHub Copilot VS Code

Suggested stack tags:

- `package.json` -> `node`
- `pom.xml` -> `java`
- `.csproj` -> `dotnet`

### `mcpmatrix plan [--repo <path>]`

Resolves the active server set for the current repository and shows:

- detected repo path
- active tags
- active servers
- global vs repo-scoped server partitions
- transport and per-client compatibility
- files that would be updated
- estimated diff size

Repository detection order:

1. `--repo <path>`
2. search upward for `.git`
3. current working directory

### `mcpmatrix apply [--repo <path>] [--clients <all|auto|client1,client2,...>]`

Resolves the same server set and writes client configs.

Client outputs:

- Codex global: `~/.codex/config.toml`
- Codex repo-scoped: `<repo>/.codex/config.toml`
- Claude Code global: `~/.claude.json`
- Claude Code repo-scoped: `<repo>/.mcp.json`
- Gemini global: `~/.gemini/settings.json`
- Gemini repo-scoped: `<repo>/.gemini/settings.json`
- GitHub Copilot CLI global: `~/.copilot/mcp-config.json`
- GitHub Copilot CLI repo-scoped: `<repo>/.github/mcp.json`
- GitHub Copilot VS Code global: VS Code default user profile `mcp.json`
- GitHub Copilot VS Code repo-scoped: `<repo>/.vscode/mcp.json`

Write behavior:

- by default, `apply` targets all supported clients
- `--clients auto` targets only clients with an existing managed config file or a detected CLI command in `PATH`
- `--clients codex,claude,copilot-cli,copilot-vscode` targets only the named clients
- global scope writes only servers resolved from `scopes.global.enable`
- repo scope writes only servers resolved from the matched repo's `tags` and `enable`, excluding names already active globally
- Codex updates only a managed `mcpmatrix` block inside each `config.toml`, using named TOML tables under `mcp_servers`
- Claude updates only the `mcpServers` section inside `.claude.json` and `.mcp.json`
- Gemini updates only the `mcpServers` section inside `settings.json`
- GitHub Copilot CLI updates only the `mcpServers` section inside `mcp-config.json` and `.github/mcp.json`, writing `tools: ["*"]`
- GitHub Copilot VS Code updates only the `servers` section inside `mcp.json`
- stdio and supported remote transports are rendered per client format
- with `--clients all` (default) or `auto`, a server that a client cannot represent is skipped for that client with a warning, and the rest is still written
- with an explicit `--clients` list, a server that a listed client cannot represent makes `apply` fail before writing
- existing content outside those managed areas is preserved, including servers added by hand; only names recorded in `~/.mcpmatrix/state.json` are replaced or removed
- Codex fails with a clear error if a hand-written `[mcp_servers.<name>]` table outside the managed block has the same name as a managed server
- existing files are backed up before overwrite
- `apply` is transactional across all selected targets: either all global and repo-scoped files are updated or the previous state is restored

Backup files:

- stored in `~/.mcpmatrix/backups/`
- filenames are versioned by client and scope, for example `codex-global-YYYY-MM-DD-HH-MM.toml`
- each backup stores metadata for the exact live target path
- the latest 3 backups are retained per exact target file, plus the original one (the first backup ever taken of that file), which is never rotated out
- backup files and the backups directory are private to your user (`0600` / `0700` on POSIX)

Rollback behavior:

- if any target write fails, `mcpmatrix apply` exits non-zero
- mcpmatrix restores all selected client files to their pre-apply state
- a failed apply should never leave a mixed client state behind

Compatibility note:

- mcpmatrix tolerates UTF-8 BOM-prefixed YAML, TOML, and JSON config files when loading canonical config or importing/updating client configs

### `mcpmatrix backups list [--client <codex|claude|gemini|copilot-cli|copilot-vscode>] [--repo <path>]`

Lists versioned backups stored in `~/.mcpmatrix/backups/`.

Output includes:

- client group
- scope
- backup file name
- inferred timestamp
- live target path
- full backup path

If no backups exist, the command prints an empty-state message and exits successfully.

### `mcpmatrix rollback [--client <codex|claude|gemini|copilot-cli|copilot-vscode>] [--backup <name-or-path>] [--repo <path>]`

Restores versioned backups into the live client config files.

Behavior:

- without flags, restores the latest global backup for every supported client
- with `--client`, restores only the latest backup for that client in the selected scope
- with `--repo`, restores the latest repo-scoped backups for that repository
- with `--backup`, restores a specific backup file by base name from `~/.mcpmatrix/backups/` (an absolute path is accepted only if it points inside that directory, and the backup's recorded target must be the expected client config path)
- when `--backup` and `--client` are both provided, the backup must belong to that client
- when `--backup` and `--repo` are both provided, the backup must belong to that repo and be repo-scoped

Failure rules:

- global rollback is strict: if any required client backup is missing, nothing is restored
- repo rollback is strict: if any required repo-scoped client backup is missing, nothing is restored
- single-client rollback fails when no backup exists for that client
- an invalid or mismatched backup argument exits non-zero
- rollback does not create a new backup entry for the restored files

### `mcpmatrix tui [--repo <path>]`

Opens an interactive terminal UI for the detected repo. The TUI can:

- visualize active MCP servers
- inspect repo status and `doctor` output
- open `~/.mcpmatrix/config.yml` in `$EDITOR`
- enable or disable repo-local MCPs in `scopes.repos.<repo>.enable`

Keyboard shortcuts:

- `↑` / `↓` move the selection
- `Enter` or `Space` toggles the selected repo-local MCP
- `/` filters the server list by name
- `d` opens the structured `doctor` report
- `e` opens the canonical config in `$EDITOR` and reloads on exit
- `r` refreshes repo detection and resolved server state
- `q` or `Esc` exits the current view or closes the TUI

Current limitation from the canonical schema:

- inherited servers from `global` or `tags` are visible in the TUI but cannot be disabled there, because scope merging is additive only

## Configuration

Global config location:

```text
~/.mcpmatrix/config.yml
```

Autocomplete support:

- `mcpmatrix init` writes a `yaml-language-server` schema header into the generated config file
- `mcpmatrix schema` prints the packaged schema path and URI for manual editor setup
- packaged schema file: `schemas/mcpmatrix-config.schema.json`

Public schema:

```yaml
servers:
  <server-name>:
    transport: stdio
    command: string
    args: string[]
    env:
      <ENV_NAME>: string

  <server-name>:
    transport: remote
    protocol: auto | http | sse
    url: string
    headers:
      <HEADER_NAME>: string
    auth:
      type: none | bearer | oauth

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
- `stdio` servers use `command`, `args`, and `env`
- `remote` servers use `protocol`, `url`, `headers`, and `auth`
- scopes are additive
- resolution order is `global -> tags -> repo`
- duplicate server names are removed while preserving first appearance
- env references must use `${env:VAR_NAME}` when interpolation syntax is used
- interpolation may appear in any string field
- repo matching uses normalized absolute paths across Windows, Linux, and macOS

## Environment variables

Write references once as `${env:VAR_NAME}`. mcpmatrix translates them for each client when it writes the config, and refuses to write a reference a client cannot express (it never writes the literal `${env:...}` text):

| Client | Result |
|--------|--------|
| Claude Code | `${VAR_NAME}` in command, args, env, url, and headers |
| Gemini CLI | `${VAR_NAME}` in `env` values only |
| Codex CLI | `env_vars = ["VAR_NAME"]` when the entry is `VAR_NAME: ${env:VAR_NAME}` (same name only) |
| Copilot VS Code | `${env:VAR_NAME}` unchanged |
| Copilot CLI | not supported: its docs do not describe variable expansion, so `plan` and `apply` report an error. Use a literal value or choose clients with `--clients` |

`mcpmatrix plan` and `mcpmatrix doctor` show which clients can represent each server. For remote servers, `auth: bearer` is written to Claude Code as an `Authorization` header.

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
npm run test:release
npm run test:smoke
npm run pack:check
```

Contributor guide:

- adding a new supported client: [`docs/adding-supported-client.md`](docs/adding-supported-client.md)

## Release

The public scoped package `@mokivan/mcpmatrix` is published from GitHub Actions, either after merges to `master` or from a manual run of the `Release` workflow. The workflow is guarded by version and registry checks. Release workflow details live in [`docs/releasing.md`](docs/releasing.md).

## Compatibility

- supported runtime: Node.js `20+`
- supported clients: Codex CLI, Claude Code CLI, Gemini CLI, GitHub Copilot CLI, GitHub Copilot VS Code
- semver applies to the documented CLI only
- importing package internals is outside the support contract and may break without notice

## Troubleshooting

- `validate` failing on a command usually means the executable is not available in local `PATH` or is not an executable file path
- `validate` failing on a remote server usually means the `url`, `protocol`, or `auth` block is malformed
- `doctor` fails when a referenced env var is missing or a configured repo path no longer exists
- `doctor` also reports active servers that cannot be applied to one or more supported clients, including GitHub Copilot CLI and GitHub Copilot VS Code
- `import` fails when `~/.mcpmatrix/config.yml` already exists or when the same server name has conflicting canonical definitions across clients
- `import` also fails for Copilot/VS Code configs that use `tools` filtering, `inputs`, or other MCP metadata that cannot be normalized into the canonical model
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
- when `package.json.version` changes, add the matching `CHANGELOG.md` section and keep `npm run test:release` passing

## Source of Truth

Implementation follows this order:

1. roadmap documents in [`docs/`](docs)
2. canonical specifications in [`docs/specs/`](docs/specs)
3. code in [`src/`](src)

Canonical specs are the files prefixed with `spec-`.
