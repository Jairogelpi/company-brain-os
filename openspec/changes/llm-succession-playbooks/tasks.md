# Tasks — llm-succession-playbooks

> Implementation checklist for change `llm-succession-playbooks`. Strict TDD
> (`openspec/config.yaml: strict_tdd: true`, vitest). Tasks are RED → GREEN →
> TRIANGULATE → REFACTOR ordered and dependency-ordered; each task fits one
> focused session with a clear start, finish, verification, and rollback
> boundary.
>
> Companion artifacts: `spec.md` (AC-1..AC-10), `design.md` (signatures,
> fallback ladder, grounding, rollout, tradeoffs). No code is implemented in
> this phase.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450–600 (additions + deletions) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (enrichment core + tests, AC-1..AC-7, AC-10) → PR 2 (page UI + persistence + migration, AC-8, AC-9) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Per-PR forecast (each fits the 500-line review budget):

- **PR 1 — `feat: succession LLM enrichment (AI layer, tests)`**
  `web/src/domain/succession.ts` (type-only, ~6 lines), `web/src/ai/succession-enrichment.ts` (new, ~180–220), `web/src/ai/__tests__/succession-enrichment.test.ts` (new, ~220–280), `web/src/domain/succession.test.ts` import-scan test (~20). **~450–520 changed lines** — borderline; if it drifts over 500 during apply, split the test file (cases #1–#5 vs #6–#8).
- **PR 2 — `feat(succession): wire enrichment into page + missions round-trip`**
  `web/src/app/(app)/succession/page.tsx` (+~60–90, async generate + UI + export), `web/src/app/(app)/succession/page.test.tsx` (new, ~120), `web/src/app/api/missions/route.ts` (+~20), `web/src/domain/missions.ts` (type-only, ~10), `web/src/server/missions.ts` (+~40), `web/src/db/schema.ts` (+~10), `web/drizzle/000X_*.sql` migration (+~8), `web/src/server/missions.test.ts` (new, ~120). **~390–420 changed lines** — under budget.

If apply detects either PR will exceed 500, **pause before sdd-apply** per
session preflight and confirm delivery with the parent.

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

## Pre-flight

- P-1 Read `openspec/changes/llm-succession-playbooks/design.md` § 3 (file-change forecast), § 6 (test plan), § 7 (rollout). Confirm `web/src/ai/client.ts` exports `chatCompletion`, `getLlmConfig`, `configureLlm`, `LlmConfig` (verified by this phase).
- P-2 Confirm `web/src/domain/succession.test.ts` exists and uses vitest (`describe("succession — generatePlaybook")`) — regression target for AC-1/AC-10.
- P-3 Confirm `web/db:drizzle.config.ts` → `out: "./drizzle"`; migrations land in `web/drizzle/`. Confirm `npm run db:migrate` exists.
- P-4 Decide stubbing approach for `chatCompletion`: `vi.spyOn(client, "chatCompletion").mockResolvedValue(...)` is the established pattern (`web/src/ai/extraction.test.ts` lines 88, 115, 146, 171, 204). Use it; do NOT make real network calls.

---

## PR 1 — Enrichment core (AI layer) + tests

**Goal:** AC-1, AC-2 (type), AC-3 (domain purity), AC-4 (fallback), AC-5 (grounding), AC-6 (shape), AC-7 (subgraph), AC-10 (determinism + suite green). No UI, no persistence changes.

### T1 — Extend `PlaybookAction` with optional enrichment fields (type-only, RED-ish → GREEN)

- **Files:** `web/src/domain/succession.ts`
- **Edit:** add optional fields `detailedSteps?: string[]`, `suggestedTrainerId?: string`, `suggestedTrainerName?: string`, `rationale?: string`, `riskNote?: string` to `export interface PlaybookAction` (design § 2.2). No behavior change in `generatePlaybook`.
- **Verify:** `npm --prefix web run typecheck` passes (AC-2).
- **Revert:** drop the field additions.

### T2 — RED: domain purity import-scan test (AC-3, Test Plan #9)

- **File (new section in):** `web/src/domain/succession.test.ts`
- **Write first:** a test using Node's `fs` (or `import.meta.url`) that reads `web/src/domain/succession.ts` source and asserts it contains **no** `from "@/ai/` and **no** `from "./ai/` imports. Add `import { readFileSync } from "node:fs"; import { fileURLToPath } from "node:url";` derivation matching existing project conventions; if uncertain, use `vi.mock`-free plain string assertion on the source file path resolved from the test's own module location.
- **Verify RED:** run `npm --prefix web run test -- succession` — the new test fails (no assertion target yet — actually this should pass immediately because the file currently has no `@/ai` imports; treat this as a guarding regression test that locks the current good state). If you write the test correctly it will be GREEN immediately; that is OK — log this in the apply-phase notes as a "lock-in" test, not a strict RED step.
- **Done when:** `npm --prefix web run typecheck && npm --prefix web run test` are green and the test asserts the absence invariant.

### T3 — RED: enrichment happy-path test (AC-6, Test Plan #1)

- **File (new):** `web/src/ai/__tests__/succession-enrichment.test.ts`
- **Write first:** test "enriches per action with detailedSteps/rationale and a grounded trainer, preserves heuristic fields". Build a tiny graph (Pedro masters two knowledge areas; Ada `MASTERS k-1 level=3`). Build the heuristic `Playbook` via `generatePlaybook("person-pedro", graph)`. `vi.spyOn(client, "chatCompletion")` to return a JSON string `{"actions":[{"knowledgeId":"k-crit","detailedSteps":["step A","step B"],"suggestedTrainerName":"Ada","rationale":"critical, undocumented","riskNote":"risk"}]}`. Call `await enrichPlaybookWithLLM(playbook, graph, { llm: { apiKey: "x" } })`. Assert: each action's `detailedSteps.length > 0`, `rationale` non-empty, `suggestedTrainerId === "person-ada"` (graph-grounded), and `priorityScore`/`action`/`targetDate` byte-identical to the input playbook (deep-equal those keys).
- **Verify RED:** `enrichPlaybookWithLLM` does not exist → import fails. Confirm failure.
- **Revert:** delete the test file.

### T4 — GREEN: `enrichPlaybookWithLLM` skeleton + happy path

- **File (new):** `web/src/ai/succession-enrichment.ts`
- **Implement:** `export interface EnrichmentConfig { llm?: LlmConfig; signal?: AbortSignal; }` and the stub `export async function enrichPlaybookWithLLM(playbook, graph, config?): Promise<Playbook>` (design § 2.3, § 5). Make the happy path pass using internal helpers `buildSuccessionSubgraph`, `buildEnrichmentPrompt`, `parseEnrichmentResponse`, `groundTrainer`, `mergeEnrichment` (design § 2.4) — only the helpers needed for the happy path need real bodies; the others can be minimal.
- **Strict rule:** never mutate `playbook.actions[i]`'s `priorityScore`, `action`, `targetDate`, `knowledgeId`, `knowledgeName`, `criticality`, `busFactor`, `documented`. Clone the action objects, copy deterministic fields verbatim, then add enrichment fields.
- **Verify:** `npm --prefix web run typecheck && npm --prefix web run test -- succession-enrichment` — T3 goes green.

### T5 — RED+GREEN: no-LLM-configured returns input unchanged (AC-4, Test #2)

- **Test (in `succession-enrichment.test.ts`):** with `getLlmConfig()` returning `null` (no `configureLlm` call in this test; ensure default config is unset by not calling `configureLlm`, or `vi.spyOn(client, "getLlmConfig").mockReturnValue(null)`) and no `config.llm` passed, `await enrichPlaybookWithLLM(playbook, graph)` returns a playbook deeply equal to the input with **no** enrichment fields set.
- **Implement to green:** fallback ladder gate #1 (design § 2.6). Add the early-return.
- **Verify:** test green; `chatCompletion` must NOT be called (assert the spy was not invoked).

### T6 — RED+GREEN: `chatCompletion` rejects → input unchanged (AC-4, Test #3)

- **Test:** `vi.spyOn(client, "chatCompletion").mockRejectedValue(new Error("network"))`. Pass `config.llm = { apiKey: "x" }` so gate #1 passes; assert the returned playbook is the heuristic-only playbook (deep-equal, no enrichment fields, order preserved).
- **Implement to green:** wrap the `chatCompletion` call in `try/catch`; on throw, return the input playbook unchanged (gate #3).
- **Verify:** test green.

### T7 — RED+GREEN: malformed JSON → input unchanged (AC-4, Test #4)

- **Test:** spy returns `"Sorry, here are some thoughts: ..."`. Assert heuristic-only playbook returned unchanged.
- **Implement to green:** tolerant JSON extraction (`content.match(/\{[\s\S]*"actions"[\s\S]*\}/)`, design § 2.5); when no match, return input unchanged (gate #4). When `JSON.parse` throws, return input unchanged (gate #5). When top-level shape is invalid (no `actions` array), return input unchanged (gate #6).
- **Verify:** test green.

### T8 — RED+GREEN: partial JSON keeps valid actions (AC-4, Test #5)

- **Test:** three-action playbook; spy returns `{"actions":[{"knowledgeId":"k1","detailedSteps":[...],"rationale":"...","suggestedTrainerName":""},{"knowledgeId":"k2","detailedSteps":[...],"rationale":"...","suggestedTrainerName":"Ada"},{"knowledgeId":"k-missing","detailedSteps":"not-an-array"}]}` — third entry is malformed (`detailedSteps` not array, and `knowledgeId` doesn't match any input). Assert: k1 and k2 actions keep `detailedSteps`/`rationale` (and k2 has trainer if grounded); the third action keeps heuristic `action` with no enrichment fields; overall action ORDER and `priorityScore`/`targetDate` unchanged.
- **Implement to green:** per-entry validation in `parseEnrichmentResponse` (gate #7); `mergeEnrichment` walks `playbook.actions` in index order and enriches by `knowledgeId` match; unmatched or invalid entries are skipped (partial fallback invariant, design § 2.6).
- **Verify:** test green.

### T9 — RED+GREEN: ungrounded trainer name is dropped (AC-5, Test #6)

- **Test:** spy returns `{"actions":[{"knowledgeId":"k1","detailedSteps":["s"],"suggestedTrainerName":"Ghost McNotreal","rationale":"...","riskNote":"..."}]}`; graph has no person named "Ghost McNotreal". Assert: `suggestedTrainerId` and `suggestedTrainerName` are **absent** on the merged action; `detailedSteps`, `rationale`, `riskNote` are still present (per design D4 / gate #8 — only the trainer fields drop); `action` is the heuristic string unchanged.
- **Implement to green:** `groundTrainer(suggestedName, candidatesForKnowledge)` returning `null` on no/ambiguous match (design § 2.7 steps 1–4). When `null`, omit `suggestedTrainerId/Name` from the merged action; optionally append a riskNote tail " — no verified internal candidate" if the LLM didn't already mention absence.
- **Verify:** test green.

### T10 — RED+GREEN: subgraph excludes unrelated nodes (AC-7, Test #7)

- **Test:** build a 500-person graph (or 50 + pedro, feasible in unit-test perf terms and still asserting the invariant): Pedro masters 3 knowledge areas; hundreds of unrelated `Person`/`Knowledge` nodes with no edges into those 3. Spy returns a valid enrichment; capture the `user` message string passed to `chatCompletion` (via `vi.fn` capturing args). Assert: the captured prompt content contains the 3 knowledge names and their candidate trainer names, contains Pedro's name, and contains **none** of the unrelated person/knowledge names. Also assert the prompt does NOT enumerate 500 people (e.g. assert the string `.split("\n").length` is bounded < 100).
- **Implement to green:** `buildSuccessionSubgraph(personId, graph)` (design § 2.8) returns the bounded Subgraph; `buildEnrichmentPrompt` serializes only that subgraph.
- **Verify:** test green.

### T11 — RED+GREEN: determinism + internal reorder (AC-10, Test #8)

- **Test (a):** two calls with identical spy response (same JSON string) return deep-equal results. **Test (b):** spy returns `{"actions":[...reversed order...]}`; assert the merged output stays in heuristic `priorityScore` order (i.e. the input playbook's action order), `targetDate` order unchanged.
- **Implement to green:** `mergeEnrichment` always iterates `playbook.actions` in input order and looks up enrichments by `knowledgeId` (NEVER trusts response order). No `Date.now()`/`Math.random()` in the enrichment path.
- **Verify:** both sub-tests green.

### T12 — TRIANGULATE / REFACTOR

- **Do:** review `web/src/ai/succession-enrichment.ts` for shared JSON-extraction logic vs `consultant.ts` (consider extracting `extractJsonObject(content, anchorKey)` if both would benefit — only if it stays under review budget; otherwise keep copies). Tighten the system prompt to forbid reordering and ID invention. Ensure all helpers are file-local (not exported) per design § 5.
- **Verify:** `npm --prefix web run typecheck && npm --prefix web run test` green, no regression in `web/src/domain/succession.test.ts`.

### T13 — AC-1 regression: `generatePlaybook` unchanged

- **Do:** confirm the existing `web/src/domain/succession.test.ts` cases (sole-expert first, exposure ordering, bus-factor fallback, target-date scheduling, undocumented-vs-documented wording, empty playbook) all pass GREEN with no edits to `generatePlaybook`'s body. This is AC-1 + AC-10.
- **Verify:** `npm --prefix web run test -- succession` — every pre-existing case still passes; PR 1 ships.

### T14 — PR 1 merge gate

- **Verify:** `npm --prefix web run typecheck && npm --prefix web run test` full suite green. Open PR 1 (feature branch `feat/succession-enrichment-core`). Do not merge until PR 2's branch is based on it (feature-branch-chain).

---

## PR 2 — Page integration + persistence (AC-8, AC-9)

**Branch:** based on PR 1's branch (feature-branch-chain). Do not start PR 2 work until PR 1 tasks T1–T12 are at least code-complete locally (PR 1 can be in review while PR 2 is implemented against the same merged-down branch).

### T15 — RED: succession page renders enrichment when LLM available (AC-8, page test #1)

- **File (new):** `web/src/app/(app)/succession/page.test.tsx`
- **Frameworks:** vitest + `@testing-library/react` (check `web/package.json` for `@testing-library/react`; if absent, add it in this PR and call it out in the review). `vi.mock("@/components/useGraph")` to return a fixed graph; `vi.mock("@/components/auth/AuthProvider")` to allow `can("mission.create")` true; `vi.mock("@/ai/client")` to make `getLlmConfig()` return `{ apiKey: "x", model: "stub" }` and `vi.spyOn(client, "chatCompletion").mockResolvedValue(<valid JSON>)`. Render the page, select a person, click "Generate plan", await the enrichment, assert `detailedSteps`, `suggestedTrainerName`, `rationale`, `riskNote` text appears in the document.
- **Verify RED:** page does not yet call `enrichPlaybookWithLLM` → test fails.

### T16 — RED: succession page falls back when no LLM (AC-8, page test #2)

- **File (same):** add a second test. `vi.mock("@/ai/client").getLlmConfig` returns `null`. Generate plan; assert heuristic `action` strings and `targetDate` render, no enrichment UI elements appear, no error text is shown (assert `err` paragraph is empty / not in document).
- **Verify RED:** test will fail if the page surfaces an error or if the enrichment UI renders with `undefined`s.

### T17 — GREEN: async `generate` + loading state + enrichment UI

- **File:** `web/src/app/(app)/succession/page.tsx`
- **Edit:**
  - Import `enrichPlaybookWithLLM` and `getLlmConfig` from `@/ai/succession-enrichment` and `@/ai/client`.
  - Convert `generate` to `async`. Inside: call `generatePlaybook(...)`; if `getLlmConfig()` (or pass no config and let enrichment decide) is truthy, set a `loading` state, `await enrichPlaybookWithLLM(playbook, data, {})` inside `try/catch` (on any error, keep the heuristic playbook and do not surface an error to the user), clear `loading`.
  - Render loop: render `detailedSteps` (as an ordered sub-list), `suggestedTrainerName`, `rationale`, `riskNote` only when truthy (`a.detailedSteps?.length`, etc.). Keep the existing heuristic `action`/`criticality`/`busFactor`/`targetDate` display.
  - Show a "Enriching plan…" indicator while `loading` is true.
- **Verify:** T15 and T16 go green; `npm --prefix web run typecheck` green.

### T18 — GREEN: extend `copyMarkdown` export (AC: export enriched)

- **File:** `web/src/app/(app)/succession/page.tsx`
- **Edit:** when an action has `detailedSteps`/`suggestedTrainerName`/`rationale`/`riskNote`, append them under the action line as a nested Markdown bullet/sub-list. Heuristic-only actions render as before.
- **Verify:** add an assertion to the page test (or a focused unit test) that `copyMarkdown` output contains `detailedSteps`, `Suggested trainer`, `Rationale`, `Risk` labels when enrichment is present.

### T19 — Type-only extension: `Mission` + `ActionInput` enrichment fields

- **Files:** `web/src/domain/missions.ts` (add optional `detailedSteps?: string[]`, `suggestedTrainerId?: string`, `suggestedTrainerName?: string`, `rationale?: string`, `riskNote?: string` to `Mission`), `web/src/app/api/missions/route.ts` (extend `ActionInput` with the same optional fields — backward-compatible).
- **Verify:** `npm --prefix web run typecheck` green (AC-2 extends to `Mission`).
- **Revert:** drop the field additions.

### T20 — RED: mission enrichment round-trips through save+reload (AC-9, persistence test #1)

- **File (new):** `web/src/server/missions.test.ts`
- **Approach:** this test needs a DB. Check how other server tests run against Postgres (search for an existing `*.integration.test.ts` — vitest config excludes these from the default `npm run test` run). If the project has a vitest integration test setup, use it; otherwise, write this as a **scenario test against `saveMissions`/`listMissions` with a mocked `createDb()`** (vi.mock `@/db` to return an in-memory store mirroring the real row serialization). Assert: `saveMissions(companyId, personId, [{...with enrichment fields}])` then `listMissions(companyId)` returns a Mission whose `detailedSteps`/`suggestedTrainerName`/`rationale`/`riskNote` survive, AND a heuristic-only mission saves without those fields (returns `Mission` without enrichment keys), AND `companyId` scoping holds (cross-tenant query returns nothing). The tenant-isolation assertion mirrors any existing test.
- **Verify RED:** persistence does not yet round-trip the new fields → test fails.
- **Note:** if an integration test harness is unavailable and an in-memory mock is too brittle, fall back to a focused unit test on `rowToMission`/row mapping alone and mark the DB-level round-trip as an open item for the verify phase; record the choice via `mem_save`.

### T21 — GREEN: schema columns + migration + row mapping

- **Files:** `web/src/db/schema.ts` (add nullable columns `detailedSteps jsonb`, `suggestedTrainerId text`, `suggestedTrainerName text`, `rationale text`, `riskNote text` to the `missions` table — design § 2.10), `web/drizzle/000X_succession_enrichment.sql` (generate via `drizzle-kit generate` so it matches the schema; verify the migration is additive and nullable), `web/src/server/missions.ts` (`saveMissions` accepts and writes the new optional fields — extend the `rows` input type to include them; `rowToMission` maps them back to the `Mission`).
- **Migration-ordering guard (design risk #2):** the migration MUST run before any code that writes the new columns. In apply, run `npm --prefix web run db:migrate` (or `drizzle-kit generate` + migrate) before integration-testing the write path. Document this in the PR 2 description.
- **Verify:** T20 goes green; `npm --prefix web run typecheck` green.
- **Revert:** drop the schema columns, the migration file, and the `rowToMission`/`saveMissions` edits.

### T22 — GREEN: API `POST /api/missions` forwards enrichment

- **File:** `web/src/app/api/missions/route.ts`
- **Edit:** in the `rows` map inside `POST`, pass `detailedSteps: a.detailedSteps` etc. (only when present) onto `saveMissions`. Backward-compatible for heuristic-only callers.
- **Verify:** add (or extend) an API test asserting a POST with `detailedSteps` is accepted and persists; a POST without them still succeeds. `npm --prefix web run typecheck` green.

### T23 — GREEN: page saved-missions list renders enrichment when present

- **File:** `web/src/app/(app)/succession/page.tsx`
- **Edit:** in the saved-missions render loop, render `detailedSteps`/`suggestedTrainerName`/`rationale`/`riskNote` for missions that carry them, conditionally alongside `objective`/`status`/`dueDate`. Heuristic-only missions render as before.
- **Verify:** extend page test (or add a focused one) to render a saved mission with enrichment fields and assert they appear; add its fallback assertion for heuristic-only missions.

### T24 — Full-suite gate (AC-10)

- **Verify:** `npm --prefix web run typecheck && npm --prefix web run test` — full suite green, including pre-existing `succession.test.ts`, `missions`-related tests, and production-readiness. AC-1, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 all covered.
- **Open PR 2** (feature branch `feat/succession-page-persist`) based on PR 1's branch.

---

## Verification matrix (AC ↔ tasks)

| AC | Tasks |
|----|-------|
| AC-1 heuristic backbone | T13 |
| AC-2 types typecheck | T1, T19, T22 |
| AC-3 domain purity / AI-layer export | T2, T4 |
| AC-4 fallback (cases) | T5, T6, T7, T8 |
| AC-5 grounding | T9 |
| AC-6 per-action shape | T3, T4 |
| AC-7 subgraph | T10 |
| AC-8 page integration | T15, T16, T17, T18 |
| AC-9 mission round-trip | T20, T21, T22, T23 |
| AC-10 suite green + determinism | T11, T13, T24 |

## Commands

- `npm --prefix web run typecheck`
- `npm --prefix web run test`
- `npm --prefix web run db:migrate` (PR 2 only, before persistence integration test)

## Rollback boundaries

- PR 1 revertible independently: delete the two new files, revert the type-only additions in `domain/succession.ts` and the import-scan test in `succession.test.ts`.
- PR 2 revertible independently: revert page edits + API + server mapping + page test; for the migration, since columns are nullable and additive, leaving them in place after a revert is safe (no rows reference them); if a clean revert is required, add a `000Y_revert_succession_enrichment.sql` dropping the columns.

## Open items surfaced for the apply phase (no decision needed before apply)

1. Whether `@testing-library/react` is a dependency — confirm and add to PR 2 if missing.
2. Whether a vitest integration-test harness exists for `server/` DB tests — T20 falls back to a mocked-DB unit test if not.
3. Token-budget cap for persons mastering 20+ areas (design risk #4) — out of v1 scope; apply notes it in PR 1 description and does NOT cap.
4. `EnrichmentConfig.signal` — defined for forward-compat, not wired in v1 (design § 8 #5).
