# mcpmatrix Development Methodology

mcpmatrix uses a hybrid development approach combining:

- roadmap-driven development
- specification-driven development

## Development Layers

1. Roadmap

Defines project phases and milestones.

- `docs/roadmap-v0.1.md`
- `docs/roadmap-v1.md`
- `docs/roadmap-v2.md`

2. Specifications

Define expected system behavior.

- `docs/specs/spec-*.md`

3. Tasks

Derived from specifications and roadmap milestones.

4. Implementation

TypeScript code implementing tasks.

## Advantages

- deterministic behavior
- predictable agent implementations
- easier debugging

## Implementation Flow

roadmap -> specification -> task -> code

## Documentation Guard

When a change completes a roadmap phase or changes the set of supported clients, commands, or setup steps, update `README.md` in the same change.

When the public CLI surface changes:

- update `README.md`
- update the relevant `docs/specs/spec-*.md` files
- keep `docs/specs/spec-cli.md` aligned with the released command set
- keep the automated documentation guard passing
