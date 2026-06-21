# Tasks — add-rag-qanda

> **Phase:** SDD tasks (`sdd/add-rag-qanda/tasks`)
> **Spec reference:** `openspec/changes/add-rag-qanda/spec.md` (obs. 143)
> **Design reference:** `openspec/changes/add-rag-qanda/design.md` (obs. 144)
> **Testing:** strict TDD — sequence every code-bearing task as
> RED → GREEN → REFACTOR. Runner: `npm --prefix web run test`.
> Typecheck gate: `npm --prefix web run typecheck`.
> **Convention:** all paths under `web/` unless noted.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1080 (≈530 production + ≈550 tests/fixtures/migration) |
| 400-line budget risk | High (production alone ≈530 > 400; total > 500 review budget) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (schema + pgvector-store + node-content extract) → PR 2 (rag server + `/api/chat` route + chat-route tests) → PR 3 (`/chat` UI + integration test) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

**Rationale:** Production changes (~530 LOC) alone exceed the 400-line risk
threshold and sit just above the 500-line review budget; with tests +
fixtures + the hand-authored migration the total crosses ~1080 LOC. Splitting
into three feature-branch-chain PRs keeps each under ~400 changed lines and
gives every unit an independent revert boundary. PR 1 is a prerequisite for
PRs 2–3 (typed column + extracted helper); PR 2 is a prerequisite for PR 3
(route contract the UI calls). Integration test (`TESTCONTAINERS`-gated) lives
in PR 3 so it never gates PRs 1–2.

## PR 1 — Schema, retrieval backend, node-content extraction

> **Boundary:** DB layer + shared content builder. No HTTP, no UI.
> **Verify:** `npm --prefix web run typecheck` + `npm --prefix web run test`
> (pgvector-store unit suite green; `organization-memory` unchanged green).
> **Rollback:** revert PR + apply `0004` rollback SQL from design §2.4.

### Task 1.1 — RED: vector custom-type round-trip test

Write `web/src/db/vector-type.test.ts` (new) asserting:

- `toDriver(vec768)` returns `"[v1,v2,...]"` literal (no `JSON.stringify`).
- `fromDriver("[0.1,0.2,...]")` and `fromDriver([0.1,0.2,...])` both return
  `number[]` of length 768, numerically equal to the input.
- Round-trip `fromDriver(toDriver(v)) === v` for a fixed 768-vector.
Run `npm --prefix web run test -- vector-type` → expect fail (file missing).
RED marker: the module under test does not exist yet.

### Task 1.2 — GREEN: implement `vector` custom type

Create `web/src/db/vector-type.ts` (new) with the `customType` factory from
design §2.1 (`dataType: "vector(768)"`, `toDriver`, `fromDriver`). Re-run
Task 1.1 test → green.

### Task 1.3 — REFACTOR: schema column swap + migration

- Edit `web/src/db/schema.ts`: replace
  `embedding: jsonb("embedding").$type<number[]>().notNull()` with
  `embedding: vector("embedding").notNull()` and import `vector` from
  `./vector-type`.
- Create `web/drizzle/0004_rag_qanda_vector.sql` (new) per design §2.2:
  `DO $$ ... DELETE ... jsonb_array_length <> 768 ... RAISE NOTICE $$;`
  then `ALTER TABLE ... USING embedding::vector(768);` then
  `CREATE INDEX CONCURRENTLY ... hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);` each on its own
  `--> statement-breakpoint` segment. Document rollback in the header.
- Run `npm --prefix web run typecheck` → must stay green (schema compiles).
No unit test for the migration itself (covered by integration test, PR 3).

### Task 1.4 — RED: pgvector-store unit tests (dim guard, `<=>` SQL, fallback, topK)

Create `web/src/ai/pgvector-store.test.ts` (new) asserting:

- `upsert(id, vec512)` throws `Error` mentioning `768` and does not call
  `db.insert` (use a mock `Db` with `vi.fn()`).
- `upsert(id, vec768)` calls `db.insert` with `embedding` as the
  `[v1,...]` literal (no `JSON.stringify`).
- `search(vec, 5)` issues SQL containing `<=>`, `ORDER BY ... <=>`, the
  `JOIN nodes n ON n.id = ne.node_id` clause, `n.company_id =`, and
  `LIMIT` equal to `topK * 4` (over-fetch). Capture via mock `db.execute`.
- `createPgVectorStore(undefined)` returns a store whose `upsert`/`search`
  match the in-memory `VectorStore` contract (no SQL executed).
