# R0 Domain Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make assertions and evidence the canonical, auditable source for Company Brain OS while retaining a compatible read model during the migration.

**Architecture:** Add an append-only assertion/evidence domain alongside the current nodes and edges. Generate graph projections and derived risks from approved assertions only. Migrate the graph ontology and tenant model incrementally behind explicit repositories and tests so existing screens keep working through R0.

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM, PostgreSQL 16 + pgvector, Vitest, Docker, GitHub Actions.

---

## Scope and sequencing

R0 is deliberately split into independently releasable slices. Do not mix R1 security controls, worker extraction or commercial functionality into this branch.

### Task 1: Freeze the v4 contract

**Files:**
- Create: `docs/product/COMPANY_BRAIN_OS_V4.md`
- Create: `web/src/domain/assertions.ts`
- Test: `web/src/domain/assertions.test.ts`

- [ ] Write failing tests for assertion statuses, confidence classes and required provenance.
- [ ] Run `npm test -- src/domain/assertions.test.ts` and verify failure because the module is absent.
- [ ] Implement closed TypeScript contracts and pure validation helpers only.
- [ ] Re-run the focused test and commit `feat(domain): add assertion ledger contract`.

### Task 2: Correct the graph ontology

**Files:**
- Modify: `web/src/domain/graph.ts`
- Modify: `web/src/domain/graph.test.ts`
- Modify: `web/src/domain/property-tests.test.ts`

- [ ] Write failing tests that accept `ExternalParty` and reject new `Risk`, `Client` and `Supplier` graph nodes.
- [ ] Run focused tests and verify failure against the legacy ontology.
- [ ] Update node types, relationship endpoint rules and validation issues; retain a migration adapter only where legacy database rows require it.
- [ ] Re-run focused and property tests; commit `feat(graph): adopt v4 continuity ontology`.

### Task 3: Persist assertions and evidence

**Files:**
- Modify: `web/src/db/schema.ts`
- Create: `web/drizzle/0014_assertion_ledger.sql`
- Create: `web/src/db/assertion-repository.ts`
- Create: `web/src/db/assertion-repository.test.ts`
- Test: `web/src/db/migrations.test.ts`

- [ ] Write failing repository tests for required organization, immutable approved assertions and evidence linkage.
- [ ] Verify red state.
- [ ] Add Drizzle schema and an additive migration for evidence sources, evidence items, assertions and assertion-evidence links.
- [ ] Implement repository operations with organization-scoped reads and append/supersede semantics.
- [ ] Run focused tests, migration tests and integration migration tests; commit `feat(db): persist assertions and evidence`.

### Task 4: Build deterministic graph projections

**Files:**
- Create: `web/src/domain/graph-projection.ts`
- Create: `web/src/domain/graph-projection.test.ts`
- Modify: `web/src/domain/persistent-graph-service.ts`

- [ ] Write failing tests proving that approved assertions create projection edges, rejected assertions do not, and replaying the ledger returns the same projection hash.
- [ ] Verify red state.
- [ ] Implement the pure projection function and use it at the persistence boundary for approved changes.
- [ ] Run focused tests plus graph service tests; commit `feat(graph): project approved assertions deterministically`.

### Task 5: Make risks derived and explainable

**Files:**
- Modify: `web/src/domain/risk-engine.ts`
- Modify: `web/src/domain/risk-engine.test.ts`
- Create: `web/src/domain/risk-rules.ts`
- Create: `web/src/domain/risk-rules.test.ts`

- [ ] Write failing tests that each risk cites a versioned rule, source assertions/evidence and matching trigger text.
- [ ] Verify red state.
- [ ] Replace opaque trigger strings with rule definitions and return explanation objects from every detector.
- [ ] Add `ExternalParty` single-contact coverage and remove `Risk`-node assumptions.
- [ ] Run focused risk tests and the full unit suite; commit `feat(risks): derive explainable continuity exposures`.

### Task 6: Remove implicit tenants from the application contract

**Files:**
- Modify: `web/src/db/schema.ts`
- Create: `web/drizzle/0015_required_organization_ids.sql`
- Modify: `web/src/db/repository.ts`
- Modify: `web/src/auth/requireApiUser.ts`
- Test: `web/src/auth/requireApiUser.test.ts`
- Test: `web/src/db/integration/*`

- [ ] Write failing tests for missing tenant context and cross-organization reads.
- [ ] Verify red state.
- [ ] Remove defaults, add foreign keys and require organization context in repositories and API services.
- [ ] Add an integration test exercising two organizations with known IDs.
- [ ] Run unit + integration tests; commit `feat(tenancy): require organization context`.

### Task 7: Reconcile existing data and API routes

**Files:**
- Modify: `web/src/domain/seed-graph.ts`
- Modify: `web/src/app/api/graph/*.ts`
- Modify: `web/src/app/api/interview/*.ts`
- Modify: `web/src/app/api/inbox/route.ts`
- Test: corresponding route tests

- [ ] Write failing compatibility tests for legacy Client/Supplier imports and proposed assertion review.
- [ ] Verify red state.
- [ ] Normalize legacy imports into `ExternalParty` and write proposed assertions/evidence instead of direct canonical graph mutations.
- [ ] Keep approved graph responses backward compatible where practical.
- [ ] Run API tests; commit `feat(api): route proposals through assertion review`.

### Task 8: Prove the canonical scenario end to end

**Files:**
- Create: `web/src/domain/r0-canonical-scenario.test.ts`
- Modify: `README.md`
- Modify: `DEPLOY.md`

- [ ] Write the Pedro/Laura canonical scenario as a failing test from ledger input through risks and mitigation eligibility.
- [ ] Verify red state.
- [ ] Complete minimal integration gaps necessary for green.
- [ ] Run `npm run typecheck`, `npm test -- --run`, `npm run build`, and integration tests.
- [ ] Commit documentation and release notes; open a PR with migration and rollback notes.

## Verification requirements

- Each new behavior follows red → green → refactor.
- Run full CI before each slice is merged.
- Do not apply destructive migrations without a backup and an explicit production rollout plan.
- R0 completion requires a deterministic projection replay test, assertion provenance test, risk explanation test and tenant escape test.
