# mcpmatrix Spec - Backups and Rollback

mcpmatrix stores versioned client configuration backups and can restore them through the CLI.

## Backup Storage

Backup directory:

`~/.mcpmatrix/backups/`

Supported targets:

- Codex: `config-YYYY-MM-DD-HH-MM(.suffix).toml`
- Claude Code: `claude-YYYY-MM-DD-HH-MM(.suffix).json`
- Gemini: `settings-YYYY-MM-DD-HH-MM(.suffix).json`

When multiple backups are created in the same minute for the same target, a numeric suffix may be appended.

Retention:

- keep the latest 3 backups per target

## Listing Backups

Command:

`mcpmatrix backups list [--client <codex|claude|gemini>]`

Behavior:

- list detected backups from newest to oldest
- group output by client
- include file name, inferred timestamp, and full backup path
- succeed with an empty-state message when no backups exist

## Rollback

Command:

`mcpmatrix rollback [--client <codex|claude|gemini>] [--backup <name-or-path>]`

Default behavior:

- without flags, restore the latest backup for every supported client

Client-scoped behavior:

- `--client` restores only the latest backup for that client

Explicit backup behavior:

- `--backup` accepts either a backup file name from `~/.mcpmatrix/backups/` or an absolute path
- if `--client` is also provided, the selected backup must belong to that client

## Failure Rules

Rollback must fail when:

- a required latest backup does not exist
- the selected backup file does not exist
- the selected backup file name does not match a supported client target
- `--backup` and `--client` refer to different clients

Global rollback is strict:

- if any supported client lacks a required backup, no files are modified

Rollback write behavior:

- restores use atomic file replacement
- rollback must not create a new versioned backup entry
- if a multi-file rollback fails after partially restoring files, mcpmatrix must restore already-modified files to their pre-rollback state
