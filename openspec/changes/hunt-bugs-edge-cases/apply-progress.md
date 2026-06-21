# Apply Progress — hunt-bugs-edge-cases

## Status

Completed with strict TDD evidence for 8 confirmed public-behavior edge-case bugs plus one internal simulator filter fix. AC-4 was investigated and marked not reproducible via the public API because `confirmGraphProposals()` preserves the current graph when proposals are rejected; a rejected proposal does not delete existing nodes or edges.

## RED evidence

Targeted RED run before fixes:

```text
npx vitest run src/domain/simulator.test.ts src/domain/ingest.test.ts src/domain/company-service.test.ts src/domain/graph-service.test.ts src/domain/persistent-graph-service.test.ts src/domain/financial-exposure.test.ts src/domain/metrics.test.ts src/lib/rate-limiter.test.ts --config vitest.config.ts
```

Result: 8 failed files, 11 failed tests. Failures covered unknown-person simulation, multi-leave edge filtering helper missing, non-Latin ingest data loss, company slug collisions, graph-service batch atomicity, persistent cascade rollback, negative exposure, coverage vacuity, and unbounded rate-limiter buckets.

## GREEN fixes

- AC-1: `web/src/domain/simulator.ts` now uses a private `filterEdgesForDepartingPeople()` helper; `simulateMultipleLeaving()` filters both `fromNodeId` and `toNodeId` for departing ids without expanding the public API.
- AC-2: `web/src/domain/ingest.ts` now falls back to a stable FNV-1a base36 hash when accent-stripped slug output is empty, preserving deterministic ids for non-Latin names.
- AC-3: `web/src/domain/company-service.ts` now exports `CompanySlugConflictError`, rejects empty slugs, and throws on slug collisions instead of overwriting.
- AC-4: no confirmed public-API bug. `reject` decisions preserve current graph by design; no code change.
- AC-5: `web/src/domain/graph-service.ts` `applyConfirmedProposals()` snapshots nodes, edges, events length, and next event id; it restores on mid-batch failure.
- AC-6: `web/src/lib/rate-limiter.ts` adds a private bucket cap, evicts the oldest bucket at cap, and tests eviction through public `checkRateLimit()` behavior.
- AC-7: `web/src/domain/financial-exposure.ts` treats negative numeric cost attrs as missing, falls back to defaults, and marks estimates.
- AC-8: `web/src/domain/simulator.ts` returns an explicit `Person not found` report for unknown ids instead of a misleading success message.
- AC-9: `web/src/domain/persistent-graph-service.ts` rolls back already-deleted cascade edges if a later edge delete fails, preserving node + edges.
- AC-10: `web/src/domain/metrics.ts` returns `coveragePercent: 0` when there are zero critical knowledge nodes.

## Verification

Focused GREEN:

```text
npx vitest run src/domain/simulator.test.ts src/domain/ingest.test.ts src/domain/company-service.test.ts src/domain/graph-service.test.ts src/domain/persistent-graph-service.test.ts src/domain/financial-exposure.test.ts src/domain/metrics.test.ts src/lib/rate-limiter.test.ts --config vitest.config.ts
```

Result: 8 passed, 108 tests passed.

Full verification:

```text
npm run typecheck
npm run test
```

Result after reviewer fixes: typecheck passed. Full suite passed: 30 passed files, 1 skipped file, 305 passed tests, 3 skipped tests.

## Notes

- Existing simulator test fixture was corrected: it claimed Laura existed but omitted `laura` from the nodes array. With unknown-person handling fixed, that fixture needed to include `laura`.
- Reviewer flagged test-only public exports. Fixed by making the simulator edge-filter helper private and rewriting the rate-limiter tests to observe eviction behavior through the public `checkRateLimit()` API.
- Improved a weak coverage test that previously asserted only `coveredCritical >= 0`; it now asserts `coveragePercent === 100` for an actually fully covered critical graph.
- The initial full suite run hit a transient timeout in `src/ai/infrastructure.test.ts` while probing Ollama; the isolated test passed and the full rerun passed.
