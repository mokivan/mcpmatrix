# mcpmatrix Spec - Config Validation

`mcpmatrix validate` checks that the canonical mcpmatrix configuration is well-formed and locally executable.

## Input

Configuration file:

`~/.mcpmatrix/config.yml`

## Validation Rules

The command must fail when any of these checks fail:

1. YAML syntax is invalid
2. env interpolation syntax is invalid
3. a scope references an undefined server
4. a server command cannot be resolved locally

## Env Syntax

When interpolation syntax is used, the supported form is:

`${env:VAR_NAME}`

## Command Resolution

Server commands are valid when either:

- the command resolves from system `PATH`
- the command is an executable file path

Command validation is local only.

The command does not require environment variables to be defined at validation time.

## Output

- success prints a confirmation message
- failure prints an error and exits non-zero
