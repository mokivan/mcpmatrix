# mcpmatrix Spec - Backups and Rollback

mcpmatrix stores versioned client configuration backups and can restore them through the CLI.

## Backup Storage

Backup directory:

`~/.mcpmatrix/backups/`

Supported targets:

- global Codex: `codex-global-YYYY-MM-DD-HH-MM(.suffix).toml`
- repo Codex: `codex-repo-YYYY-MM-DD-HH-MM(.suffix).toml`
- global Claude Code: `claude-global-YYYY-MM-DD-HH-MM(.suffix).json`
- repo Claude Code: `claude-repo-YYYY-MM-DD-HH-MM(.suffix).json`
- global Gemini: `gemini-global-YYYY-MM-DD-HH-MM(.suffix).json`
- repo Gemini: `gemini-repo-YYYY-MM-DD-HH-MM(.suffix).json`

Each backup also stores metadata for the exact live target path and, for repo-scoped backups, the repo path.

When multiple backups are created in the same minute for the same target, a numeric suffix may be appended.

Retention:

- keep the latest 3 backups per exact target file

## Listing Backups

Command:

`mcpmatrix backups list [--client <codex|claude|gemini>] [--repo <path>]`

Behavior:

- without `--repo`, list global backups from newest to oldest
- with `--repo`, list repo-scoped backups for that repository from newest to oldest
- group output by client
- include scope, file name, inferred timestamp, target path, and full backup path
- succeed with an empty-state message when no backups exist

## Rollback

Command:

`mcpmatrix rollback [--client <codex|claude|gemini>] [--backup <name-or-path>] [--repo <path>]`

Default behavior:

- without flags, restore the latest global backup for every supported client

Client-scoped behavior:

- `--client` restores only the latest backup for that client in the selected scope

Repo-scoped behavior:

- `--repo <path>` restores the latest repo-scoped backups for that repository

Explicit backup behavior:

- `--backup` accepts either a backup file name from `~/.mcpmatrix/backups/` or an absolute path
- if `--client` is also provided, the selected backup must belong to that client
- if `--repo` is also provided, the selected backup must belong to that repository and be repo-scoped

## Failure Rules

Rollback must fail when:

- a required latest backup does not exist
- the selected backup file does not exist
- the selected backup file name does not match a supported client target
- `--backup` and `--client` refer to different clients
- `--backup` and `--repo` refer to different repositories or scopes

Global rollback is strict:

- if any supported client lacks a required backup, no files are modified

Repo rollback is also strict:

- if any supported client lacks the required repo-scoped backup for the selected repo, no files are modified

Rollback write behavior:

- restores use atomic file replacement
- rollback must not create a new versioned backup entry
- if a multi-file rollback fails after partially restoring files, mcpmatrix must restore already-modified files to their pre-rollback state
