# GitHub Release Package

This repository should be published as a source repository, not as a local workspace snapshot.

## Include In GitHub Package

- `src/`
- `bin/`
- `templates/`
- `deploy/`
- `.github/`
- `.dockerignore`
- `.env.example`
- `.eslintrc.json`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `jest.config.js`
- `README.md`
- `README_CN.md`
- `CHANGELOG.md`
- `LICENSE`
- `GSD/PROJECT.md`
- `GSD/ROADMAP.md`
- `GSD/STATE.md`
- `GSD/HISTORY.md`
- `GSD/projects/`
- `GSD/milestones/`

## Exclude From GitHub Package

- `node_modules/`
- `dist/`
- `.runtime-home/`
- `.codex/`
- `GSD/.planning/`
- `GSD/sessions/`
- Any local `config.json`
- Any account/session caches
- Any private keys, tokens, or machine-specific runtime data

## Packaging Intent

- Keep source, tests, CI, deploy examples, and high-level project docs.
- Remove generated artifacts, local operator logs, and environment-specific files.
- Publish `v1.5.0` as a clean source snapshot suitable for GitHub.
