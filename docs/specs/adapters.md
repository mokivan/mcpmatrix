# Adapters Summary

Canonical spec:

- `docs/specs/spec-adapters.md`

Summary:

- adapters translate canonical config to client configs
- supported clients are Codex CLI, Claude Code CLI, Gemini CLI, GitHub Copilot CLI, and GitHub Copilot VS Code
- adapters preserve supported stdio and remote transport fields per client
- adapters write client-specific output only
