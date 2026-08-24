# Pilot release scorecard

This scorecard defines “10/10” as repository evidence for a production pilot. It is not an external security certification, legal opinion or claim of product-market fit.

| Dimension | Definition of done | Evidence | Status |
| --- | --- | --- | --- |
| Functionality | Capture → review → canonical claims → risks → mission → artifact → verified backup → recalculation works | Pedro/Laura E2E, mission API/UI, notification workflow | Pass |
| Core coherence | One accepted v4 contract; atomic evidence-linked ledger is canonical; graph is disposable projection; no AI direct-write path | v4 spec, canonical writer/projection, aligned docs | Pass |
| SaaS security | Forced RLS, non-owner runtime, tenant FKs/transactions, explicit User→Person identity, secure uploads, abuse controls, security headers | migrations 0015/0020–0027, integration suites, security model | Pass pending CI PostgreSQL gate |
| End-to-end evidence | False mitigation is prevented, assessor/reviewer identity is explicit and deterministic rebuild is proven | canonical E2E, transfer identity gates and critical coverage gate | Pass |
| Portfolio | Problem, decisions, architecture, executable proof and responsible boundary are reviewable | README, case study, demo and this scorecard | Pass |
| Commercial preparation | ICP, scoped offer, price experiment, scorecard, discovery/demo process and operating runbook exist | commercial pack and production runbook | Pass as sales-ready hypothesis |

## Non-negotiable release gates

```bash
cd web
npm ci
npm run typecheck
npm test -- --run
npm run test:e2e
npm run test:critical
npm run build
DATABASE_URL=<migrated-postgres> npx vitest --config test.integration.config.ts run
```

The final PostgreSQL integration line must be green in GitHub Actions before merge or deployment. A pilot also requires customer-specific security/legal review, a measured baseline and a named executive sponsor.

## Evidence that cannot be manufactured in a repository

- qualified buyer interviews;
- paid-pilot conversion;
- customer baseline and outcome measurements;
- restore-time measurements in the target infrastructure;
- counsel-approved DPA/order form;
- independent penetration test or certification.

These are go-to-market/operational validation items, not reasons to mislabel synthetic tests as customer success.
