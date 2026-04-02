# Releasing `@mokivan/mcpmatrix`

This repository is prepared to publish `@mokivan/mcpmatrix@1.0.0`. Publication happens automatically from GitHub Actions after merges to `master`.

## Required secret

- `NPM_TOKEN` with permission to publish the `@mokivan/mcpmatrix` package

## Runtime baseline

- Node.js 20 or newer

## Merge gate for the release PR

Before merging the hardening or release PR:

1. CI must pass on Windows, Linux, and macOS
2. `npm pack --dry-run` must show a clean package
3. manual smoke must be confirmed for:
   - `mcpmatrix init`
   - `mcpmatrix import`
   - `mcpmatrix validate`
   - `mcpmatrix plan`
   - `mcpmatrix apply`
4. Codex, Claude, and Gemini must recognize the generated MCP configs

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
11. creates a GitHub Release with the matching support statement for that version

## Post-release checks

After publish:

```bash
npm install -g @mokivan/mcpmatrix
mcpmatrix --help
mcpmatrix --version
mcpmatrix init
mcpmatrix validate
```

Also confirm:

- npm shows the expected README and metadata
- published package contains only runtime artifacts
- docs match the clients and commands actually released in that version
- `CHANGELOG.md` reflects the released scope
