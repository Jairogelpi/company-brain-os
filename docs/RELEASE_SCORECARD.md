# Pilot release scorecard

This scorecard defines **10/10 repository readiness** as a reproducible, auditable production-pilot gate. It is not an external security certification, legal opinion, customer-success claim or proof of product-market fit.

| Dimension | Definition of done | Evidence | Status |
| --- | --- | --- | --- |
| Functionality | Capture → review → canonical claims → risks → mission → artifact → verified backup → recalculation works | Pedro/Laura E2E, mission API/UI, notification workflow | Pass |
| Core coherence | One accepted v4 contract; atomic evidence-linked ledger is canonical; graph is disposable projection; no AI direct-write path | v4 spec, canonical writer/projection, aligned docs | Pass |
| SaaS security | Forced RLS, non-owner runtime, tenant FKs/transactions, explicit User→Person identity, secure uploads, abuse controls, security headers | migrations 0015/0020–0027, PostgreSQL integration suite, security model | Pass |
| End-to-end evidence | False mitigation is prevented, assessor/reviewer identity is explicit, deterministic rebuild is proven and the browser boundary is exercised | canonical E2E, Playwright Chromium journeys, transfer identity gates, critical coverage gate | Pass when exact-commit CI is green |
| Static quality | No forbidden TypeScript suppression, debugger statements or unresolved executable-code TODO/FIXME/HACK markers; source formatting policy is enforced | `npm run lint`, `npm run format:check` | Pass when exact-commit CI is green |
| Documentation integrity | Canonical relative links resolve and stale framework/release assertions are rejected; historical material is explicitly non-canonical | `npm run docs:audit`, docs source-of-truth hierarchy | Pass when exact-commit CI is green |
| Application security analysis | JavaScript/TypeScript is scanned by CodeQL on PRs, master and weekly | `.github/workflows/codeql.yml`, GitHub code scanning | Pass when exact-commit CodeQL is green |
| Supply-chain hygiene | Reproducible npm install, production dependency audit, current CI/CD actions, SBOM and build provenance | CI, Dependabot, GHCR build workflow | Pass when exact-commit CI is green |
| Documentation | Public README, canonical docs map, release evidence boundary and contribution path match the executable repository; historical plans are clearly non-canonical | README, docs index, contributing guide, changelog, archive markers | Pass when exact-commit CI is green |
| Release engineering | Formal pilot notes exist and `v1.0.0-pilot` is created idempotently from the exact master SHA | release notes, release workflow, GitHub Release | Pass when release workflow succeeds |
| Portfolio | Problem, decisions, architecture, executable proof and responsible boundary are reviewable | README, case study, demo and this scorecard | Pass |
| Commercial preparation | ICP, scoped offer, price experiment, scorecard, discovery/demo process and operating runbook exist | commercial pack and production runbook | Pass as sales-ready hypothesis |

## Non-negotiable repository gates

The authoritative implementation is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), complemented by [CodeQL](../.github/workflows/codeql.yml). On a clean local checkout, install the locked application graph and run the local mirror:

```bash
cd web
npm ci
npm run verify:all
```

`verify:all` executes:

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
14. Playwright browser E2E
15. production dependency vulnerability audit

The Playwright harness is pinned to `@playwright/test@1.62.1` and installed ephemerally with `--no-save --package-lock=false`; the private application `package-lock.json` remains the deterministic runtime/build dependency graph. CodeQL is intentionally not reproduced by `verify:all`; the authoritative scan runs in GitHub Actions and publishes SARIF/code-scanning results there.

Equivalent individual commands are:

```bash
npm run lint
npm run format:check
npm run docs:audit
npm run db:migrate
npm run db:seed
npm test -- --run
npm run test:e2e
npm run test:critical
DATABASE_URL=<migrated-postgres> npx vitest --config test.integration.config.ts run
npm run typecheck
AUTH_SECRET=<build-secret> npm run build
npm run test:browser:install
npm run typecheck:browser
npm run test:browser
npm audit --omit=dev --audit-level=high
```

GitHub Actions is the authoritative execution environment for repository and SAST gates. Local success is useful reproducibility evidence but does not replace green remote runs on the exact commit.

## Release evidence chain

A release candidate is repository-complete only when all of these are true:

1. the exact commit has a green `Company Brain OS CI` run;
2. repository lint and formatting-policy checks pass;
3. canonical documentation link/version audit passes;
4. migrations run against real PostgreSQL with pgvector;
5. seed data is created only through the explicit test/demo step, never implicitly in production;
6. the canonical Pedro → Laura scenario passes;
7. critical-domain coverage stays above its configured threshold;
8. cross-tenant reads/writes fail under the non-superuser integration role;
9. application and browser-harness TypeScript checks pass;
10. Playwright Chromium verifies authentication and critical protected navigation;
11. CodeQL completes successfully for JavaScript/TypeScript;
12. production dependency audit reports no high/critical vulnerability at release time;
13. the production image is built by CI/CD with SBOM and provenance enabled;
14. deployment follows `docs/operations/PRODUCTION_RUNBOOK.md` without demo seed data;
15. the formal release tag/notes point at the exact accepted master SHA.

A failed gate makes the release **not 10/10**, regardless of documentation or manual judgment.

## Version identity

The npm workspace under `web/` is private; its `package.json` version is an internal workspace value and is not the product/repository release identifier. Formal versions are Git tags and GitHub Releases, beginning with `v1.0.0-pilot`.

## External validation gates

These cannot be truthfully manufactured in a repository. They are required before making the corresponding external claim:

| Claim | Required external evidence |
| --- | --- |
| “Customers want this” | Qualified buyer interviews with recorded decision criteria |
| “Customers will pay” | Signed/paid pilot or equivalent commercial commitment |
| “It improves continuity” | Customer baseline plus post-pilot outcome measurement |
| “Backups meet the target RTO/RPO” | Timed restore exercise in the target infrastructure |
| “Legal/privacy terms are approved” | Counsel-approved DPA/order form for the deployment context |
| “Independently security-tested” | External penetration test/certification report and remediation record |

Until each item exists, the repository must describe it as **pending external validation**, never as completed.

## Absolute 10/10 definition

There are therefore two distinct scores:

- **Repository 10/10:** every executable, security-analysis, release and documentary gate controlled by this repository is green and reproducible.
- **Product/company 10/10:** repository 10/10 **plus** real buyer, customer, legal, operational and independent-security evidence.

The project may claim the first when CI, CodeQL and formal release evidence prove it. It may claim the second only when the external evidence actually exists.
