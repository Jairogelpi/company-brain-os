# Contributing

Thanks for helping improve Company Brain OS.

## Development prerequisites

- Node.js 22+
- npm 10+
- Docker or a local PostgreSQL 16 + `pgvector` installation
- Chromium for local browser E2E (`npm run test:browser:install` installs the pinned Playwright browser)

Never use real company data, production credentials or sensitive HR content in local development or tests.

## Before opening a pull request

Install the exact locked dependency graph first:

```bash
cd web
npm ci
```

With PostgreSQL available at `postgres://postgres:postgres@localhost:5432/company_brain_os`, run the complete repository-controlled local gate:

```bash
npm run verify:all
```

The runner executes the permanent locally reproducible categories enforced by CI:

1. repository lint policy
2. formatting policy
3. production migrations
4. explicit local/test seed
5. full automated test suite
6. canonical Pedro → Laura E2E
7. critical-domain coverage
8. PostgreSQL tenant isolation
9. strict TypeScript
10. production build
11. pinned Chromium installation
12. Playwright browser journeys
13. production dependency vulnerability audit

CodeQL is additionally authoritative in GitHub Actions because it publishes SARIF into repository code scanning. The GitHub workflows remain the authoritative release gates: [.github/workflows/ci.yml](.github/workflows/ci.yml) and [.github/workflows/codeql.yml](.github/workflows/codeql.yml).

For targeted iteration, individual commands remain available:

```bash
npm run lint
npm run format:check
npm test -- --run
npm run test:e2e
npm run test:critical
npm run test:integration
npm run typecheck
npm run build
npm run test:browser:install
npm run test:browser
npm audit --omit=dev --audit-level=high
```

## Browser E2E standard

Browser tests use a pinned `@playwright/test` version and Chromium. They exercise a real Next.js server against PostgreSQL and cover, at minimum:

- anonymous access to protected routes is redirected to login
- a seeded owner can authenticate through the real credentials UI
- the authenticated owner can reach critical protected product areas

Browser tests must not replace domain/integration tests; they prove the web boundary and critical user journey on top of those lower-level guarantees.

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
- Do not suppress TypeScript with `@ts-ignore`/`@ts-nocheck`, leave `debugger` statements, or merge unresolved `TODO`/`FIXME`/`HACK` markers in executable code.
- Follow [SECURITY.md](SECURITY.md) for vulnerability reporting and security invariants.

## Historical design material

`openspec/` and `docs/superpowers/` are retained for historical traceability and are explicitly non-canonical. Do not "refresh" old plans to make them appear current; update canonical product/architecture/security documentation instead.

## Merge standard

Pull requests must pass CI, browser E2E, CodeQL and review before merge into the default branch. Generated build artifacts and synthetic evidence presented as real-world validation are not accepted.
