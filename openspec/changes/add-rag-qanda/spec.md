# Spec — add-rag-qanda

> **Domain note:** The proposal has no `Capabilities` section. Affected domains
> are inferred from the in-scope slice: `rag-qanda` (retrieval-augmented Q&A
> endpoint, UI, retrieval backend, citations, graceful degradation) and
> `node-embeddings-store` (schema migration from `jsonb` to `vector(768)` +
> cosine index, backfill). No canonical
> `openspec/specs/{domain}/spec.md` exists for either, so these are full new
> domain specs, not deltas. **Risk:** if the parent intends delta semantics,
> canonical specs must be authored first.

> **Decision resolutions (from proposal "Decision gaps to resolve in spec"):**
>
> 1. **Retrieval top-k:** default `5`, configurable via `RAG_TOP_K` env var
>    (validated to `1..50`); request-level override MAY be ignored in v1.
> 2. **Vector index type:** `hnsw` with `m=16, ef_construction=64`. HNSW is
>    chosen because the dataset size is expected to stay small-to-medium (graph
>    nodes, not documents), recall matters for grounding quality, and memory
>    cost is acceptable at that scale. `ivfflat` would require `lists` tuning
>    per dataset size and degrades when the table is small.
> 3. **Backfill strategy:** eager backfill inside the migration. Existing
>    `node_embeddings` rows already carry the numeric array in `jsonb`; the
>    migration casts `embedding::vector(768)` so no re-embedding call is
>    needed. Rows whose array length ≠ 768 are dropped with a count logged
>    (guard already required at upsert).
> 4. **Chat UI placement:** a dedicated `/chat` page with a minimal input +
>    answer + cited-sources surface. It does **not** extend `GlobalSearch` (out
>    of scope per proposal non-goals) and is not a dashboard widget (kept
>    isolated for v1 reviewability).

## Requirements

### Requirement: pgvector Embedding Column Type

The system MUST store `node_embeddings.embedding` as a pgvector
`vector(768)` column, not `jsonb`, so cosine distance search uses the
pgvector `<=>` operator against an indexed column.

- **R1.1** The Drizzle schema for `node_embeddings.embedding` MUST be declared
  as `vector(768)` (via `vector()` custom type or raw SQL migration).
- **R1.2** A migration MUST convert the existing `embedding` column from
  `jsonb` to `vector(768)`, casting stored numeric arrays as
  `embedding::vector(768)`.
- **R1.3** Rows whose stored array length ≠ 768 MUST be dropped during
  migration, and the count of dropped rows MUST be logged.
- **R1.4** `createPgVectorStore.upsert` MUST reject vectors whose dimension ≠
  768 with a thrown error (dimension-mismatch guard) before writing.
- **R1.5** A `hnsw` index MUST be created on `node_embeddings.embedding` using
  the `vector_cosine_ops` operator class, with `m=16` and
  `ef_construction=64`.

#### Scenario: Migration converts jsonb to vector(768)

- GIVEN a `node_embeddings` table with `embedding` as `jsonb` containing a
  768-length numeric array
- WHEN the migration runs
- THEN the column type becomes `vector(768)` and the row's embedding round-trips
  as a vector readable via `<=>` distance queries.

#### Scenario: Migration drops dimension-mismatched rows

- GIVEN a `node_embeddings` row whose `jsonb` array length is 512
- WHEN the migration runs
- THEN that row is dropped (not coerced, not null-filled), and the migration log
  records the count of dropped rows.

#### Scenario: Upsert rejects wrong-dimension vectors

- GIVEN a `PgVectorStore` backed by a migrated DB
- WHEN `upsert(id, vector512)` is called with a 512-dim vector
- THEN the call throws an error mentioning the expected 768 dimension and does
  not write any row.

#### Scenario: Cosine similarity search uses the index

- GIVEN a migrated `node_embeddings` table with an `hnsw` cosine index and ≥1
  row
- WHEN `search(queryVector768, 5)` runs
- THEN the query uses `<=>` ordering against the indexed column and returns up
  to 5 rows ordered by ascending cosine distance.

### Requirement: Persistent pgvector Retrieval Backend

