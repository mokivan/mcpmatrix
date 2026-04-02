# mcpmatrix Spec — Client Adapters

Adapters convert the canonical mcpmatrix configuration into specific formats used by AI clients.

## Supported Clients

### v0.1

- Codex CLI
- Claude Code CLI

### v1

- Gemini CLI

## Adapter Responsibilities

1. map canonical server definition to client format
2. preserve command, args, and env variables
3. write configuration file to correct location

## Codex

File:

~/.codex/config.toml

Format:

[[mcp_servers]]
name = "<server-name>"
command = "<command>"
args = []
env = {}

## Claude Code

File:

~/.claude.json

Section:

mcpServers

## Gemini

File:

~/.gemini/settings.json

Section:

mcpServers

## Adapter Contract

Input:

Resolved MCP server list

Output:

Client configuration file compatible with target client.