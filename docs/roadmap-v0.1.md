# mcpmatrix Roadmap - v0.1 (MVP)

## Goal

Create a functional `mcpmatrix` MVP able to:

- read a central YAML configuration
- resolve `global`, `tags`, and `repos` scopes
- detect the current repository
- generate MCP configuration for:
  - Codex CLI
  - Claude Code CLI
- apply configuration in the correct files
- generate backups before modifying files

Does not include:

- MCP server installation
- import from existing client configs
- Gemini support
- TUI

## Initial Architecture

Target architecture for this phase:

```text
src/
  cli/
    index.ts
    commands/
      init.ts
      plan.ts
      apply.ts
  core/
    config-loader.ts
    resolver.ts
    repo-detector.ts
  adapters/
    codex/
      writer.ts
    claude/
      writer.ts
  utils/
    paths.ts
    backup.ts
    logger.ts
```

This is a target structure for the phase, not a claim that every file already exists.

## Configuration File

Location:

`~/.mcpmatrix/config.yml`

Initial format:

```yaml
servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${env:GITHUB_TOKEN}

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
```

## Resolution Algorithm

1. Load YAML config.
2. Detect current repo.
3. Apply `global.enable`.
4. Apply tag-based `enable`.
5. Apply repo-based `enable`.
6. Deduplicate servers.
7. Generate final canonical list.

## Repository Detection

Order:

1. `--repo` flag
2. search upward for `.git`
3. fallback to `cwd`

## CLI Commands

### `init`

`mcpmatrix init`

Creates initial config at `~/.mcpmatrix/config.yml`.

### `plan`

`mcpmatrix plan`

Shows:

- active servers
- files that would be modified
- estimated diff

### `apply`

`mcpmatrix apply`

Steps:

1. resolve configuration
2. create backups of existing files
3. write configuration

## Output Files

Codex:

`~/.codex/config.toml`

Claude Code:

`~/.claude.json`

## Backups

Before modifying files:

- `config.toml.bak`
- `claude.json.bak`

## Minimum Testing

Goal:

Avoid breaking client config formats.

Tests:

- snapshot config for Codex
- snapshot config for Claude

Framework:

`vitest`

## Acceptance Criteria

`v0.1` is complete when:

- `mcpmatrix plan` works
- `mcpmatrix apply` generates valid config
- Codex and Claude recognize generated MCP servers
