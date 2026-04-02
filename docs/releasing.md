# Releasing `mcpmatrix`

`mcpmatrix@0.1.0` is published to the public npm registry from GitHub Actions after merges to `master`.

## Required secret

- `NPM_TOKEN` with permission to publish the `mcpmatrix` package

## Merge gate for the release PR

Before merging the hardening or release PR:

1. CI must pass on Windows, Linux, and macOS
2. `npm pack --dry-run` must show a clean package
3. manual smoke must be confirmed for:
   - `mcpmatrix init`
   - `mcpmatrix plan`
   - `mcpmatrix apply`
4. Codex and Claude must recognize the generated MCP configs

## Automatic publish flow

On push to `master`, the release workflow:

1. checks whether `package.json` changed in the pushed range
2. validates that `package.json.version` is a semver version
3. skips if that version already exists on npm
4. runs `npm ci`
5. runs `npm run build`
6. runs `npm test`
7. runs `npm run test:smoke`
8. runs `npm pack --dry-run`
9. publishes to npm as a public package
10. creates tag `v<version>`
11. creates a GitHub Release with the `0.1.0` support statement

## Post-release checks

After publish:

```bash
npm install -g mcpmatrix
mcpmatrix --help
mcpmatrix init
```

Also confirm:

- npm shows the expected README and metadata
- published package contains only runtime artifacts
- docs still claim support only for Codex CLI and Claude Code CLI
