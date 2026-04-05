# mcpmatrix Spec - Config Validation

`mcpmatrix validate` checks that the canonical mcpmatrix configuration is well-formed and locally executable or remotely valid.

## Input

Configuration file:

`~/.mcpmatrix/config.yml`

## Validation Rules

The command must fail when any of these checks fail:

1. YAML syntax is invalid
2. env interpolation syntax is invalid
3. a scope references an undefined server
4. a stdio server command cannot be resolved locally
5. a remote server URL is invalid or not `http`/`https`
6. remote auth structure is malformed

## Env Syntax

When interpolation syntax is used, the supported form is:

`${env:VAR_NAME}`

Interpolation may appear in any string field in the canonical config.

## Transport Validation

### `stdio`

Server commands are valid when either:

- the command resolves from system `PATH`
- the command is an executable file path

### `remote`

Remote servers are valid when:

- `url` is an absolute `http://` or `https://` URL
- `protocol` is `auto`, `http`, or `sse`
- `headers` values are strings
- `auth` matches one of the supported auth shapes

Command validation is local only.

The command does not require environment variables to be defined at validation time.

## Output

- success prints a confirmation message
- failure prints an error and exits non-zero
