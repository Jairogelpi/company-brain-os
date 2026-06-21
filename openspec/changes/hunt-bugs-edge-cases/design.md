# Design — hunt-bugs-edge-cases

## Approach (TDD per bug, surgical fixes)

Strict TDD per `openspec/config.yaml` (`strict_tdd: true`, runner `npm --prefix web run test`). For every AC: write a Vitest RED assertion that fails on current code, apply a minimal surgical fix to the affected module only, then triangulate with a second assertion. No new public APIs, no refactors, no schema migrations (additive fallback only). Each fix targets one function and a handful of lines.

## Per-bug design

### AC-1 — Simulator multi-leave filters both edge directions

**Fix:** `web/src/domain/simulator.ts`, `simulateMultipleLeaving`, the `remainingEdges` filter (currently `e => !personIds.includes(e.fromNodeId)`). Change to `e => !personIds.includes(e.fromNodeId) && !personIds.includes(e.toNodeId)` — mirrors `simulatePersonLeaving` (line 89). No other logic changes; downstream metric recompute already uses `remainingEdges`.
**Tradeoffs:** Reusing single-leave filter would recompute metrics once per person (wrong semantics for "simultaneous"). Direct filter keeps the single-pass design. **Rejected:** loop-calling `simulatePersonLeaving` per person — would double-filter and overwrite reports.
**Regression risk:** Low. Only widens the removed-edge set, which is the documented intent.

### AC-2 — Non-Latin names yield distinct person ids

**Decision: stable hash of the original name.** In `web/src/domain/ingest.ts`, `slug()` collapses non-Latin names to `-` so `person-` collides. Fix: when the slug is empty after accent-stripping, append a short stable hash of the original name (FNV-1a 32-bit → base36, 8 chars). Result ids like `person-<hash>`. Latin names keep current `person-<slug>` ids (no migration impact). Id stability: same name → same hash → same id across re-runs (idempotent dedupe still works).
**Alternatives rejected:** (a) Keep Unicode chars in id — breaks `[^a-z0-9]` invariant used by edge-id templates and URL/slug consumers; migration cost high. (b) Counter suffix `person--2` — unstable across batch ordering → re-imports create duplicates, breaking idempotency. Hash is stable and minimal.
**Regression risk:** Medium. Only affects non-Latin-only names that previously produced `person-`; such ids were already broken (data loss), so no fixture should depend on them. Add migration note in change log: any persisted `person-` nodes from CJK ingest are pre-existing data-loss artifacts.

### AC-3 — `createCompany` rejects slug collisions

**Decision: typed error class.** `web/src/domain/company-service.ts`. Add `export class CompanySlugConflictError extends Error { readonly slug: string; existingId: string }`. In `createCompany`, after computing `id`, if `companies.has(id)` throw the typed error. Also guard empty slug: if `slug === ""`, throw `new Error("Company name must produce a non-empty slug")` (or assign `slug = "untitled"` + hash; minimal choice = reject, matches "no silent overwrite" intent).
**Why typed error vs return null vs throw Error:** callers of `createCompany` currently expect a `Company` return (no null path plumbed). Throwing matches the service's existing error style (`graph-service` throws `Missing node`). Typed class lets callers `instanceof`-branch without parsing message strings. **Rejected:** return `null` — forces all call sites to null-check; larger blast radius. **Rejected:** disambiguated id (`company-acme-2`) — silent, hides the collision from the operator.
**Regression risk:** Medium. Audit `web/test/domain/company-service.test.ts` and any fixture creating two same-slug companies; those tests now assert the throw (RED→GREEN). Demo seed unchanged.

### AC-4 — `applyProposalsWithDecisions` returns deletion events

