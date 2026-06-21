# Design — llm-succession-playbooks

> Companion to `spec.md` (acceptance criteria AC-1..AC-10). This design fixes the
> technical approach, signatures, prompt shape, fallback ladder, trainer
> grounding algorithm, and rollout sequence. `require_tradeoffs: true` is
> satisfied by the dedicated **Tradeoffs** section.

## 1. Goals & non-goals (recap)

**Goals:** extend `PlaybookAction` with optional LLM fields; add
`enrichPlaybookWithLLM` in `web/src/ai/` that fills those fields per action
while leaving heuristic `priorityScore`/`action`/`targetDate` byte-identical;
wire it into the succession page with graceful fallback; round-trip enrichment
fields through mission persistence.

**Non-goals (v1):** trainer auto-assignment, calendar/HRIS, multi-turn
refinement chat, replacing heuristic prioritization, changing the mission model
beyond adding optional columns.

## 2. Technical approach

### 2.1 Layering

```
web/src/app/(app)/succession/page.tsx   (UI orchestration, async)
        │  await enrichPlaybookWithLLM(playbook, graph, cfg?)
        ▼
web/src/ai/succession-enrichment.ts     (NEW — LLM-only, pure-ish)
        │  imports chatCompletion / getLlmConfig / LlmConfig from ./client
        │  imports types-only from @/domain/succession, @/domain/graph
        ▼
web/src/ai/client.ts                    (existing — LLM transport)
        │
web/src/domain/succession.ts            (UNCHANGED behavior — heuristic only)
        │  MUST NOT import from @/ai/*
        ▼
web/src/domain/graph.ts                 (existing — types)
```

The page becomes the single composition point: it calls `generatePlaybook`
(deterministic) then `enrichPlaybookWithLLM` (optional). `domain/succession.ts`
stays LLM-free (AC-3) and its existing tests are untouched (AC-1, AC-10).

### 2.2 Type changes

In `web/src/domain/succession.ts` (type-only addition, no behavior change):

```ts
export interface PlaybookAction {
  // existing
  knowledgeId: string;
  knowledgeName: string;
  criticality: Criticality | null;
  busFactor: number;
  documented: boolean | null;
  priorityScore: number;
  action: string;
  targetDate?: string;
  // NEW — optional enrichment, absent when LLM unavailable
  detailedSteps?: string[];
  suggestedTrainerId?: string;
  suggestedTrainerName?: string;
  rationale?: string;
  riskNote?: string;
}
```

All new fields are optional. Heuristic-only callers never set them, so existing
tests and existing saved missions stay valid (AC-1, AC-9 backward path).

### 2.3 `enrichPlaybookWithLLM` signature

Lives in a new file `web/src/ai/succession-enrichment.ts`:

```ts
import type { GraphNode, GraphEdge } from "@/domain/graph";
import type { Playbook } from "@/domain/succession";
import type { LlmConfig } from "./client";
import { chatCompletion, getLlmConfig } from "./client";

export interface EnrichmentConfig {
  llm?: LlmConfig;            // override getLlmConfig() (for tests / explicit config)
  signal?: AbortSignal;       // optional cancellation (not required by spec, harmless)
}

export async function enrichPlaybookWithLLM(
  playbook: Playbook,
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
  config?: EnrichmentConfig,
): Promise<Playbook>;
```

**Contract:**

- Pure with respect to the input playbook's deterministic fields: returned
  `actions[i].priorityScore`, `.action`, `.targetDate`, `.knowledgeId`,
  `.knowledgeName`, `.criticality`, `.busFactor`, `.documented` are
  **byte-identical** to the input for every `i`. Order is preserved.
- Returns the *same* `Playbook` reference shape (new top-level object, but
  deterministic fields cloned verbatim) — never mutates the caller's input.
- On any failure path (no LLM, network error, non-JSON, partial JSON,
  ungrounded trainer), only the failing enrichment fields are dropped; the
  heuristic backbone is always preserved (AC-4, AC-5).
- Idempotent given identical LLM responses (AC-10): no `Date.now()`,
  no `Math.random()`, no incremental counters in the enrichment path.

