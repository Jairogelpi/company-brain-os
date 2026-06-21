# Explore — hunt-bugs-edge-cases

## Territory map (files read, what each does)

- `web/src/domain/graph.ts` — node/edge type defs + `validateGraph` (endpoint rules, knowledge confidence 0–100).
- `web/src/domain/graph-service.ts` — in-memory mutable graph service; optimistic apply + validate + revert; cascade edge deletion; proposal application.
- `web/src/domain/persistent-graph-service.ts` — repo-backed async twin of the above; UUID event ids; cascade via sequential `repo.deleteEdge`.
- `web/src/domain/metrics.ts` — bus factors, confidences, coverage, dependencies, resilience, health, CompanyIQ.
- `web/src/domain/risk-engine.ts` — SPOF / bus-factor-zero / undocumented-critical / low-resilience detectors + unified report.
- `web/src/domain/simulator.ts` — `simulatePersonLeaving` (filters both edge directions) and `simulateMultipleLeaving` (filters only `fromNodeId`).
- `web/src/domain/simulation-exposure.ts` — € exposure of newly-emerged risks via `computeTotalExposure`.
- `web/src/domain/succession.ts` — offboarding playbook; priority = criticality×1e6 + exposure − busFactor; optional lastDay scheduling.
- `web/src/domain/ingest.ts` — CSV/text → proposals; accent-stripped slug; idempotent dedupe.
- `web/src/domain/financial-exposure.ts` — risk → € via node cost attrs with documented defaults; `num()` guards only `Number.isFinite`.
- `web/src/domain/company-service.ts` — in-memory tenant map; slug from name; no uniqueness check.
- `web/src/auth/permissions.ts` — role hierarchy + `guardOperation` (null user, company mismatch, unknown op all handled).
- `web/src/ai/extraction.ts` — LLM JSON extraction with regex salvage + heuristic fallback.
- `web/src/ai/organization-memory.ts` — vector index + templated answers; empty-store handled.
- `web/src/lib/upload-policy.ts` — MIME allow-list (SVG excluded), inline-safe set.
- `web/src/lib/rate-limiter.ts` — token bucket; module-level `buckets` Map, no eviction.

## Candidate edge cases

| area | scenario | expected behavior | suspected bug | severity |
|---|---|---|---|---|
| simulator | multiple people leave, one is `toNodeId` of a DEPENDS_ON edge | inbound edges to departing people removed | `simulateMultipleLeaving` filters only `e.fromNodeId` — asymmetry vs single sim (line 80 filters both) | HIGH |
| ingest | two employees with non-Latin-only names (CJK/Cyrillic/Arabic) | two distinct person nodes | `slug()` collapses whole name to `-` → both get `id="person-"` → second silently deduped → DATA LOSS | HIGH |
| company-service | createCompany("Acme Corp!") then createCompany("Acme  Corp") | second rejected or disambiguated | identical slug → `companies.set` overwrites first silently; empty/special names → empty slug → collision | MEDIUM |
| graph-service | applyProposalsWithDecisions with rejections causing deletions | returned events include deletions | return value is only `applyConfirmedProposals(approved)`; deletion events emitted to log but EXCLUDED from return (line 355) | MEDIUM |
| graph-service | applyConfirmedProposals batch where update_node targets missing node | whole batch rolled back or skipped | `updateNode` throws "Missing node" mid-batch; earlier proposals already applied, no rollback (line 282) | MEDIUM |
| rate-limiter | long-lived server, many distinct IP keys | bounded memory | `buckets` Map grows unbounded, no eviction/expiry → memory leak | MEDIUM |
| financial-exposure | node with negative downtimeCostPerDay/recoveryDays/replacementCost | guard or clamp negatives | `num()` only checks `Number.isFinite`; negatives pass → negative/absurd exposure | LOW-MEDIUM |
| simulator | simulatePersonLeaving(nonexistentId) | error or "person not found" | silent no-op; report says "✅ no significant impact" with personName=raw id (line 65) | LOW-MEDIUM |
| persistent-graph-service | deleteNode cascade where one repo.deleteEdge throws | atomic rollback | sequential awaits; partial cascade leaves orphaned edges, node not deleted (line ~120) | MEDIUM |
| metrics | computeCoverage with zero critical knowledge | neutral/0% or explicit empty state | returns 100% (vacuous) → inflates health; inconsistent with CompanyIQ returning 0 on empty | LOW |

## Concrete failing-test ideas (RED)

1. **simulator asymmetry:** build graph Person A MASTERS K, Person B MASTERS K, Process P DEPENDS_ON Person B. `simulateMultipleLeaving([B])`. Assert `remainingEdges` excludes the DEPENDS_ON edge → currently it stays → `processImpacts` wrong, exposure wrong.
2. **slug collision:** `parseEmployeeCsv`/`mapEmployeeRows` with rows `name=王明` and `name=李雷`. Assert two distinct `person-` ids and two create_node proposals → currently one proposal, one lost person.
3. **company overwrite:** `createCompany("!!!")` twice. Assert second throws or yields distinct id → currently same `company-` id, first overwritten.
4. **deletion events missing:** load graph, `applyProposalsWithDecisions` rejecting an existing node's create (forcing a delete). Assert returned array contains a `graph.node.deleted` event → currently absent.
5. **partial apply:** batch = [create_node X, update_node Y(missing), create_node Z]. Assert either all-or-nothing or documented partial semantics with clear error → currently X applied, Z skipped, throw.
6. **rate-limiter memory:** call `checkRateLimit` with N=10000 distinct keys. Assert `buckets.size` bounded/capped → currently == N (unbounded).
7. **negative exposure:** node attrs `{downtimeCostPerDay:-500, recoveryDays:5}`. Assert `computeRiskExposure` exposure ≥ 0 or `estimated` flagged invalid → currently -2500.
8. **nonexistent person sim:** `simulatePersonLeaving(nodes, edges, "ghost")`. Assert report signals unknown person (e.g. `summary.message` not "no significant impact") → currently misleading success.
9. **non-atomic cascade:** mock repo whose `deleteEdge` throws on 2nd edge. Assert no orphaned edges remain / error propagates → currently partial state.
10. **coverage vacuity:** `computeCoverage([], [])` and graph with only non-critical knowledge. Assert coveragePercent not 100 when no critical exists (or document semantics) → currently 100.

## Out of scope

- Fixing any bug, writing tests, perf/UI/infra, LLM prompt tuning, CSV quoted-comma parsing (documented ponytail), SVG policy review, vector-store quality.

## Open questions for proposal phase

- Should `simulateMultipleLeaving` reuse the single-person two-direction filter?
- Should non-Latin slugs hash the name (or keep unicode) instead of collapsing?
- Should `applyProposalsWithDecisions` return ALL events (deletions + creates)?
- Should `applyConfirmedProposals` be transactional (snapshot + revert) on mid-batch failure?
- Should `computeCoverage` distinguish "no critical" from "fully covered"?