- `createPgVectorStore(undefined).upsert(id, vec512)` **also** throws
  (dim guard applies to fallback path).
- `RAG_TOP_K` resolution: default `5`; `RAG_TOP_K=12` → 12;
  `RAG_TOP_K=999` → 5 with `console.warn` called. Use
  `vi.resetModules()` + dynamic `import()` to re-resolve per case; restore
  `process.env` in `afterEach`.
Run `npm --prefix web run test -- pgvector-store` → expect fail.

### Task 1.5 — GREEN: update `pgvector-store.ts`

Edit `web/src/ai/pgvector-store.ts`:

- Add `resolveTopK()` + `DEFAULT_TOP_K` module-load resolution (design §3.4).
- Extract `toVectorLiteral(v: number[]): string` returning `[${v.join(",")}]`;
  use it in both `upsert` (driver values) and `search` (`${lit}::vector`).
- Add dimension guard `if (vector.length !== 768) throw ...` at the top of
  **both** the DB `upsert` and the fallback `upsert` paths.
- Rewrite `search` to the design §3.2 query shape: select from
  `node_embeddings ne JOIN nodes n ON n.id = ne.node_id`
  `WHERE n.company_id = $companyId`, `ORDER BY ne.embedding <=> $q`,
  `LIMIT $topK * 4`. Score = `1 - (embedding <=> $q)` clamped to `[0,1]`.
  Accept an additional `companyId` parameter on `search` (extend
  `PgVectorStore.search` signature; fallback path ignores it but still
  returns full results so the JS `assertTenant` filter applies).
- Remove `JSON.stringify(vector)` calls.
Re-run Task 1.4 test → green.

### Task 1.6 — RED: assert `organization-memory` still green (regression baseline)

Run `npm --prefix web run test -- organization-memory` and record the pass
count. (No new test file — this task establishes the R7 baseline before the
extract refactor.)

### Task 1.7 — REFACTOR: extract `buildNodeContent` to shared module

- Create `web/src/ai/node-content.ts` (new) with `export function
  buildNodeContent(...)` byte-identical to the current private function in
  `organization-memory.ts` (signature, body, output unchanged).
- Edit `web/src/ai/organization-memory.ts`: delete the local
  `buildNodeContent`, import from `./node-content`, keep the call site at
  line 55 unchanged.
- Re-run `organization-memory` tests (Task 1.6) → must still pass without
  modification (R7.1, R7.2, AC-18).
- Run `npm --prefix web run typecheck` → green.

### Task 1.8 — PR 1 gate

Run `npm --prefix web run typecheck` and `npm --prefix web run test`.
Both must exit 0. No staged files beyond PR 1 scope. Open PR 1.

## PR 2 — RAG server modules + `/api/chat` route

> **Boundary:** server-side RAG pipeline + route. Depends on PR 1 (typed
> column, extracted `buildNodeContent`, `createPgVectorStore.search` with
> `companyId`).
> **Verify:** typecheck + `route.test.ts` + `rag-prompt.test.ts` green.
> **Rollback:** revert PR (route is additive; no schema impact).

### Task 2.1 — RED: `rag-prompt.test.ts`

Create `web/src/server/rag/rag-prompt.test.ts` (new) asserting on
`buildRagPrompt(question, contexts, opts)`:

- Returns `[{role:"system"},{role:"user"}]` (length 2).
- The user message contains every context's `nodeName`, `nodeType`,
  `relevance` (rounded percent), and `content` string.
- The system message contains the grounding instruction ("answer ONLY",
  "do not invent", cite by source number, "I don't have enough context").
- With `opts.lowConfidence === true`, the system message contains a
  low-confidence instruction; without it, it does not.
- Purity: call twice with the same fixtures → deep-equal outputs; no
  observable side effects (no `fetch`, no `console`, no `Date.now` mocked).
Run test → expect fail (module missing).

### Task 2.2 — GREEN: `rag-prompt.ts` + `citations.ts`

- Create `web/src/server/rag/rag-prompt.ts` (new) with `RetrievedContext`
  type and `buildRagPrompt` per design §5 (pure, no imports of network/DB).
- Create `web/src/server/rag/citations.ts` (new) with `Citation` type and
  `toCitation(ctx)` mapping `{ nodeId, nodeName, nodeType, relevance }`
  (clamp `relevance` to `[0,1]`).
Re-run Task 2.1 → green.

### Task 2.3 — RED: `retrieve.ts` tests