**Fix:** `web/src/domain/graph-service.ts`, `applyProposalsWithDecisions`. Currently it calls `deleteEdge`/`deleteNode` (which `emit` into the event log) then `return applyConfirmedProposals(approvedProposals)` — the deletion events are emitted but discarded. Capture them: accumulate `const deletionEvents: GraphServiceEvent[] = []` and push each `deleteEdge`/`deleteNode` return, then `return [...deletionEvents, ...applyConfirmedProposals(approvedProposals)]`. Same one-line pattern in `persistent-graph-service.ts` (its twin).
**Tradeoffs:** Mirrors the existing `emit`+return style; no API change. **Rejected:** reading back `eventLog()` in caller — leaks internal ordering and would double-count on persistent service where events are persisted.
**Regression risk:** Low. Return array grows; callers that assert exact length need updating (RED→GREEN test does exactly this).

### AC-5 — `applyConfirmedProposals` is atomic on mid-batch failure

**Decision: snapshot + revert, mirroring the existing optimistic-apply revert pattern.** In `graph-service.ts`, `applyConfirmedProposals`: before the loop, snapshot `const nodeSnap = new Map(nodes); const edgeSnap = new Map(edges); const eventsSnap = events.length;`. Wrap the loop in `try { ... } catch (e) { nodes.clear(); edges.clear(); for (const [k,v] of nodeSnap) nodes.set(k,v); for (const [k,v] of edgeSnap) edges.set(k,v); events.length = eventsSnap; throw e; }`. This matches `createNode`/`updateNode`/`createEdge` which already revert on `validateSnapshot` throw.
**Alternatives rejected:** (a) Transaction-style wrapper abstraction — new API, scope creep. (b) Documented partial semantics — the spec explicitly forbids "X applied, Z skipped while propagating throw". Snapshot+revert is minimal and consistent with the file's existing pattern.
**Regression risk:** Medium. Audit tests for any assertion that partial state persists after a throw — those encode the bug and must flip to asserting pre-batch state. Persistent service (`persistent-graph-service.ts`) is NOT in AC-5 scope; its `applyConfirmedProposals` already has the same latent bug but repo revert requires a transaction abstraction — explicitly **out of scope** here (note in change log).

### AC-6 — `rate-limiter` bounds `buckets.size`

**Decision: max-size cap with clear-oldest (simplest bounded memory).** `web/src/lib/rate-limiter.ts`. Add `const MAX_BUCKETS = 10_000;` (documented cap). In `checkRateLimit`, when inserting a new bucket and `buckets.size >= MAX_BUCKETS`, evict the oldest entry (`buckets.keys().next().value` — Map preserves insertion order → oldest first). No TTL sweep loop, no LRU bookkeeping on hot path.
**Tradeoffs:** LRU (touch on hit) is more accurate but adds per-call cost and a `delete`+re-insert on every read; the spec asks "simplest that bounds memory". Clear-oldest is O(1), bounds memory exactly at `MAX_BUCKETS`, and is acceptable for IP-keyed buckets where churn evicts cold keys. **Rejected:** TTL sweep — needs a periodic timer or lazy sweep pass (more code, unbounded between sweeps).
**Regression risk:** Low. Existing tests use few keys and `resetRateLimits()` still clears.

### AC-7 — Negative cost attrs do not produce negative exposure

**Fix:** `web/src/domain/financial-exposure.ts`, `num()` helper. Currently `Number.isFinite` alone. Change to `return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;`. Negatives then fall through to documented defaults and flag `estimated: true` — exposing invalidity without producing absurd €.
**Tradeoffs:** Clamp (`Math.max(0, v)`) would silently zero negatives and still mark `estimated=false` (hiding invalid upstream). Treat-as-missing surfaces the issue via `estimated` and uses the safe default. **Rejected:** throwing — exposure is a pure aggregate used in playbooks; throwing would break report rendering. **Rejected:** clamp-only — hides bad data.
**Regression risk:** Low. Only affects negative inputs that previously yielded negative €; no valid fixture should rely on those.

### AC-8 — `simulatePersonLeaving` on a nonexistent id is explicit

**Fix:** `web/src/domain/simulator.ts`, `simulatePersonLeaving`. After the `person` lookup, if `!person`, build and return a minimal `SimulationReport` whose `summary.message = \`⚠️ Person not found: ${personId}\`` (and `scenario`/`personName` set accordingly, zero impacts, before==after metrics). Keep the existing `personName = person?.name ?? personId` line.
**Tradeoffs:** Throwing would force all callers (UI, playbook) to try/catch; returning an explicit-marker report matches the function's "always returns a report" contract. **Rejected:** returning null — same blast radius as AC-3's rejected null.
**Regression risk:** Low. Only affects the ghost-id branch previously masquerading as success.

