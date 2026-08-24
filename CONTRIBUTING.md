# Contributing

Thanks for helping improve Company Brain OS.

## Development prerequisites

- Node.js 22+
- npm 10+
- Docker
- PostgreSQL 16 with `pgvector` for the repository-level integration gate

Never use real company data, production credentials or sensitive HR content in local development or tests.

## Before opening a pull request

Install the exact locked dependency graph first:

```bash
cd web
npm ci
```

With PostgreSQL available at `postgres://postgres:postgres@localhost:5432/company_brain_os`, run the complete repository-controlled gate:

```bash
npm run verify:all
```

The runner executes the same permanent categories enforced by CI:

1. production migrations
2. explicit local/test seed
3. full automated test suite
4. canonical Pedro → Laura E2E
5. critical-domain coverage
6. PostgreSQL tenant isolation
7. strict TypeScript
8. production build
9. production dependency vulnerability audit

The GitHub workflow remains the authoritative release gate: [.github/workflows/ci.yml](.github/workflows/ci.yml).

For targeted iteration, individual commands remain available:

```bash
npm test -- --run
npm run test:e2e
npm run test:critical
npm run test:integration
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high
```

## Pull-request standard

Keep pull requests focused and explain both the product reason and the technical effect of the change. Include screenshots for user-interface changes and explicit evidence for changes affecting authorization, tenancy, migrations, risk calculation, transfer verification, uploads or worker behavior.

A pull request must not claim customer impact from repository tests. Engineering evidence and external outcome evidence are deliberately separated in [docs/RELEASE_SCORECARD.md](docs/RELEASE_SCORECARD.md).

## Commit style

Use concise imperative commits with an optional scope, for example:

```text
feat(graph): add process dependency risk
fix(auth): validate expired invitation
docs: improve local setup
```

## Security and data handling

- Never commit `.env`, credentials, database dumps, uploads or real customer content.
- Do not log captured knowledge, upload bytes, passwords, tokens or sensitive HR fields.
- Treat AI output as untrusted input until a human explicitly approves a canonical fact.
- Changes to dependencies, migrations, workflows or authorization boundaries require deliberate review.
- Follow [SECURITY.md](SECURITY.md) for vulnerability reporting and security invariants.

## Merge standard

Pull requests must pass CI and receive review before merge into the default branch. Generated build artifacts and synthetic evidence presented as real-world validation are not accepted.