The system MUST use `createPgVectorStore` as the real retrieval backend for
Q&A, and MUST fall back to the in-memory `VectorStore` only when no DB is
available.

- **R2.1** `createPgVectorStore(db)` MUST run `<=>` cosine distance search
  against the migrated `vector(768)` column (no JSON parsing in the hot path).
- **R2.2** When `db` is absent, `createPgVectorStore(undefined)` MUST return a
  store backed by the in-memory `VectorStore` with the same `upsert` /
  `delete` / `search` / `clear` contract.
- **R2.3** `search` MUST return `SearchResult[]` with `id`, `score`
  (cosine similarity in `[0,1]`, i.e. `1 - distance`), and `metadata`.
- **R2.4** The default `topK` MUST be `5` and MUST be overridable by the
  `RAG_TOP_K` env var, validated to the range `1..50`; an out-of-range value
  MUST fall back to `5` and log a warning.

#### Scenario: DB-backed cosine search

- GIVEN a `PgVectorStore` created with a real `Db` and indexed rows
- WHEN `search(queryVector, topK)` is called
- THEN results come from the pgvector `<=>` query, ordered by similarity
  descending, limited to `topK`.

#### Scenario: In-memory fallback when DB absent

- GIVEN `createPgVectorStore(undefined)`
- WHEN `upsert` then `search` are called
- THEN behavior matches the in-memory `VectorStore` (same contract, no SQL
  executed).

#### Scenario: RAG_TOP_K overrides default

- GIVEN `RAG_TOP_K=12` in the environment
- WHEN the retrieval backend resolves `topK`
- THEN the default used is `12`.
- GIVEN `RAG_TOP_K=999`
- WHEN the retrieval backend resolves `topK`
- THEN the default falls back to `5` and a warning is logged.

### Requirement: RAG Q&A API Route

The system MUST expose a `POST /api/chat` route that embeds the user question,
retrieves top-k node contexts from the pgvector backend, and returns a
generated answer with citations.

- **R3.1** `POST /api/chat` MUST accept a JSON body `{ question: string }` and
  return `{ answer: string, sources: Citation[] }`.
- **R3.2** The route MUST authenticate the caller via `requireApiUser` and
  scope retrieval to the caller's `companyId` (multi-tenant isolation).
- **R3.3** The question MUST be embedded using the existing embeddings client
  (`nomic-embed-text`, 768-dim), with the `simpleEmbed` fallback when the
  embeddings service is unavailable.
- **R3.4** Retrieval MUST query `node_embeddings` joined to `nodes` for the
  caller's `companyId` and return at most `topK` results.
- **R3.5** A citation `Citation` MUST contain `nodeId`, `nodeName`,
  `nodeType`, and `relevance` (cosine similarity in `[0,1]`).
- **R3.6** The generated answer MUST be produced by an LLM call that injects
  the retrieved node contexts into a RAG prompt; the answer MUST NOT make
  ungrounded claims — every factual statement must be traceable to a cited
  source.
- **R3.7** The route MUST return HTTP 400 for an empty or non-string
  `question`, and HTTP 401/403 per `requireApiUser` for unauthenticated or
  unauthorized callers.
- **R3.8** The route MUST respond in under 5 seconds for a graph with ≤1000
  nodes under nominal conditions (guidance, not a hard assertion target for
  unit tests).

#### Scenario: Authenticated grounded answer

- GIVEN an authenticated user in companyA with indexed nodes for companyA
- WHEN `POST /api/chat` is called with `{ question: "Who knows the filler config?" }`
- THEN the response is HTTP 200 with an `answer` string and a non-empty
  `sources` array whose entries reference companyA nodes only.

#### Scenario: Multi-tenant isolation

- GIVEN companyA and companyB each have indexed nodes
- WHEN a companyA user calls `/api/chat`
- THEN `sources` contains only companyA `nodeId`s; no companyB node is
  returned.

#### Scenario: Empty question rejected

- GIVEN an authenticated user
- WHEN `POST /api/chat` is called with `{ question: "" }` or `{ question: "   " }`
- THEN the response is HTTP 400 with an error body and no retrieval is
  performed.