### AC-9 — `deleteNode` cascade is atomic

**Decision: attempt-all-edges-then-delete-node, fail before node deletion.** `web/src/domain/persistent-graph-service.ts`, `deleteNode`. Currently it `await repo.deleteEdge(e.id)` inside the loop, so a throw mid-loop leaves some edges gone and the node still present. Fix: collect `cascadedIds` first (no deletes), then `for (const id of cascadedIds) await repo.deleteEdge(id);` — if any throws, the node is never deleted and the error propagates; surviving edges remain (consistent: node still exists, so its edges are not orphans). Delete the node only after all edge deletes succeed.
**Alternatives rejected:** (a) DB transaction — the `GraphRepository` abstraction exposes no transaction; adding one is scope creep and a public API change. (b) Best-effort revert of already-deleted edges — `repo` has no `createEdge`-from-before guarantee and would require snapshotting each edge; complex and still non-atomic. The chosen "all edges first, node last, propagate error" matches the spec ("node not deleted when edges remain") and is the minimal repo-abstraction-safe fix.
**Regression risk:** Medium. Test with a mock repo whose `deleteEdge` throws on the 2nd edge; assert node still readable and error propagates. Audit for tests relying on partial cascade.

### AC-10 — `computeCoverage` distinguishes empty-critical from full-coverage

**Fix:** `web/src/domain/metrics.ts`, `computeCoverage`. Change the ternary: `critical.length > 0 ? Math.round((covered.length / critical.length) * 100) : 0`. Now empty-critical → 0, consistent with `computeCompanyIQ`'s `totalKnowledge > 0 ? ... : 0`.
**Tradeoffs:** Returning an explicit `{ empty: true }` marker would change the return type — public API change, out of scope. 0 is consistent with `CompanyIQ` and clearly distinguishes from 100 (full coverage). **Rejected:** keep 100 and document — spec explicitly requires "MUST NOT be 100".
**Regression risk:** Medium. Downstream `computeHealth` uses `coverageScore`; health numbers shift for empty-critical graphs. Audit metrics/health fixtures and the risk-engine; flip expected values RED→GREEN.

## Tradeoffs (cross-cutting)

- **Id stability vs correctness (AC-2):** chose stable hash so idempotent re-imports still dedupe; accepted that pre-existing `person-` artifacts from broken ingest are orphaned (documented, not migrated).
- **Atomicity without transactions (AC-5, AC-9):** both use snapshot+revert / ordering rather than introducing a transaction abstraction — keeps scope surgical, matches existing optimistic-apply pattern in `graph-service`.
- **Error style consistency (AC-3, AC-8):** throw typed error where the function already returns a value and callers don't expect null; return explicit-marker report where the function's contract is "always returns a report".
- **Bounded memory, minimal hot-path cost (AC-6):** clear-oldest over LRU/TTL to keep `checkRateLimit` O(1).

## Risks & mitigations

- **AC-2 / AC-3 / AC-10 alter generated ids and reported numbers** → audit fixtures first; RED tests encode the new contract; document in change log.
- **AC-5 snapshot+revert could mask tolerated partial states** → grep tests for assertions on post-throw partial state; flip them.
- **AC-9 cascade ordering change** → mock-repo RED test locks "node survives if any edge delete throws".
- **AC-4 return array grows** → callers asserting exact length update via RED→GREEN.
- **AC-7 negative→default** → estimated flag now true for invalid inputs; UI labels surface it.

## Out of scope

- `persistent-graph-service.applyConfirmedProposals` batch atomicity (AC-5 twin) — needs repo transaction abstraction.
- DB transactions, new public APIs, schema migrations, perf/UI/infra, LLM prompt tuning, CSV quoted-comma parsing, SVG policy, vector-store quality, migrating pre-existing `person-` artifacts.