### 2.4 Internal decomposition (single file, small helpers)

```ts
// 1. Build the per-person subgraph (cost bounding — AC-7)
buildSuccessionSubgraph(personId, graph): Subgraph
//   - the Person node
//   - all Knowledge nodes the person MASTERS (level >= 3 per metrics.ts)
//   - for each such Knowledge: other Person nodes that MASTERS it (candidates)
//   - first-hop DEPENDS_ON / REQUIRES neighbors of those Knowledge nodes
//   - explicitly excludes all unrelated people/knowledge

// 2. Build the prompt
buildEnrichmentPrompt(playbook, subgraph): { system, user }
//   - reuses consultant.ts patterns: system prompt with strict JSON schema,
//     user prompt with a compact data payload, "Return raw JSON only."

// 3. Parse + validate per-action
parseEnrichmentResponse(raw, playbook, subgraph): PerActionEnrichment[]
//   - tolerant JSON extraction (regex match for {...}, same as consultant.ts)
//   - per-action shape validation; bad entries become null (partial fallback)

// 4. Ground trainer suggestions
groundTrainer(suggestedName, subgraph): { id, name } | null
//   - matches by exact name, then case-insensitive name, then fuzzy contains
//   - only Person nodes inside the subgraph are eligible (never invented)

// 5. Merge — never overwrites deterministic fields
mergeEnrichment(playbook, enrichments): Playbook
```

### 2.5 Prompt construction (reusing `consultant.ts` patterns)

Mirrors `web/src/ai/consultant.ts`:

- One `system` message with a strict JSON contract and "Return raw JSON only.
  No markdown. No reasoning."
- One `user` message with a compact, line-based data payload.
- Single `chatCompletion([...], cfg)` call (one bounded call per playbook —
  AC-7 cost bounding is per-person, not per-action).
- Tolerant JSON extraction via `content.match(/\{[\s\S]*"actions"[\s\S]*\}/)`
  adapted to this schema (consultant.ts matches `"recommendations"`; here we
  match `"actions"`).

**System prompt (sketch):**

```
You are an AI succession planner for Company Brain OS. You receive a
departing person's knowledge-transfer playbook (heuristic actions with
priority, target date, criticality, bus factor, documentation state) and
the subgraph of people who could replace them.

For EACH action in the input order, return an enrichment object with:
  - "knowledgeId": string — must equal the input action's knowledgeId
  - "detailedSteps": array of 2-5 concrete transfer steps (strings)
  - "suggestedTrainerName": string — name of a Person from the candidate
        list, or "" if no internal candidate exists
  - "rationale": string — why this action matters, referencing
        criticality and documentation state
  - "riskNote": string — risk if transfer fails; if no internal candidate,
        say so and recommend documentation + external hire/reassignment

Rules:
  - Do NOT reorder actions. Do NOT change priority or dates.
  - Only suggest trainers from the provided candidate list.
  - Return raw JSON only. No markdown. No reasoning.

Return: { "actions": [ ...enrichment objects in input order... ] }
```

**User prompt (sketch):**

```
Departing person: {name} (last day: {lastDay ?? "unset"})

Actions (in priority order — do not reorder):
1. knowledgeId={k1} "{name1}" criticality={c1} busFactor={bf1}
   documented={d1} targetDate={t1} action="{heuristic action string}"
2. ...

Candidate trainers per knowledge area:
- "{knowledgeName1}": [ {personNameA}, {personNameB} ]
- "{knowledgeName2}": []  (no internal candidate)

Adjacent dependencies:
- "{knowledgeName1}" REQUIRES: [ ... ]
```

The candidate-trainers block is *precomputed by `buildSuccessionSubgraph`*
from `MASTERS` edges with `attributes.level >= 3` (matches `metrics.ts` bus
factor definition), excluding the departing person themselves. This is what
makes trainer grounding deterministic and cheap — the LLM picks a name from a
closed set, and `groundTrainer` validates it against the same set.

### 2.6 Fallback ladder (AC-4)