Create `web/src/server/rag/retrieve.test.ts` (new) mocking `embed`,
`getDb`, `createPgVectorStore`, and the `nodes` lookup. Assert:

- `retrieveContexts(companyId, question)` calls `embed(question)`, then
  `store.search(vec, DEFAULT_TOP_K, companyId)`, then enriches via a single
  `SELECT id, name, type, company_id FROM nodes WHERE id = ANY($1)`.
- `enrichAndFilter` drops any result whose `company_id !== companyId`
  (tenant isolation in the fallback path) and attaches `nodeName`/`nodeType`.
- Returns `RetrievedContext[]` with `content` built via `buildNodeContent`.
- `assertTenant` helper throws (or filters) when a cross-tenant node
  slips through.
Run test → expect fail.

### Task 2.4 — GREEN: `retrieve.ts`

Create `web/src/server/rag/retrieve.ts` (new) with `retrieveContexts` +
`enrichAndFilter` + `assertTenant` per design §4.3. Use the shared
`buildNodeContent` from `web/src/ai/node-content.ts`. Re-run Task 2.3 →
green.

### Task 2.5 — RED: `route.test.ts` (full fallback matrix)

Create `web/src/app/api/chat/route.test.ts` (new) with `vi.mock` for
`requireApiUser`, `embed`, `createPgVectorStore` (via `retrieveContexts`),
`getLlmConfig`, `chatCompletion`. Add canned fixtures under
`web/test-fixtures/llm/rag-grounded.json`, `rag-low-confidence.json`,
`rag-empty.json`. Assert each scenario from the spec test plan:

- 400 on `{ question: "" }` and `{ question: "   " }`; no retrieval called.
- 401 when `requireApiUser` returns a 401 `NextResponse`.
- 403 when `requireApiUser(op, companyId)` returns a 403.
- 200 with `answer` + non-empty `sources` for an authenticated tenant.
- Tenant isolation: companyA query yields only companyA `nodeId`s; a
  companyB `nodeId` in the mock results is filtered out.
- Empty graph (`retrieveContexts` returns `[]`) → 200
  `"Not enough context yet."`, `sources: []`, **`chatCompletion` never
  called** (assert `not.toHaveBeenCalled()`).
- Low-relevance (top `relevance < 0.2`) → 200 with cited sources and a
  low-confidence answer (canned fixture).
- `getLlmConfig()` returns null → 200 with `citedListFallback` summary
  - `sources` populated; no `chatCompletion` call.
- `chatCompletion` throws → 200 with `citedListFallback`; no unhandled
  rejection.
- Embeddings service unreachable → `embed` returns the `simpleEmbed` vector
  (mock `embed` to simulate the internal fallback) and retrieval proceeds.
Run test → expect fail (route missing).

### Task 2.6 — GREEN: `route.ts`

Create `web/src/app/api/chat/route.ts` (new) implementing the design §4.2
flow: `requireApiUser` → validate question → `retrieveContexts` →
empty-graph short-circuit → `lowConfidence` flag → `getLlmConfig` null
check → `try { chatCompletion(buildRagPrompt(...)) } catch {
citedListFallback }` → `NextResponse.json({ answer, sources })`. Single
`try/catch` around `chatCompletion` only (design D10). Implement
`citedListFallback(contexts, lowConfidence)` in `retrieve.ts` or
`citations.ts`. Re-run Task 2.5 → green.

### Task 2.7 — REFACTOR: extract `citedListFallback` + prompt low-conf branch

Review `route.ts` for any duplicated logic; move `citedListFallback` into
`web/src/server/rag/citations.ts` if it grew in the route. Ensure the
low-confidence prompt flag flows from route → `buildRagPrompt` and is
covered by Task 2.1's assertion. Re-run all PR 2 tests + typecheck →
green.

### Task 2.8 — PR 2 gate

Run `npm --prefix web run typecheck` and `npm --prefix web run test`.
Both must exit 0. Open PR 2 (depends on PR 1 branch).

## PR 3 — `/chat` UI + integration test

> **Boundary:** client UI + DB-gated integration test. Depends on PR 2
> (`/api/chat` contract).
> **Verify:** typecheck + `chat-client.test.tsx` green; integration test
> skips cleanly when `TESTCONTAINERS !== "1"`.
> **Rollback:** revert PR (UI is additive; integration test is opt-in).

### Task 3.1 — RED: `chat-client.test.tsx`

Create `web/src/app/chat/chat-client.test.tsx` (new) with `happy-dom` +
mocked global `fetch`. Assert:

