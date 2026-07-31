# Contributing

Thanks for helping improve Company Brain OS.

## Before opening a pull request

```bash
cd web
npm ci
npm run typecheck
npm test -- --run
npm run build
```

Keep pull requests focused, explain the product or technical reason for the change, and include screenshots for user-interface changes.

## Commit style

Use concise, imperative commits with an optional scope, for example:

```text
feat(graph): add process dependency risk
fix(auth): validate expired invitation
docs: improve local setup
```

## Pull requests

Pull requests must pass CI and receive review before merging into the default branch. Do not include secrets, real company data or generated build artifacts.