`enrichPlaybookWithLLM` runs through these gates in order; any failure
short-circuits to the appropriate fallback:

| # | Condition                                | Action                                                            |
|---|------------------------------------------|-------------------------------------------------------------------|
| 1 | `config?.llm ?? getLlmConfig()` is null  | return input playbook unchanged (no enrichment fields)            |
| 2 | playbook has 0 actions                   | return input unchanged (nothing to enrich)                        |
| 3 | `chatCompletion` throws                  | catch, return input unchanged                                     |
| 4 | no `{...}` JSON match in response        | return input unchanged                                            |
| 5 | `JSON.parse` throws                      | return input unchanged                                            |
| 6 | response shape invalid at top level      | return input unchanged                                            |
| 7 | per-entry: missing/invalid `knowledgeId` | that action keeps heuristic only; others proceed (partial fallback) |
| 8 | per-entry: ungrounded `suggestedTrainerName` | drop `suggestedTrainerId/Name` only; keep `detailedSteps`/`rationale`/`riskNote` if valid (AC-5) |
| 9 | per-entry: malformed `detailedSteps`     | drop `detailedSteps` only                                          |
| 10| happy path                               | merge all enrichment fields                                        |

**Partial fallback invariant (AC-4 "partially malformed"):** enrichment is
applied per-action, not all-or-nothing. The two valid actions in the spec
scenario keep their enrichment; the malformed one keeps its heuristic `action`
and gets no enrichment fields. `mergeEnrichment` walks `playbook.actions` in
order and looks up enrichment by `knowledgeId`; missing entries are skipped.

### 2.7 Trainer suggestion logic (AC-5, AC-7)

**Candidate set (deterministic, precomputed):**

```ts
function candidateTrainersFor(
  knowledgeId: string,
  personId: string,            // the departing person — excluded
  graph: { nodes, edges },
): { id: string; name: string }[] {
  return graph.edges
    .filter(e => e.type === "MASTERS"
              && e.toNodeId === knowledgeId
              && e.fromNodeId !== personId
              && (e.attributes?.level ?? 0) >= 3)
    .map(e => graph.nodes.find(n => n.id === e.fromNodeId && n.type === "Person"))
    .filter((n): n is PersonNode => !!n)
    .map(n => ({ id: n.id, name: n.name }));
}
```

**Grounding (`groundTrainer`):** given the LLM's `suggestedTrainerName` and
the precomputed candidate list for that action's `knowledgeId`:

1. Exact name match → `{id, name}`.
2. Case-insensitive name match → `{id, name}`.
3. Single candidate whose name contains the suggestion (or vice versa) →
   `{id, name}`.