#### Scenario: Unauthenticated rejected

- GIVEN no session
- WHEN `POST /api/chat` is called
- THEN the response is HTTP 401.

#### Scenario: Citations are mandatory

- GIVEN an authenticated user whose graph has ≥1 relevant node
- WHEN `/api/chat` returns an answer
- THEN every factual claim in `answer` corresponds to a `Citation` in
  `sources`; an answer with sources absent or empty is treated as
  "not enough context" (see graceful-degradation requirement).

### Requirement: Graceful Degradation

The system MUST degrade gracefully when the graph is empty, when retrieved
context has low relevance, or when the LLM is unavailable.

- **R4.1** When no embeddings exist for the tenant, the answer MUST be a
  fixed "not enough context yet" message and `sources` MUST be `[]` — the
  system MUST NOT hallucinate an answer.
- **R4.2** When the top retrieved result has `relevance < 0.2`, the answer
  MUST reflect low confidence and include the (low-relevance) cited sources
  rather than fabricating detail.
- **R4.3** When the LLM call throws or `getLlmConfig()` returns null, the
  route MUST return the retrieved contexts as a cited list (answer text
  summarizing the top sources) — matching the existing fallback posture in
  `consultant.ts` / `wiki-generator.ts`.
- **R4.4** When the embeddings service is unavailable, the question MUST be
  embedded via `simpleEmbed` so retrieval still works in-memory-fallback mode.

#### Scenario: Empty graph

- GIVEN an authenticated user whose tenant has zero indexed nodes
- WHEN `/api/chat` is called
- THEN the response is HTTP 200 with `sources: []` and `answer` containing the
  "not enough context yet" message; no LLM call is attempted.

#### Scenario: Low-relevance question

- GIVEN an authenticated user whose top retrieved node has `relevance < 0.2`
- WHEN `/api/chat` is called with a question unrelated to the graph
- THEN the answer explicitly states low confidence and cites the low-relevance
  sources; it does not assert ungrounded facts.

#### Scenario: LLM unavailable

- GIVEN `getLlmConfig()` returns null
- WHEN `/api/chat` is called for a tenant with indexed nodes
- THEN the response is HTTP 200 with `answer` summarizing the top retrieved
  sources and `sources` populated; no unhandled error is thrown.

#### Scenario: Embeddings service unavailable

- GIVEN the Ollama embeddings endpoint is unreachable
- WHEN `/api/chat` is called
- THEN the question is embedded via `simpleEmbed` and retrieval proceeds (in
  in-memory-fallback or DB-backed mode as available).

### Requirement: Minimal Chat UI

The system MUST provide a minimal `/chat` page with a question input, an
answer display, and a cited-sources list.

- **R5.1** A Next.js route `/chat` MUST render a page with a text input, a
  submit control, an answer region, and a sources region.
- **R5.2** Submitting a question MUST call `POST /api/chat` and render the
  returned `answer` and `sources` (each source rendered with `nodeName`,
  `nodeType`, and `relevance`).
- **R5.3** The UI MUST show a loading state while the request is in flight and
  an error state when the request fails.
- **R5.4** The UI MUST NOT stream tokens (v1 returns the full answer) and MUST
  NOT retain conversation history across submissions (single-turn in v1).

#### Scenario: Question submitted, answer rendered

- GIVEN a user navigates to `/chat` while authenticated
- WHEN they type a question and submit
- THEN the answer and cited sources are rendered, each source showing
  `nodeName`, `nodeType`, and `relevance`.

#### Scenario: Loading state

- GIVEN a submitted question with the request in flight
- WHEN the response has not arrived
- THEN the UI shows a loading indicator and the submit control is disabled.

#### Scenario: Error state

- GIVEN a submitted question whose request fails (non-2xx or network error)
- WHEN the response arrives
- THEN the UI shows an error message and allows re-submitting.

### Requirement: RAG Prompt Construction

The system MUST build a RAG prompt that injects retrieved node contexts and
instructs the model to answer only from the provided context with citations.

