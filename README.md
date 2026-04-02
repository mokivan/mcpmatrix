# mcpmatrix

Define MCP servers once and generate client configs from a single canonical configuration.

Current stable release: `0.1.0`

`@mokivan/mcpmatrix@0.1.0` officially supports:

- Codex CLI
- Claude Code CLI

`0.1.0` does not include:

- Gemini CLI support
- import from existing client configs
- TUI or diagnostics commands

Next planned roadmap phase:

- `v1`: Gemini CLI support, config import, stronger validation, npm distribution polish

## Install

Global install from npm:

```bash
npm install -g @mokivan/mcpmatrix
```

Available binaries:

- `mcpmatrix`
- `mmx`

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

3. Preview and apply:

```bash
mcpmatrix plan
mcpmatrix apply
```

## Commands

### `mcpmatrix init`

Creates the initial config file at `~/.mcpmatrix/config.yml`.

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

Client outputs in `0.1.0`:

- Codex: `~/.codex/config.toml`
- Claude Code: `~/.claude.json`

Write behavior:

- Codex updates only a managed `mcpmatrix` block inside `config.toml`
- Claude updates only the `mcpServers` section inside `.claude.json`
- existing content outside those managed areas is preserved
- existing files are backed up before overwrite

Backup files:

- `~/.codex/config.toml.bak`
- `~/.claude.json.bak`

Restore examples:

```bash
cp ~/.codex/config.toml.bak ~/.codex/config.toml
cp ~/.claude.json.bak ~/.claude.json
```

## Configuration

Global config location:

```text
~/.mcpmatrix/config.yml
```

Public schema in `0.1.0`:

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

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm run lint
npm test
npm run test:smoke
```

## Release

`0.1.0` is published as the public scoped package `@mokivan/mcpmatrix` from GitHub Actions after merges to `master`, guarded by version and registry checks. Release workflow details live in [`docs/releasing.md`](/c:/Users/ivan_/repos/mcpmatrix/docs/releasing.md).

Published package:

- `@mokivan/mcpmatrix@0.1.0`

## Source of Truth

Implementation follows this order:

1. roadmap documents in [`docs/`](/c:/Users/ivan_/repos/mcpmatrix/docs)
2. canonical specifications in [`docs/specs/`](/c:/Users/ivan_/repos/mcpmatrix/docs/specs)
3. code in [`src/`](/c:/Users/ivan_/repos/mcpmatrix/src)

Canonical specs are the files prefixed with `spec-`.
