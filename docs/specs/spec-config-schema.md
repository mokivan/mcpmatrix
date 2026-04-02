# mcpmatrix Spec — Configuration Schema

## File Location

Global configuration file:

~/.mcpmatrix/config.yml

## Format

YAML

## Top Level Structure

servers:
  <server-name>:
    command: string
    args: string[]
    env:
      <ENV_NAME>: string

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

## Rules

1. server names must be unique
2. command must be executable in system PATH
3. env variables may reference environment variables using:

${env:VAR_NAME}

4. scopes are additive
5. no implicit disabling of servers

## Example

servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${env:GITHUB_TOKEN}

scopes:
  global:
    enable:
      - github