- Renders a text input, a submit control, an answer region, a sources
  region (initially empty/hidden).
- Submitting a question calls `fetch("/api/chat", { method: "POST", body:
  JSON.stringify({ question }) })`; on 200 with `{ answer, sources }`,
  renders `answer` and each source's `nodeName`, `nodeType`, `relevance`.
- While the request is in flight: submit control is disabled, a loading
  indicator is shown, prior answer is preserved.
- On non-2xx (mock `res.ok === false`): an error message renders and
  submit is re-enabled (re-submit allowed).
- Submitting a second question does **not** retain the first answer
  (no message history; single-turn).
- No streaming API is used (assert `fetch` is called once per submit and
  no `ReadableStream`/`EventSource` is referenced).
Run test → expect fail.

### Task 3.2 — GREEN: `page.tsx` + `chat-client.tsx`

- Create `web/src/app/chat/page.tsx` (new) server shell: call
  `getCurrentUser()`; if absent, `redirect("/api/auth/signin")` (match the
  existing protected-route pattern). Otherwise render `<ChatClient />`.
- Create `web/src/app/chat/chat-client.tsx` (new) per design §6.2: `useState`
  for `question`, `answer`, `sources`, `status`; `onSubmit` → `fetch` →
  set state; render input + submit (disabled while `loading`) + answer +
  sources list. No streaming, no history array.
Re-run Task 3.1 → green.

### Task 3.3 — RED: integration test scaffold

Create `web/src/db/integration/rag-qanda.integration.test.ts` (new) gated
on `process.env.TESTCONTAINERS === "1"` (`describe.skip` otherwise with a
recorded reason). Against a `pgvector/pgvector:pg16` testcontainer:

- Apply `web/drizzle/0004_rag_qanda_vector.sql`.
- Assert `information_schema.columns` reports `vector(768)` for
  `node_embeddings.embedding`.
- Assert `pg_indexes` row for `node_embeddings_embedding_hnsw_idx` with
  `hnsw` + `vector_cosine_ops`.
- Seed a 768-dim row + a 512-dim row → after migration only the 768 row
  remains; capture `RAISE NOTICE` dropped count (or query count before/after).
- `upsert(id, vec512)` throws against the real DB (dim guard).
- `upsert + search` round-trip returns the seeded row via `<=>`.
- Tenant isolation at DB level: companyA `nodes`+`node_embeddings` rows
  are not returned by a companyB-scoped `search`.
Run with `TESTCONTAINERS=1` if Docker available → expect fail (or skip
cleanly if not, recording the skip reason).

### Task 3.4 — GREEN: make integration test pass (or confirm clean skip)

If Docker is available locally, run
`TESTCONTAINERS=1 npm --prefix web run test -- rag-qanda.integration` and
fix until green. If Docker is unavailable, assert the suite **skips with a
recorded reason** and does not error the default run. Default
`npm --prefix web run test` must still exit 0 (AC-20).

### Task 3.5 — PR 3 gate + final full gate

- Run `npm --prefix web run typecheck` → exit 0 (AC-19).
- Run `npm --prefix web run test` → exit 0 (AC-20).
- Confirm `organization-memory.test.ts` still passes unchanged (AC-18).
- Confirm no staged files outside PR 3 scope. Open PR 3 (depends on PR 2).

## Cross-cutting tasks (parallel-safe once prerequisites met)

### Task X.1 — Canned LLM fixtures

Author `web/test-fixtures/llm/rag-grounded.json`,
`rag-low-confidence.json`, `rag-empty.json` with reviewed, citation-covered
responses. Used by Task 2.5. Review-time check: every factual claim in the
grounded fixture maps to a numbered source in the prompt context block
(spec open-risk mitigation).

### Task X.2 — Rollback documentation

Ensure the rollback SQL block from design §2.4 is present in the
`0004_*.sql` header comment (covered by Task 1.3) and referenced in the
PR 1 description. No code change.

## Notes for the parent / apply phase

- **Strict TDD:** every code task above is RED before GREEN. The migration
  SQL (Task 1.3) and the rollback doc (Task X.2) are not unit-tested in PR 1
  — they are covered by the integration test in PR 3 (Task 3.3).
- **Budget guard:** if any PR exceeds ~400 changed lines at apply time, the
  apply phase MUST pause and re-split before opening the next PR
  (per `protect_review_workload: true`, review budget 500).
- **No child subagents:** this is the task list only; the parent owns
  delegation of the apply phase.