- **R6.1** A `buildRagPrompt(question, contexts)` helper MUST return
  `ChatMessage[]` (system + user) where the system message instructs the model
  to answer strictly from the provided contexts and to avoid ungrounded
  claims.
- **R6.2** Each injected context MUST include `nodeName`, `nodeType`,
  `relevance`, and a content string built from the node (reusing the
  `buildNodeContent` pattern from `organization-memory.ts`).
- **R6.3** The helper MUST be pure (no network, no DB) so it is unit-testable
  with fixture contexts.

#### Scenario: Prompt contains retrieved contexts

- GIVEN a question and three retrieved node contexts
- WHEN `buildRagPrompt` runs
- THEN the user message contains each context's `nodeName`, `nodeType`, and
  content, and the system message instructs grounding-only answers.

#### Scenario: Pure function

- GIVEN `buildRagPrompt(question, contexts)` is called with fixture inputs
- WHEN no network or DB is available
- THEN it returns the message array without throwing and without side effects.

### Requirement: No Regression to GlobalSearch

The in-memory `OrganizationMemory` search used by `GlobalSearch` MUST continue
to work unchanged.

- **R7.1** The schema migration and `createPgVectorStore` changes MUST NOT
  alter the `OrganizationMemory` class contract or its `search`/`answer`
  behavior.
- **R7.2** Existing `organization-memory` unit tests MUST pass unchanged.

#### Scenario: OrganizationMemory unchanged

- GIVEN the existing `organization-memory.test.ts` suite
- WHEN `npm --prefix web run test` runs
- THEN all `organization-memory` tests pass without modification.

### Requirement: Typecheck Green

`npm --prefix web run typecheck` MUST pass after the schema, retrieval, route,
UI, and prompt changes.

#### Scenario: typecheck green

- WHEN `npm --prefix web run typecheck` runs
- THEN it exits 0 with no new errors.

## Acceptance criteria (numbered, testable)

1. `web/src/db/schema.ts` declares `node_embeddings.embedding` as
   `vector(768)` (no `jsonb`).
2. A Drizzle migration converts `embedding` from `jsonb` to `vector(768)`,
   casting existing arrays and dropping mismatched-dimension rows with a
   logged count.
3. An `hnsw` cosine index (`vector_cosine_ops`, `m=16`, `ef_construction=64`)
   is created on `node_embeddings.embedding`.
4. `createPgVectorStore.upsert` throws on vectors whose dimension ≠ 768.
5. `createPgVectorStore(db).search` uses `<=>` against the `vector(768)`
   column and returns up to `topK` results ordered by similarity.
6. `createPgVectorStore(undefined)` falls back to the in-memory `VectorStore`
   with the same contract.
7. Default `topK` is `5`, overridable by `RAG_TOP_K` (validated to `1..50`,
   out-of-range falls back to `5` with a warning).
8. `POST /api/chat` accepts `{ question }`, returns `{ answer, sources }`,
   and authenticates via `requireApiUser` scoping retrieval to the caller's
   `companyId`.
9. `/api/chat` returns HTTP 400 for empty/whitespace `question`, 401 for no
   session, 403 for unauthorized tenant.
10. `/api/chat` returns `Citation[]` with `nodeId`, `nodeName`, `nodeType`,
    `relevance` for each retrieved source.
11. A tenant-isolation test asserts companyA `/api/chat` never returns
    companyB `nodeId`s.
12. `/api/chat` returns "not enough context yet" with `sources: []` when the
    tenant has zero indexed nodes and does not call the LLM in that case.
13. `/api/chat` returns a low-confidence answer (with cited low-relevance
    sources) when the top result `relevance < 0.2`.
14. `/api/chat` falls back to a cited list when `getLlmConfig()` returns null
    or `chatCompletion` throws (no unhandled error).
15. `/api/chat` falls back to `simpleEmbed` when the Ollama embeddings
    endpoint is unreachable.
16. A `buildRagPrompt(question, contexts)` pure helper exists and is covered
    by unit tests asserting it injects each context and a grounding
    instruction.
17. A `/chat` page renders input + answer + sources, shows loading and error
    states, and does not stream or retain conversation history.
