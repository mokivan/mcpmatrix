# Import Summary

Canonical spec:

- `docs/specs/spec-import.md`

Summary:

- `mcpmatrix import` reads Codex, Claude Code, Gemini, GitHub Copilot CLI, and GitHub Copilot VS Code MCP configs from supported global user locations
- output is `~/.mcpmatrix/config.yml`
- imported servers populate `servers` and `scopes.global.enable`
- stdio and supported remote client entries are normalized into the canonical transport model
- import fails if the canonical config already exists
- duplicate server names are allowed only when definitions are identical across clients
