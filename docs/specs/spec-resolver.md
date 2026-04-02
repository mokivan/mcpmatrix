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

A resolved list of MCP servers ready to be mapped to client configuration.