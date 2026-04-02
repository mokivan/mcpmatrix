# Validate Summary

Canonical spec:

- `docs/specs/spec-validate.md`

Summary:

- `mcpmatrix validate` checks canonical YAML structure and references
- env syntax must use `${env:VAR_NAME}`
- all referenced servers must exist in `servers`
- commands must resolve from `PATH` or from an executable path
- validation is static and local
