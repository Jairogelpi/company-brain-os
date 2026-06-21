# Spec — hunt-bugs-edge-cases

## Requirements

Each requirement is a confirmed edge case from `explore.md`. Every requirement MUST have at least one failing Vitest assertion (RED) before the surgical fix (GREEN). No new public APIs or features. Fixes MUST touch only the affected module(s).

## Acceptance criteria (numbered, each maps to a RED→GREEN test)

1. **AC-1 — Simulator multi-leave filters both edge directions.**
   WHEN `simulateMultipleLeaving` is called with a set of departing person ids that includes the `toNodeId` of a `DEPENDS_ON` edge, THEN the returned `remainingEdges` MUST exclude that edge. Build: Person A `MASTERS` K, Person B `MASTERS` K, Process P `DEPENDS_ON` Person B; call `simulateMultipleLeaving([B])`; assert the `P→B` DEPENDS_ON edge is absent from `remainingEdges`.

2. **AC-2 — Non-Latin names yield distinct person ids.**
   WHEN `mapEmployeeRows` (or `parseEmployeeCsv`) ingests rows with non-Latin-only names `王明` and `李雷`, THEN it MUST emit two distinct `person-*` ids and two `create_node` proposals — not a single `person-` id that silently dedupes one person.

3. **AC-3 — `createCompany` rejects slug collisions.**
   WHEN `createCompany` is called twice with names that slug-collide (e.g. `"!!!"` then `"!!!", or`"Acme Corp!"` then `"Acme  Corp"`), THEN the second call MUST throw a typed error OR return a distinct disambiguated id — it MUST NOT silently overwrite the first company. Empty/special-only names MUST NOT produce colliding empty slugs.

4. **AC-4 — `applyProposalsWithDecisions` returns deletion events.**
   WHEN `applyProposalsWithDecisions` rejects a proposal that targets an existing node (forcing a `graph.node.deleted` event to the log), THEN the returned event array MUST include that `graph.node.deleted` (and `graph.edge.deleted` where applicable) event — not only the create/update events from approved proposals.

5. **AC-5 — `applyConfirmedProposals` is atomic on mid-batch failure.**
   WHEN `applyConfirmedProposals` processes a batch `[create_node X, update_node Y(missing), create_node Z]` and `updateNode` throws, THEN the graph MUST be left in its pre-batch state (X NOT applied, Z NOT applied) OR the function MUST return documented partial semantics with a clear error — it MUST NOT leave X applied and Z skipped while propagating the throw.

6. **AC-6 — `rate-limiter` bounds `buckets.size`.**
   WHEN `checkRateLimit` is called with 10 000 distinct keys, THEN `buckets.size` MUST be bounded by a documented cap (LRU/TTL eviction) — it MUST NOT equal 10 000.

7. **AC-7 — Negative cost attrs do not produce negative exposure.**
   WHEN `computeRiskExposure` receives node attrs with negative `downtimeCostPerDay`, `recoveryDays`, or `replacementCost`, THEN the resulting exposure MUST be `≥ 0` (clamped) or flagged invalid — it MUST NOT return a negative € value such as `-2500`.

8. **AC-8 — `simulatePersonLeaving` on a nonexistent id is explicit.**
   WHEN `simulatePersonLeaving(nodes, edges, "ghost")` is called with an id absent from `nodes`, THEN the report summary MUST signal "person not found" (or equivalent explicit unknown-person marker) — it MUST NOT report "✅ no significant impact".

9. **AC-9 — `deleteNode` cascade is atomic.**
   WHEN `persistent-graph-service.deleteNode` cascades edge deletion and one `repo.deleteEdge` throws, THEN the operation MUST propagate the error and leave no orphaned edges from the cascade (node not deleted when edges remain) — no partial cascade state.

10. **AC-10 — `computeCoverage` distinguishes empty-critical from full-coverage.**
    WHEN `computeCoverage` is called with a graph containing zero critical knowledge nodes, THEN `coveragePercent` MUST NOT be 100 — it MUST be 0 (or an explicit empty-state marker), consistent with `CompanyIQ` returning 0 on empty input.

## Non-goals

- New features, refactors beyond the minimal surgical fix per bug.
- Perf/UI/infra changes; LLM prompt tuning; CSV quoted-comma parsing; SVG policy review; vector-store quality.
- Introducing new public APIs or persisted schema migrations (additive fallback only, documented).

## Test plan (one test per criterion)

| AC | File | RED assertion | GREEN behavior |
|---|---|---|---|
| 1 | `web/test/domain/simulator.test.ts` | `remainingEdges` still contains `P→B` DEPENDS_ON | edge removed |
| 2 | `web/test/domain/ingest.test.ts` | only one `person-` id / one proposal | two distinct ids, two proposals |
| 3 | `web/test/domain/company-service.test.ts` | second `createCompany("!!!")` overwrites | throws or distinct id |
| 4 | `web/test/domain/graph-service.test.ts` | returned array lacks `graph.node.deleted` | deletion event present |
| 5 | `web/test/domain/graph-service.test.ts` | X applied, Z skipped after throw | reverted to pre-batch state |
| 6 | `web/test/lib/rate-limiter.test.ts` | `buckets.size === 10_000` | `buckets.size ≤ cap` |
| 7 | `web/test/domain/financial-exposure.test.ts` | exposure === -2500 | exposure ≥ 0 or invalid flag |
| 8 | `web/test/domain/simulator.test.ts` | summary.message === "no significant impact" | explicit person-not-found |
| 9 | `web/test/domain/persistent-graph-service.test.ts` | orphaned edges remain after throw | error propagates, no orphans |
| 10 | `web/test/domain/metrics.test.ts` | `coveragePercent === 100` on empty critical | 0 or empty-state marker |

Runner: `npm --prefix web run test`. Every test goes RED on current code, GREEN after the surgical fix, and stays green after triangulation.
