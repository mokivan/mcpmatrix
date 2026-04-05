# mcpmatrix Spec - Configuration Schema

## File Location

Global configuration file:

`~/.mcpmatrix/config.yml`

## Format

YAML

Editors may attach a JSON Schema to this YAML file for autocomplete and validation assistance.

Packaged schema file:

`schemas/mcpmatrix-config.schema.json`

## Top Level Structure

```yaml
servers:
  <server-name>:
    transport: stdio
    command: string
    args: string[]
    env:
      <ENV_NAME>: string

  <server-name>:
    transport: remote
    protocol: auto | http | sse
    url: string
    headers:
      <HEADER_NAME>: string
    auth:
      type: none | bearer | oauth

scopes:
  global:
    enable: string[]

  tags:
    <tag-name>:
      enable: string[]

  repos:
    <absolute-path>:
      tags: string[]
      enable: string[]
```

## Rules

1. server names must be unique
2. `transport: stdio` requires `command` and may define only `args` and `env`
3. `transport: remote` requires `protocol` and `url` and may define only `headers` and `auth`
4. env interpolation syntax is `${env:VAR_NAME}`
5. interpolation may appear in any string field in the canonical config
6. scopes are additive
7. no implicit disabling of servers

## Example

```yaml
# yaml-language-server: $schema=file:///.../schemas/mcpmatrix-config.schema.json

servers:
  github:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${env:GITHUB_TOKEN}

  medusa:
    transport: remote
    protocol: http
    url: https://docs.medusajs.com/mcp

scopes:
  global:
    enable:
      - github
      - medusa
```
