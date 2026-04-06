# Adding a Supported Client

This guide documents the expected steps and constraints for adding a new supported MCP client or LLM integration to `mcpmatrix`.

Use this when evaluating or implementing support for a client such as Copilot.

## Core Principle

`mcpmatrix` has one canonical configuration and one canonical resolver.

A new client must be added as:

- a new adapter
- a new compatibility target
- a new import/apply/rollback surface

It must not change resolver semantics to fit one client.

## Source of Truth

Read these files first:

1. `docs/roadmap-v*.md`
2. `docs/specs/spec-resolver.md`
3. `docs/specs/spec-adapters.md`
4. `docs/specs/spec-import.md`
5. `docs/specs/spec-cli.md`
6. `docs/specs/spec-development-methodology.md`

Non-`spec-` docs can summarize behavior, but the `spec-*` files are canonical.

## Design Rules

- keep the resolver deterministic
- keep the canonical server list as the source of truth
- do not move client-specific logic into the resolver
- do not silently drop unsupported fields
- reject unsupported client/transport combinations before writing files
- preserve user content outside the client-managed section
- keep apply transactional across all selected targets

## Before Writing Code

Define the client contract explicitly:

- client id used in code and CLI
- global config file path
- repo-scoped config file path, if supported
- managed section or merge strategy
- supported transports: `stdio`, remote `http`, remote `sse`, or a subset
- support for remote `headers`
- support for persisted `auth`
- import support from existing client config, if any
- auto-detection command names for `--clients auto`
- backup filename extension and target metadata

If any of those are unclear, the client is not specified enough to implement safely.

## Required Specification Changes

If the client is being officially added, update the canonical specs before or with the implementation:

- `docs/specs/spec-adapters.md`
- `docs/specs/spec-import.md` if import is supported
- `docs/specs/spec-cli.md` if the public CLI surface or documented client lists change
- any roadmap document affected by the new support level

If the change affects supported clients, commands, or setup flow, update `README.md` in the same change.

## Implementation Areas

At minimum, review and extend these areas:

- `src/types.ts`
- `src/core/client-selection.ts`
- `src/core/apply.ts`
- `src/core/importer.ts`
- `src/core/rollback.ts`
- `src/utils/backup.ts`
- `src/utils/paths.ts`
- `src/core/server-config.ts`
- `src/core/doctor.ts`
- `src/cli/commands/plan.ts`
- `src/cli/commands/doctor.ts`
- `src/cli/commands/rollback.ts`
- `src/cli/commands/backups.ts`
- `src/cli/commands/tui-*`
- `src/adapters/<client>/`

Typical work items:

1. add the client to the `SupportedClient` type and client lists
2. add config path helpers for global and repo scope
3. implement reader/writer or merge logic for the client format
4. add compatibility checks for every canonical transport/auth combination
5. include the client in `apply` target preparation
6. include the client in backup creation and rollback resolution
7. include the client in import source detection and normalization, if supported
8. include the client in doctor, plan, and TUI compatibility reporting
9. update CLI help text and any client-specific option validation

## Compatibility Policy

The adapter layer translates canonical config into client format.

It may:

- rename fields
- restructure data to match client syntax
- preserve only fields the target client can represent

It must not:

- change resolver ordering
- infer new canonical behavior
- silently discard unsupported remote metadata
- write partial output after a known incompatibility

If the client cannot represent a canonical server, fail with a clear incompatibility reason before any writes occur.

## Import Policy

Only add import support when the client format can be normalized back into the canonical model without ambiguity.

Document:

- which source file is imported
- which entry shapes are accepted
- which fields map into canonical `stdio` and `remote`
- what conflict rules apply when the same server appears in multiple clients

If import is not supported, say so explicitly rather than guessing from the client file.

## Testing Requirements

Adding a supported client requires targeted tests, not only manual checks.

Add or update tests for:

- adapter rendering
- adapter incompatibility behavior
- client auto-selection and detection
- import parsing, if supported
- apply target selection
- transactional rollback on apply failure
- backup listing and restore behavior
- doctor and plan compatibility output
- TUI model output if the client appears there

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:smoke
npm run pack:check
```

## Documentation Checklist

When the client becomes officially supported, update:

- `README.md`
- `docs/specs/spec-adapters.md`
- `docs/specs/spec-import.md` if applicable
- `docs/specs/spec-cli.md` if client lists or CLI docs change
- roadmap docs if the support changes a phase or milestone

Do not claim support in docs before the adapter, compatibility checks, backups, and tests are actually implemented.

## Common Failure Modes

- changing resolver behavior to satisfy one client
- adding the adapter but forgetting import, rollback, or backups
- allowing silent degradation of `headers`, `auth`, or `sse`
- updating `README.md` but not the canonical specs
- adding the client to explicit selection but not to `--clients auto`
- writing repo-scoped support without defining a repo-scoped file contract

## Minimal Acceptance Checklist

Before calling the client supported, verify all of the following:

- the client contract is documented
- the canonical specs mention the new client where required
- `plan` reports compatibility correctly
- `doctor` reports compatibility correctly
- `apply` writes the client config in both supported scopes
- `apply` rejects incompatible servers before writes
- backups and rollback work for the client
- import works or is explicitly documented as unsupported
- tests cover the new client path end to end
