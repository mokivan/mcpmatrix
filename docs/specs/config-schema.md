# Config Schema Summary

Canonical spec:

- `docs/specs/spec-config-schema.md`

Summary:

- global config file is `~/.mcpmatrix/config.yml`
- top-level keys are `servers` and `scopes`
- servers use explicit `transport: stdio | remote`
- scopes are additive
- server names are unique
- env references may use `${env:VAR_NAME}` in any string field
