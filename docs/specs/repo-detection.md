# Repository Detection Summary

Canonical spec:

- `docs/specs/spec-repo-detection.md`

Summary:

1. prefer explicit CLI `--repo`
2. otherwise detect the Git root by searching upward for `.git`
3. otherwise fallback to `cwd`

Paths must be normalized for Windows, Linux, and macOS.
