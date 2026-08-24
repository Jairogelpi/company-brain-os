# Pilot release scorecard

This scorecard defines **10/10 repository readiness** as a reproducible, auditable production-pilot gate. It is not an external security certification, legal opinion, customer-success claim or proof of product-market fit.

| Dimension | Definition of done | Evidence | Status |
| --- | --- | --- | --- |
| Functionality | Capture → review → canonical claims → risks → mission → artifact → verified backup → recalculation works | Pedro/Laura E2E, mission API/UI, notification workflow | Pass |
| Core coherence | One accepted v4 contract; atomic evidence-linked ledger is canonical; graph is disposable projection; no AI direct-write path | v4 spec, canonical writer/projection, aligned docs | Pass |
| SaaS security | Forced RLS, non-owner runtime, tenant FKs/transactions, explicit User→Person identity, secure uploads, abuse controls, security headers | migrations 0015/0020–0027, PostgreSQL integration suite, security model | Pass |
| End-to-end evidence | False mitigation is prevented, assessor/reviewer identity is explicit and deterministic rebuild is proven | canonical E2E, transfer identity gates, critical coverage gate | Pass |
| Supply-chain hygiene | Reproducible npm install, production dependency audit, current CI/CD actions, SBOM and build provenance | CI, Dependabot, GHCR build workflow | Pass when exact-commit CI is green |
| Documentation | Public README, canonical docs map, release evidence boundary and contribution path match the executable repository | README, docs index, contributing guide, changelog | Pass when exact-commit CI is green |
| Portfolio | Problem, decisions, architecture, executable proof and responsible boundary are reviewable | README, case study, demo and this scorecard | Pass |
| Commercial preparation | ICP, scoped offer, price experiment, scorecard, discovery/demo process and operating runbook exist | commercial pack and production runbook | Pass as sales-ready hypothesis |

## Non-negotiable repository gates

The authoritative implementation is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). On a clean local checkout, install the locked graph and run the local mirror:

```bash
cd web
npm ci
npm run verify:all
```

`verify:all` executes:

1. production migrations
2. explicit local/test seed
3. full automated test suite
4. canonical Pedro → Laura E2E
5. critical-domain coverage
6. PostgreSQL tenant isolation
7. strict TypeScript
8. production build
9. production dependency vulnerability audit

Equivalent individual commands are:

```bash
npm run db:migrate
npm run db:seed
npm test -- --run
npm run test:e2e
npm run test:critical
DATABASE_URL=<migrated-postgres> npx vitest --config test.integration.config.ts run
npm run typecheck
AUTH_SECRET=<build-secret> npm run build
npm audit --omit=dev --audit-level=high
```

GitHub Actions is the authoritative execution environment for the repository gate. Local success is useful reproducibility evidence but does not replace a green remote run on the exact commit.

## Release evidence chain

A release candidate is repository-complete only when all of these are true:

1. the exact commit has a green `Company Brain OS CI` run;
2. migrations run against real PostgreSQL with pgvector;
3. seed data is created only through the explicit test/demo step, never implicitly in production;
4. the canonical Pedro → Laura scenario passes;
5. critical-domain coverage stays above its configured threshold;
6. cross-tenant reads/writes fail under the non-superuser integration role;
7. production dependency audit reports no high/critical vulnerability at release time;
8. the production image is built by CI/CD with SBOM and provenance enabled;
9. deployment follows `docs/operations/PRODUCTION_RUNBOOK.md` without demo seed data.

A failed gate makes the release **not 10/10**, regardless of documentation or manual judgment.

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

- **Repository 10/10:** every executable and documentary gate controlled by this repository is green and reproducible.
- **Product/company 10/10:** repository 10/10 **plus** real buyer, customer, legal, operational and independent-security evidence.

The project may claim the first when CI proves it. It may claim the second only when the external evidence actually exists.
