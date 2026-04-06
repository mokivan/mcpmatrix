# mcpmatrix Spec — Resolver Algorithm

The resolver determines which MCP servers should be active for a given repository.

## Inputs

- configuration YAML
- current repository path
- tags assigned to the repository

## Resolution Order

1. global scope
2. tag scopes
3. repo scope

## Algorithm

servers_final =

global.enable
+ tags.enable
+ repo.enable

After merging:

- remove duplicates
- preserve first appearance order

## Deduplication

If a server appears multiple times, it must only appear once in the final list.

Example:

global.enable:
  - github

tag.enable:
  - github
  - postgres

Result:

github
postgres

## Expected Output

A resolved canonical server set with:

- `servers`: the full active server list in final order
- `globalServers`: the subset sourced from `scopes.global.enable`
- `repoScopedServers`: the subset sourced from matching `tags` and `repo.enable`, excluding names already active globally

The combined `servers` list remains the canonical active server order for diagnostics and UI views.
