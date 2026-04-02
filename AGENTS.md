# AGENTS.md

This repository is designed for agent-assisted development.

## Development Flow

1. Read roadmap documents in `docs/`
2. Read canonical specifications in `docs/specs/spec-*.md`
3. Use non-prefixed docs in `docs/specs/` only as short summaries
4. Implement code in `src/`

Agents must never invent behavior that contradicts the specifications.

## Core Rules

- Resolver must be deterministic
- Adapters must not modify logic
- Resolver returns the canonical server list

## Architecture

resolver -> adapters -> client configs

## Documentation Rules

- Treat the `spec-*` files as the source of truth when a summary doc is shorter or less precise
- If implementation changes the current roadmap phase, supported clients, commands, or setup flow, update `README.md` in the same change
- Do not claim support for roadmap features before that roadmap phase is implemented

Agents should implement features following the roadmap phases.
