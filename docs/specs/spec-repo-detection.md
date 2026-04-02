# mcpmatrix Spec — Repository Detection

mcpmatrix must determine which repository configuration to apply.

## Detection Strategy

Order of precedence:

1. CLI flag

mcpmatrix apply --repo <path>

2. Git root detection

Search upward from current directory until:

.git

is found.

3. Current working directory

Fallback when no Git repository exists.

## Path Normalization

All paths must be normalized to support:

- Windows
- Linux
- macOS

Examples:

C:\dev\project
/home/user/project
/Users/user/project

## Matching Strategy

Exact path match is attempted first.

If no match:

- fallback to tags
- fallback to global scope

## Behavior when repo is unknown

mcpmatrix should:

1. apply global configuration
2. warn the user that the repository is not configured