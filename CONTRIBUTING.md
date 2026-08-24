# Contributing

Thanks for helping improve Company Brain OS.

## Development prerequisites

- Node.js 22+
- npm 10+
- Docker or a local PostgreSQL 16 + `pgvector` installation
- Chromium for local browser E2E (`npm run test:browser:install` installs the pinned Playwright harness/browser without modifying `package-lock.json`)

Never use real company data, production credentials or sensitive HR content in local development or tests.

## Before opening a pull request

Install the exact locked application dependency graph first:

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
3. canonical documentation link/version audit
4. production migrations
5. explicit local/test seed
6. full automated test suite
7. canonical Pedro → Laura E2E
8. critical-domain coverage
9. PostgreSQL tenant isolation
10. strict application TypeScript
11. production build
12. pinned Playwright harness + Chromium installation
13. browser-harness TypeScript
14. Playwright browser journeys
15. production dependency vulnerability audit

CodeQL is additionally authoritative in GitHub Actions because it publishes SARIF into repository code scanning. The GitHub workflows remain the authoritative release gates: [.github/workflows/ci.yml](.github/workflows/ci.yml) and [.github/workflows/codeql.yml](.github/workflows/codeql.yml).

For targeted iteration, individual commands remain available:

```bash
npm run lint
npm run format:check
npm run docs:audit
npm test -- --run
npm run test:e2e
npm run test:critical
npm run test:integration
npm run typecheck
npm run build
npm run test:browser:install
npm run typecheck:browser
npm run test:browser
npm audit --omit=dev --audit-level=high
```

## Browser E2E standard

Browser tests use pinned `@playwright/test@1.62.1` and Chromium. The harness is installed ephemerally with `--no-save --package-lock=false`, so the application lockfile remains the deterministic dependency graph for runtime/build dependencies. Browser code has its own TypeScript config and gate.

The journeys exercise a real Next.js server against PostgreSQL and cover, at minimum:

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

## Documentation standard

`npm run docs:audit` checks canonical Markdown for broken relative links plus stale framework/release assertions. Historical material under `docs/archive/`, `docs/superpowers/` and `openspec/` is excluded intentionally because preserving superseded decisions is part of the audit trail.

## Historical design material

`openspec/` and `docs/superpowers/` are retained for historical traceability and are explicitly non-canonical. Do not "refresh" old plans to make them appear current; update canonical product/architecture/security documentation instead.

## Release versioning

The application workspace is private; its npm `package.json` version is not the product release identifier. Product/repository releases are identified by Git tags and GitHub Releases, beginning with `v1.0.0-pilot`.

## Merge standard

Pull requests must pass CI, browser E2E, CodeQL and review before merge into the default branch. Generated build artifacts and synthetic evidence presented as real-world validation are not accepted.
