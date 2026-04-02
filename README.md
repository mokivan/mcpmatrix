# mcpmatrix

Define MCP servers once and generate client configs from a single canonical configuration.

This version supports:

- Codex CLI
- Claude Code CLI
- Gemini CLI
- config import from existing client files
- explicit config validation

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
mcpmatrix plan
mcpmatrix apply
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

- Codex updates only a managed `mcpmatrix` block inside `config.toml`
- Claude updates only the `mcpServers` section inside `.claude.json`
- Gemini updates only the `mcpServers` section inside `settings.json`
- existing content outside those managed areas is preserved
- existing files are backed up before overwrite
- `apply` is transactional across supported clients: either all targets are updated or the previous state is restored

Backup files:

- `~/.codex/config.toml.bak`
- `~/.claude.json.bak`
- `~/.gemini/settings.json.bak`

Rollback behavior:

- if any target write fails, `mcpmatrix apply` exits non-zero
- mcpmatrix restores all supported client files to their pre-apply state
- a failed apply should never leave a mixed client state behind

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
- `import` fails when `~/.mcpmatrix/config.yml` already exists or when the same server name has conflicting definitions across clients
- `apply` failures should restore the previous client state; inspect the reported target path and backup files if the error persists

## Documentation Guard

When a roadmap phase is implemented or the supported client matrix changes, update this README in the same change.

Minimum README updates for that case:

- supported clients
- user-facing commands or setup changes
- release and install instructions if package metadata changes

## Source of Truth

Implementation follows this order:

1. roadmap documents in [`docs/`](/c:/Users/ivan_/repos/mcpmatrix/docs)
2. canonical specifications in [`docs/specs/`](/c:/Users/ivan_/repos/mcpmatrix/docs/specs)
3. code in [`src/`](/c:/Users/ivan_/repos/mcpmatrix/src)

Canonical specs are the files prefixed with `spec-`.
