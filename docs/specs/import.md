# Import Summary

Canonical spec:

- `docs/specs/spec-import.md`

Summary:

- `mcpmatrix import` reads Codex, Claude Code, and Gemini MCP configs from the user home directory
- output is `~/.mcpmatrix/config.yml`
- imported servers populate `servers` and `scopes.global.enable`
- import fails if the canonical config already exists
- duplicate server names are allowed only when definitions are identical across clients
