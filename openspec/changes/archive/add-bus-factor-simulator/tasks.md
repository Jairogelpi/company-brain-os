# Tasks — Bus-Factor Simulator

## 1. Engine wiring
- [x] 1.1 Reuse `simulatePersonLeaving` / `simulateMultipleLeaving` / `simulateDeepImpact` (cover spec scenarios)
- [x] 1.2 Euro impact: `src/domain/simulation-exposure.ts#simulationExposure` — exposure of NEW risks (after − before), via #4; degrades gracefully (2 TDD tests)

## 2. Simulator page
- [x] 2.1 `(app)/simulator/page.tsx`, loads graph via `useGraph`
- [x] 2.2 People multi-select (checklist)
- [x] 2.3 Results: orphaned knowledge, halted/weakened processes, cascade (second-order), € hero
- [x] 2.4 "Simulator" in sidebar nav

## 3. Entry points
- [x] 3.1 "Simulate departure →" on Person detail → /simulator?person=<id> (preselected)
- [ ] 3.2 "Simulate" affordance on People cards (deferred — detail link covers it)

## 4. Verify
- [x] 4.1 `npm run typecheck` + `npm test` (292)
- [x] 4.2 Live: Pedro → "Newly at risk €5,000", orphaned knowledge listed, cascade evaluated, graph unchanged; multi-select runs simulateMultipleLeaving without error

## Notes
- Read-only client-side simulation on the `/api/graph` snapshot (no writes, no endpoint).
- € always shown (estimated via #4 defaults) rather than omitted — consistent with
  the shipped financial-exposure behavior.