18. Existing `organization-memory` tests pass unchanged (no regression to
    `GlobalSearch`).
19. `npm --prefix web run typecheck` exits 0.
20. `npm --prefix web run test` exits 0 (default suite; integration tests are
    not required to run by default).

## Non-goals

- Document chunk embeddings or general document RAG (v1 retrieves over graph
  node context only).
- Streaming token-by-token responses.
- Multi-turn conversation memory across requests.
- Replacing `GlobalSearch`'s in-memory command palette.
- Configurable per-request `topK` (env-level only in v1).
- Re-embedding existing rows via the embeddings service during migration
  (cast-in-place is sufficient because rows already store numeric arrays).

## Test plan

- **Unit (default `npm --prefix web run test`):**
  - `pgvector-store.test.ts`: upsert dimension-mismatch guard (throws on
    non-768 vector); `search` issues `<=>` ordering (SQL assertion against a
    mock `Db`); in-memory fallback contract; `RAG_TOP_K` resolution
    (default, valid override, out-of-range fallback + warning).
  - `rag-prompt.test.ts`: `buildRagPrompt` injects each context's `nodeName`,
    `nodeType`, content, and a grounding-only system instruction; pure
    (no side effects with fixtures).
  - `chat-route.test.ts` (mocked `requireApiUser`, mocked embeddings, mocked
    `chatCompletion`, mocked `createPgVectorStore`):
    - 400 on empty/whitespace question;
    - 401 on no session, 403 on unauthorized tenant;
    - 200 with `answer` + non-empty `sources` for an authenticated tenant;
    - tenant isolation (companyA query never yields companyB `nodeId`s);
    - empty-graph → "not enough context yet" + `sources: []` and no LLM call
      (`chatCompletion` not invoked);
    - low-relevance (`< 0.2`) → low-confidence answer with cited sources;
    - `getLlmConfig()` null and `chatCompletion` throw → cited-list fallback,
      HTTP 200, no unhandled error;
    - embeddings service unreachable → `simpleEmbed` fallback path used.
  - `chat-page.test.tsx` (happy-dom, mocked `fetch`): renders input + answer +
    sources; loading state disables submit; error state allows re-submit; no
    streaming, no cross-submit history.
  - Existing `organization-memory.test.ts` runs unchanged.
- **Integration (`npm run test:integration`, gated on Docker/
  `TESTCONTAINERS`):**
  - `rag-qanda.integration.test.ts` against a `pgvector/pgvector:pg16`
    container: migration converts `jsonb` → `vector(768)`, drops
    mismatched-dimension rows (count logged), `hnsw` cosine index exists;
    `upsert` + `<=>` `search` round-trips; dimension-mismatch guard throws
    against the real DB; multi-tenant isolation at the DB level (companyA
    cannot retrieve companyB `node_embeddings`).
  - Skips with a recorded reason when `DATABASE_URL`/`TESTCONTAINERS` is
    absent.
- **Static:** `npm --prefix web run typecheck` exits 0.
- **Fixtures:** `web/test-fixtures/llm/rag-*.json` canned LLM responses for
  the chat-route unit tests (grounded answer, low-confidence answer, empty
  context).
- **Gating:** integration suite skips when Docker/`TESTCONTAINERS` is absent;
  default `npm test` never invokes the integration config.

## Open risks

- **Schema migration irreversibility:** converting `jsonb` → `vector(768)`
  is destructive for mismatched-dimension rows. The migration must log the
  dropped count and ship a documented rollback (re-add `jsonb` column, no
  automatic data recovery for dropped rows).
- **HNSW index build time:** on large tables the `hnsw` index build can be
  slow; v1 assumes graph-scale row counts (≤ thousands), so this is
  acceptable. Revisit if document RAG lands.
- **Citation correctness is prompt-dependent:** guaranteeing "no ungrounded
  claims" cannot be fully asserted by unit tests; the spec relies on the
  grounding instruction plus review-time inspection of canned LLM responses.
  A follow-up change could add a citation-coverage heuristic.
- **`RAG_TOP_K` env validation:** the resolved value is computed once at
  module load; tests must set/restore the env deterministically.