4. Zero or ambiguous matches → `null` (drop the field, set `riskNote` to
   mention "no verified internal candidate" if the LLM didn't already).

The LLM is *never* trusted to invent an ID. The `suggestedTrainerId` written
into the action is always derived from the graph by `groundTrainer`, never
copied from the LLM response. This is the core grounding invariant (AC-5).

**No-candidate case (spec scenario "Subgraph with no candidate trainers"):**
the prompt explicitly tells the LLM the candidate list is empty for that
knowledge; `riskNote` MUST mention "no internal candidate" and the rationale
SHOULD recommend documentation + external hire/reassignment. `groundTrainer`
returns `null` and `suggestedTrainerId/Name` are omitted.

### 2.8 Subgraph construction (AC-7)

`buildSuccessionSubgraph(personId, graph)` returns:

```ts
interface Subgraph {
  person: { id: string; name: string };
  knowledge: Array<{
    id: string; name: string;
    criticality: Criticality | null;
    busFactor: number; documented: boolean | null;
    candidates: { id: string; name: string }[];   // trainer candidates
    dependencies: { id: string; name: string; type: NodeType }[];
  }>;
}
```

Construction:

1. The departing `Person` node.
2. `Knowledge` nodes the person `MASTERS` (any level; enrichment covers all
   mastered areas, not just critical — the heuristic already prioritized).
3. For each such knowledge: other `Person` nodes with `MASTERS level >= 3`
   (candidates), and first-hop `REQUIRES` / `DEPENDS_ON` neighbors.
4. **Excludes** every other person, every other knowledge, every unit/process
   not directly adjacent.

A 500-person graph with a departing person mastering 3 areas yields a prompt
containing ~3 knowledge nodes, their candidate experts (a handful), and their
immediate dependencies — not 500 people. The vitest case (Test Plan #7) builds
a graph with unrelated nodes and asserts the serialized prompt contains none
of them.

### 2.9 Page integration (AC-8)

`web/src/app/(app)/succession/page.tsx`:

- `generate` becomes `async` and calls `await enrichPlaybookWithLLM(...)` after
  `generatePlaybook`. Wraps in `try/catch`; on any error, sets the heuristic
  playbook and surfaces no error to the user (spec scenario "Page falls back
  gracefully").
- The render loop renders enrichment fields when present (`a.detailedSteps`,
  `a.suggestedTrainerName`, `a.rationale`, `a.riskNote`) and falls back to
  `a.action` only when absent. Existing display of `action`/`criticality`/
  `busFactor`/`targetDate` is unchanged.
- `copyMarkdown` extended to include `detailedSteps` (as a sub-list), trainer,
  rationale, and risk note per action when present (AC: export enriched).
- A loading state ("Enriching plan…") is shown while the LLM call is in flight
  so the UI doesn't appear frozen.

### 2.10 Mission round-trip (AC-9)

Today `POST /api/missions` maps `action` → `objective` and drops everything
else. To round-trip enrichment:

- `ActionInput` in `route.ts` gains optional `detailedSteps`,
  `suggestedTrainerId`, `suggestedTrainerName`, `rationale`, `riskNote`.
- `saveMissions` / `listMissions` in `web/src/server/missions.ts` and the
  underlying schema/row mapping gain the same optional columns (JSON column
  for `detailedSteps`, text columns for the rest). Migration adds columns
  nullable so heuristic-only missions save without them.
- The `Mission` domain type gains the same optional fields; the page's saved
  mission list renders them when present.

**Schema migration (sketch):**

```sql
ALTER TABLE missions
  ADD COLUMN detailed_steps        JSONB,
  ADD COLUMN suggested_trainer_id  TEXT,
  ADD COLUMN suggested_trainer_name TEXT,
  ADD COLUMN rationale             TEXT,
  ADD COLUMN risk_note             TEXT;
```

All nullable → existing rows and heuristic-only saves are unaffected.

## 3. Tradeoffs (required)

| Decision | Chosen | Rejected alternative | Tradeoff |
|---|---|---|---|
| **AI vs domain placement** | `enrichPlaybookWithLLM` in `web/src/ai/` | Put it in `domain/succession.ts` | Keeps domain pure (AC-3) at the cost of a second module and an extra import surface for the page. Worth it: domain stays unit-testable without LLM mocks. |
| **Enrichment granularity** | Per-action fields | Whole-plan narrative blob | Per-action is slightly more tokens and a larger JSON schema, but it preserves the existing UI/mission model (one row per action) and is reviewable action-by-action. A narrative would have forced a parallel display model. |
| **Context window** | Person subgraph | Full graph | Bounds cost and prompt focus (AC-7); costs us a `buildSuccessionSubgraph` helper and the risk of omitting a remotely-relevant person. Acceptable: trainer candidates are by definition local to the mastered knowledge. |
| **LLM call count** | One call per playbook | One call per action | One call is cheaper and gives the LLM the whole plan for coherent rationale; the tradeoff is a larger response and a single parse failure puts more at risk — mitigated by the partial-fallback ladder (gate #7). |
| **Trainer grounding** | LLM names a person; we resolve to graph ID by name match | LLM returns the ID directly | We never trust an LLM-supplied ID (it could hallucinate). Name-match is fuzzy and could mismatch on common names; mitigated by scoping matches to the precomputed candidate set for *that knowledge*, not the whole graph. |
| **Fallback granularity** | Per-action partial fallback | All-or-nothing | Partial fallback is more code (per-entry validation + merge) but matches the spec scenario "Partially malformed response keeps valid actions intact" (AC-4). All-or-nothing would discard good enrichment too easily. |
| **Type extension strategy** | Optional fields on existing `PlaybookAction` | New `EnrichedPlaybookAction` subtype | Optional fields keep one type and avoid narrowing/casting churn across page, API, domain, tests. Cost: callers must guard `a.detailedSteps?.length`. Acceptable. |
| **Persistence approach** | Add nullable columns to `missions` | Sidecar `mission_enrichment` table | Nullable columns are a one-table migration and a single row read; sidecar would keep `missions` pristine but add a join. The enrichment is 1:1 with missions and small, so columns win. |
| **Determinism** | LLM never sees priority/date mutation authority | Let LLM propose dates, then re-validate | The heuristic stays the sole source of `priorityScore`/`targetDate` (AC-1, AC-10). We give up potentially-better LLM-suggested scheduling; spec explicitly forbids LLM reordering. |
| **Page async transition** | `generate` becomes `async` with a loading state | Keep sync, fire-and-forget enrichment | Sync can't await the LLM; fire-and-forget races with `save`. Async + loading is the clean composition and matches the existing async `save`/`transition` pattern on the page. |

## 4. File changes (forecast)

| File | Change | Risk |
|---|---|---|
| `web/src/domain/succession.ts` | Add optional fields to `PlaybookAction` (type-only) | None — no behavior change (AC-1) |
| `web/src/ai/succession-enrichment.ts` | NEW — `enrichPlaybookWithLLM` + helpers | Core new code |
| `web/src/ai/__tests__/succession-enrichment.test.ts` | NEW — Test Plan #1–#8 | Strict TDD: tests first |
| `web/src/domain/__tests__/succession.test.ts` | Add static import-scan test (Test Plan #9) | Tiny addition |
| `web/src/app/(app)/succession/page.tsx` | async `generate`, enrichment UI, export fields | UI surface (AC-8) |
| `web/src/app/(app)/succession/page.test.tsx` (or co-located) | NEW — page both-branches test | UI test setup cost |
| `web/src/app/api/missions/route.ts` | Accept optional enrichment in `ActionInput` | Backward-compatible |
| `web/src/server/missions.ts` + schema | Add nullable columns + row mapping | Migration required |
| `web/src/domain/missions.ts` | Add optional enrichment fields to `Mission` | Type-only |
| `web/src/server/missions.test.ts` (or co-located) | NEW — round-trip test (AC-9) | Needs DB fixture |

**Changed-files forecast:** ~9 files touched, ~2 new files, ~1 SQL migration.
Estimated review workload: **~350–450 changed lines** (within the 500-line
review budget). If implementation drifts above 500, the apply phase must pause
for a delivery decision per session preflight.

## 5. Contracts (interfaces only — no implementations)

```ts
// web/src/ai/succession-enrichment.ts
export interface EnrichmentConfig {
  llm?: LlmConfig;
  signal?: AbortSignal;
}

export async function enrichPlaybookWithLLM(
  playbook: Playbook,
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
  config?: EnrichmentConfig,
): Promise<Playbook>;

// internal (not exported) — documented for review:
//   buildSuccessionSubgraph(personId, graph): Subgraph
//   buildEnrichmentPrompt(playbook, subgraph): { system, user }
//   parseEnrichmentResponse(raw, playbook, subgraph): PerActionEnrichment[]
//   groundTrainer(suggestedName, candidates): { id, name } | null
//   mergeEnrichment(playbook, enrichments): Playbook
```

**LLM response schema (the contract the model must satisfy):**

```jsonc
{
  "actions": [
    {
      "knowledgeId": "k-1",            // must match an input action
      "detailedSteps": ["step 1", "step 2"],
      "suggestedTrainerName": "Ada",   // "" or a candidate name
      "rationale": "Critical, undocumented…",
      "riskNote": "If Ada leaves too…"
    }
    // … in input order, one per action
  ]
}
```

## 6. Tests (strict TDD — tests land before/with code)

Mirrors spec Test Plan. Order = writing order, not execution order.

1. `succession-enrichment.test.ts` — happy path stubbed `chatCompletion` (AC-6).
2. — `getLlmConfig()` null → input unchanged (AC-4).
3. — `chatCompletion` rejects → input unchanged (AC-4).
4. — non-JSON response → input unchanged (AC-4).
5. — partial JSON (2 of 3 valid) → two enriched, one heuristic-only (AC-4).
6. — ungrounded trainer name → field dropped, heuristic `action` kept (AC-5).
7. — subgraph payload excludes unrelated nodes for a 500-person graph (AC-7).
8. — determinism: two calls, same stub → deep-equal; LLM reorders internally →
   output stays heuristic order (AC-10).
9. `succession.test.ts` — static import-scan: `domain/succession.ts` does not
   import `@/ai/*` (AC-3).
10. existing succession heuristic tests unchanged (AC-1, AC-10 regression).
11. page test — LLM mocked: enrichment renders; no LLM: heuristic renders, no
    error (AC-8).
12. persistence test — enriched mission round-trips fields; heuristic-only
    saves without them; tenant isolation still passes (AC-9).

**Commands:** `npm --prefix web run typecheck`, `npm --prefix web run test`.

**Stubbing strategy:** tests inject `EnrichmentConfig.llm` with a fake
`chatCompletion` (or a stubbed `LlmConfig` whose `fetch` is mocked, matching
how `consultant.ts` tests do it — confirm in apply phase). No real network.

## 7. Rollout

1. Type-only extension to `PlaybookAction` + `Mission` (AC-2). Typecheck.
2. New `web/src/ai/succession-enrichment.ts` with tests #1–#8 (strict TDD:
   write tests, then implement to green).
3. Domain purity test #9.
4. Page integration + page test (AC-8).
5. API + server + schema migration + persistence test (AC-9).
6. Full `npm --prefix web run test` + `typecheck` (AC-10).

Each step is independently revertable. Step 5 is the only one with a DB
migration; if it fails, steps 1–4 still ship a working heuristic+enrichment
flow with in-memory-only enrichment (no persistence of enrichment fields —
degraded but safe).

## 8. Risks & open questions

1. **Name collision in trainer grounding.** Two candidates named "Alex" on the
   same knowledge → `groundTrainer`'s exact-match returns the first. Mitigation:
   the prompt includes candidate IDs alongside names so the LLM can disambiguate
   in `rationale`; if exact match is ambiguous, `groundTrainer` returns `null`
   (safer to drop than to mis-assign). **Open:** confirm "drop on ambiguous" is
   acceptable to the parent; if not, switch to LLM-returns-id-but-we-still-
   validate-against-the-candidate-set.
2. **Mission schema migration ordering.** If apply runs the migration after
   code that writes the new columns, saves will fail. Migration must run first.
3. **Existing mission rows.** All new columns nullable → existing rows get
   `NULL`, `listMissions` returns missions without enrichment fields → page
   renders heuristic display. No backfill needed.
4. **LLM token budget.** A person mastering 20 knowledge areas could produce a
   large prompt/response. Bounded by subgraph, but **open:** should we cap
   actions sent to the LLM (e.g. top 10 by priority) and leave the rest
   heuristic-only? Spec doesn't require it; flagged for parent.
5. **Abort/cancellation.** `EnrichmentConfig.signal` is included for forward
   compatibility but spec doesn't require cancellation in v1. No UI wiring in
   this change.

## 9. Decisions log

- D1: `enrichPlaybookWithLLM` lives in `web/src/ai/succession-enrichment.ts`
  (new file), not in `domain/` — keeps domain LLM-free (spec AC-3).
- D2: One LLM call per playbook, per-action enrichment in the response —
  matches spec decision (per-action granularity, bounded cost).
- D3: Trainer grounding is name-match against a precomputed per-knowledge
  candidate set; LLM IDs are never trusted.
- D4: Partial per-action fallback (not all-or-nothing) — spec AC-4 requires it.
- D5: Persistence via nullable columns on `missions` (no sidecar table).
- D6: Page `generate` becomes async with a loading state.
