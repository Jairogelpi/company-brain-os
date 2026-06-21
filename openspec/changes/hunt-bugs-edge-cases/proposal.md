# Proposal — hunt-bugs-edge-cases

## Problem statement

The `explore.md` pass surfaced 10 edge cases across the domain layer that produce silently wrong results, data loss, or resource leaks:

1. `simulateMultipleLeaving` filters only `fromNodeId`, so DEPENDS_ON edges pointing at departing people survive — wrong process impacts and exposure (HIGH).
2. `slug()` collapses non-Latin names to `person-`, silently deduping distinct people → data loss on CJK/Cyrillic/Arabic ingest (HIGH).
3. `company-service` overwrites an existing company when names slug-collide (e.g. `"!!!"` twice); no uniqueness guard (MEDIUM).
4. `applyProposalsWithDecisions` omits deletion events from its return even though they are emitted to the log (MEDIUM).
5. `applyConfirmedProposals` applies earlier proposals before a mid-batch `updateNode` throws, leaving partial state with no rollback (MEDIUM).
6. `rate-limiter` `buckets` Map grows unbounded — no eviction/expiry → memory leak (MEDIUM).
7. `financial-exposure` `num()` accepts negatives → absurd/negative € exposure (LOW-MEDIUM).
8. `simulatePersonLeaving(ghostId)` reports "✅ no significant impact" instead of "person not found" (LOW-MEDIUM).
9. `persistent-graph-service.deleteNode` cascade is sequential; one failing `deleteEdge` leaves orphaned edges and the node un-deleted, non-atomically (MEDIUM).
10. `computeCoverage` returns 100% vacuously when no critical knowledge exists, inflating health while `CompanyIQ` returns 0 on empty (LOW).

## Proposed solution (approach: TDD per bug, surgical fixes)

Strict TDD per OpenSpec config (`strict_tdd: true`, runner `npm --prefix web run test`). For every confirmed bug:

1. **RED** — write a focused Vitest test that encodes the expected behavior and fails on current code.
2. **GREEN** — apply a minimal, surgical fix (no refactors, no new features).
3. **Triangulate** — add a second assertion/case to lock semantics, confirm green.

Direction per bug (subject to TDD confirming it is a real bug, not intended behavior):

- **sim asymmetry**: make `simulateMultipleLeaving` filter both `fromNodeId` and `toNodeId`, matching `simulatePersonLeaving`.
- **non-Latin slugs**: preserve Unicode in the id (or hash) so distinct names produce distinct ids; keep accent-stripping for Latin.
- **company uniqueness**: reject slug collisions in `createCompany` with a typed error; document empty-name handling.
- **deletion events**: include `graph.node.deleted` / `graph.edge.deleted` events in the `applyProposalsWithDecisions` return array.
- **batch atomicity**: snapshot the graph before `applyConfirmedProposals` and revert on any mid-batch throw (mirror the existing optimistic-apply revert in `graph-service`).
- **rate-limiter**: cap `buckets.size` via LRU/eviction with documented policy.
- **negative exposure**: clamp `num()` to `≥ 0` (or guard and flag invalid) for cost/recovery attrs.
- **ghost sim**: detect missing person and return an explicit `personNotFound` summary rather than a misleading success.
- **non-atomic cascade**: collect edge deletions, attempt all, then fail atomically (delete node only after all edges removed); propagate error.
- **coverage vacuity**: distinguish "no critical knowledge" from "fully covered"; return 0 (or explicit empty state) when critical set is empty.

If a candidate turns out to be intended behavior, document the rationale in the change log and skip the fix.

## Scope (in: 10 edge cases; out: new features, refactors beyond fix)

**In**: the 10 edge cases above; their RED→GREEN tests; minimal surgical fixes; doc notes for intended-behavior skips.
**Out**: new features; perf/UI/infra changes; LLM prompt tuning; CSV quoted-comma parsing; SVG policy review; vector-store quality; unrelated refactors.

## Success criteria (all tests green, no regressions, each bug has a RED→GREEN test)

- Every confirmed bug has a committed failing test that went RED before the fix and GREEN after.
- `npm --prefix web run test` is fully green with no new failures or skipped regressions.
- Each fix is minimal and touches only the affected module(s).
- Any candidate resolved as intended-behavior is documented with a reason and no code change.
- No new public APIs or features introduced.

## Risks

- **Batch atomicity revert** could mask currently-tolerated partial states callers rely on — verify no test asserts partial-apply semantics.
- **Non-Latin slug change** alters generated ids; any persisted data using old `person-` ids would fragment. Mitigation: additive fallback / documented migration note; confirm no fixture depends on the broken id.
- **Company uniqueness** could break existing tests that intentionally reuse slugs — audit fixtures first.
- **Coverage semantics change** shifts reported health numbers downstream; may surface as test/fixture churn.
- **Rate-limiter eviction policy** choice (cap vs TTL) is a minor product decision; pick the simplest cap that bounds memory and document it.
- **Negative-exposure clamp** could hide genuinely invalid upstream data; consider also surfacing a warning, but clamp is the safe minimal fix.
