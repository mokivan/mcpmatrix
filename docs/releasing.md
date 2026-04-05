# Releasing `@mokivan/mcpmatrix`

Publication happens from GitHub Actions either:

- automatically after merges to `master`
- manually through the `Release` workflow in GitHub Actions

## Trusted Publisher

Publishing uses npm Trusted Publisher with GitHub Actions OIDC.

Required configuration:

- npm package linked to the `mokivan/mcpmatrix` repository
- workflow file: `release.yml`
- GitHub workflow permission `id-token: write`
- Node.js `22.14.0` or newer in the publish job
- npm CLI `11.5.1` or newer in the publish job

## Runtime baseline

- Node.js 22.14.0 or newer
- npm 11.5.1 or newer

## Merge gate for the release PR

Before merging the hardening or release PR:

1. CI must pass on Windows, Linux, and macOS
2. `npm pack --dry-run` must show a clean package
3. manual smoke must be confirmed for:
   - `mcpmatrix init`
   - `mcpmatrix import`
   - `mcpmatrix validate`
   - `mcpmatrix doctor`
   - `mcpmatrix plan`
   - `mcpmatrix apply`
   - `mcpmatrix backups list`
   - `mcpmatrix rollback --client codex`
4. Codex, Claude, and Gemini must recognize the generated MCP configs

## Publish flow

The release workflow can start from either:

- a push to `master`
- a manual `workflow_dispatch` run from GitHub Actions

When it runs, it:

1. checks whether publishing should proceed:
   - on push, only when `package.json` changed in the pushed range
   - on manual run, always continues to version checks
2. validates that `package.json.version` is a semver version
3. skips if that version already exists on npm
4. runs `npm ci`
5. runs `npm run build`
6. runs `npm run typecheck`
7. runs `npm test`
8. runs `npm run test:smoke`
9. runs `npm run pack:check`
10. publishes to npm as a public package using Trusted Publisher
   - provenance is generated automatically by npm for public packages published from public GitHub repositories
11. creates tag `v<version>`
12. creates a GitHub Release from the exact `CHANGELOG.md` section matching `package.json.version`

## Post-release checks

After publish:

```bash
npm install -g @mokivan/mcpmatrix
mcpmatrix --help
mcpmatrix --version
mcpmatrix init
mcpmatrix validate
mcpmatrix doctor
mcpmatrix backups list
```

Also confirm:

- npm shows the expected README and metadata
- published package contains only runtime artifacts
- package contract remains CLI-only (`mcpmatrix`, `mmx`, documented flags)
- docs match the clients and commands actually released in that version
- `npm run test:docs` passes locally and in CI expectations
- `CHANGELOG.md` reflects the released scope
- `npm run test:release` passes for the exact `package.json.version`
- Trusted Publisher is configured for `mokivan/mcpmatrix` with workflow filename `release.yml`
