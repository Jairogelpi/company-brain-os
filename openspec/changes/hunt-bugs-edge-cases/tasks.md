# Tasks — hunt-bugs-edge-cases

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~220–320 (10 modules × ~20–30 lines + ~30 tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR (surgical per-module fixes, TDD-bounded) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

## Phase 1: RED tests (write all failing tests first)

- [ ] 1. AC-1 RED — `web/test/domain/simulator.test.ts`: build A/B MASTERS K + P DEPENDS_ON B; call `simulateMultipleLeaving([B])`; assert `P→B` edge absent from `remainingEdges` (fails today).
- [ ] 2. AC-2 RED — `web/test/domain/ingest.test.ts`: ingest rows `王明` + `李雷`; assert two distinct `person-*` ids and two `create_node` proposals (fails: one id `person-`).
- [ ] 3. AC-3 RED — `web/test/domain/company-service.test.ts`: call `createCompany("!!!")` twice; assert second throws `CompanySlugConflictError` (fails: silent overwrite).
- [ ] 4. AC-4 RED — `web/test/domain/graph-service.test.ts`: reject a proposal targeting an existing node; assert returned array contains `graph.node.deleted` event (fails: absent).
- [ ] 5. AC-5 RED — `web/test/domain/graph-service.test.ts`: batch `[create X, update missing Y, create Z]`; assert graph reverts to pre-batch state after `updateNode` throws (fails: X applied).
- [ ] 6. AC-6 RED — `web/test/lib/rate-limiter.test.ts`: call `checkRateLimit` with 10 000 distinct keys; assert `buckets.size ≤ cap` (fails: == 10 000).
- [ ] 7. AC-7 RED — `web/test/domain/financial-exposure.test.ts`: node attrs `{downtimeCostPerDay:-500, recoveryDays:5}`; assert `computeRiskExposure` exposure ≥ 0 or `estimated` true (fails: -2500).
- [ ] 8. AC-8 RED — `web/test/domain/simulator.test.ts`: `simulatePersonLeaving(nodes, edges, "ghost")`; assert `summary.message` signals person-not-found (fails: "no significant impact").
- [ ] 9. AC-9 RED — `web/test/domain/persistent-graph-service.test.ts`: mock repo `deleteEdge` throws on 2nd edge; assert node survives and error propagates (fails: orphaned edges).
- [ ] 10. AC-10 RED — `web/test/domain/metrics.test.ts`: `computeCoverage` on graph with zero critical knowledge; assert `coveragePercent === 0` (fails: 100).

## Phase 2: GREEN fixes (one per AC, surgical)

- [ ] 11. AC-1 GREEN — `web/src/domain/simulator.ts` `simulateMultipleLeaving`: change `remainingEdges` filter to also exclude `e.toNodeId` in `personIds`; run AC-1 test → green.
- [ ] 12. AC-2 GREEN — `web/src/domain/ingest.ts` `slug`: when slug empty after accent-strip, append FNV-1a 32-bit base36 hash (8 chars) of original name → `person-<hash>`; run AC-2 → green.
- [ ] 13. AC-3 GREEN — `web/src/domain/company-service.ts`: add `CompanySlugConflictError` class; in `createCompany` throw on `companies.has(id)` and on empty slug; run AC-3 → green.
- [ ] 14. AC-4 GREEN — `web/src/domain/graph-service.ts` `applyProposalsWithDecisions`: accumulate `deleteEdge`/`deleteNode` return events and prepend to `applyConfirmedProposals` return; run AC-4 → green.
- [ ] 15. AC-5 GREEN — `web/src/domain/graph-service.ts` `applyConfirmedProposals`: snapshot `nodes`/`edges`/`events.length` pre-loop; on catch, restore snapshot then rethrow; run AC-5 → green.
- [ ] 16. AC-6 GREEN — `web/src/lib/rate-limiter.ts`: add `MAX_BUCKETS = 10_000`; on new-bucket insert when at cap, evict oldest (`buckets.keys().next().value`); run AC-6 → green.
- [ ] 17. AC-7 GREEN — `web/src/domain/financial-exposure.ts` `num`: guard `v >= 0` in addition to `Number.isFinite`; negatives → undefined (fall to default, `estimated=true`); run AC-7 → green.
- [ ] 18. AC-8 GREEN — `web/src/domain/simulator.ts` `simulatePersonLeaving`: when `!person`, return report with `summary.message = "⚠️ Person not found: ${personId}"`; run AC-8 → green.
- [ ] 19. AC-9 GREEN — `web/src/domain/persistent-graph-service.ts` `deleteNode`: collect cascade edge ids first, then `for await repo.deleteEdge`; delete node only after all succeed; propagate error; run AC-9 → green.
- [ ] 20. AC-10 GREEN — `web/src/domain/metrics.ts` `computeCoverage`: ternary `critical.length > 0 ? round(covered/critical*100) : 0`; run AC-10 → green.

## Phase 3: Triangulate + Verify

- [ ] 21. AC-1 TRI — `simulator.test.ts`: add case with two departures where one is `toNodeId`, one is `fromNodeId`; assert both edges removed.
- [ ] 22. AC-2 TRI — `ingest.test.ts`: re-import same CJK rows twice; assert idempotent (same ids, no duplicate proposals).
- [ ] 23. AC-3 TRI — `company-service.test.ts`: assert Latin collision (`"Acme Corp!"` then `"Acme  Corp"`) also throws same typed error.
- [ ] 24. AC-5 TRI — `graph-service.test.ts`: assert successful batch (no missing node) still applies all proposals and events length correct.
- [ ] 25. AC-6 TRI — `rate-limiter.test.ts`: assert eviction re-admits a new key after cap reached; `resetRateLimits()` still clears.
- [ ] 26. AC-7 TRI — `financial-exposure.test.ts`: assert valid non-negative attrs still produce `estimated=false` with correct €.
- [ ] 27. AC-10 TRI — `metrics.test.ts`: assert partial coverage (1 of 2 critical covered) still reports 50; only empty-critical reports 0.
- [ ] 28. Audit fixtures — grep `web/test` for assertions on old `person-` ids, `coveragePercent===100` on empty, post-throw partial state; flip to new contract RED→GREEN.
- [ ] 29. Full suite — run `npm --prefix web run test`; confirm all green, no regressions, no skipped tests.
- [ ] 30. Typecheck — run `npm --prefix web run typecheck`; confirm no new type errors from added error class / report branch.
