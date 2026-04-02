# Contributing to mcpmatrix

mcpmatrix is designed to support agent-assisted development and follows a workflow driven by roadmaps and specifications.

## Development Philosophy

mcpmatrix follows this pipeline:

roadmap -> specification -> task -> implementation

Meaning:

1. Roadmaps define milestones.
2. Canonical specs define expected behavior.
3. Tasks implement roadmap-scoped specs.
4. Code must match specs.

If a specification exists for a feature, do not invent behavior outside it.

## Canonical Documentation

Use documents in this order:

1. `docs/roadmap-v0.1.md`
2. `docs/roadmap-v1.md`
3. `docs/roadmap-v2.md`
4. `docs/specs/spec-*.md`
5. summary docs in `docs/specs/*.md` without the `spec-` prefix

The `spec-*` files are the source of truth.
The non-prefixed files are short summaries and must not contradict the canonical specs.

## Project Structure

Current structure:

```text
mcpmatrix
|-- AGENTS.md
|-- CONTRIBUTING.md
|-- README.md
|-- docs/
|   |-- roadmap-v0.1.md
|   |-- roadmap-v1.md
|   |-- roadmap-v2.md
|   `-- specs/
|       |-- spec-adapters.md
|       |-- spec-config-schema.md
|       |-- spec-development-methodology.md
|       |-- spec-repo-detection.md
|       |-- spec-resolver.md
|       |-- adapters.md
|       |-- config-schema.md
|       |-- output-contract.md
|       |-- repo-detection.md
|       |-- resolver-architecture.md
|       `-- resolver.md
|-- src/
|   |-- cli/
|   |-- core/
|   `-- utils/
|-- package.json
`-- tsconfig.json
```

Planned structure described in roadmap documents may be larger than the current repo state.
Do not treat roadmap examples as proof that a file already exists.

## Setup

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Contribution Workflow

1. Create a branch.
2. Implement the change.
3. Run relevant verification.
4. Update docs when behavior or support claims changed.
5. Submit a pull request.

Branch examples:

```text
feature/my-feature
fix/my-bug
```

## Commit Guidelines

Use clear commits:

```text
feat: add resolver pipeline
fix: correct repo detection
docs: update roadmap guard
refactor: simplify resolver
```

## Pull Request Rules

A PR should:

- reference a roadmap milestone when applicable
- respect canonical specifications
- avoid introducing unsupported roadmap claims
- include tests when applicable
- update `README.md` if supported clients, commands, setup, or current phase changed

## Working With Specs

Before implementing any feature:

1. Check `docs/specs/spec-*.md`
2. Verify the roadmap phase that allows the feature
3. Implement according to spec
4. Keep summary docs aligned if you touch the canonical spec

If a spec is missing:

- create the spec first
- discuss changes in the PR

## Agent Guidelines

Agents must:

1. Read `AGENTS.md`
2. Read canonical specs in `docs/specs/spec-*.md`
3. Follow roadmap phases
4. Avoid inventing behavior not defined in specs

Resolver logic must remain deterministic.

## Testing

Testing strategy:

- snapshot tests for config output
- resolver unit tests
- adapter tests

Goal:

Ensure generated configuration does not break client tools.

## Code Style

- TypeScript strict mode
- small pure functions
- deterministic outputs
