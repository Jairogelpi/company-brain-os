# Design — add-rag-qanda

> **Phase:** SDD design (`sdd/add-rag-qanda/design`)
> **Spec reference:** `openspec/changes/add-rag-qanda/spec.md` (obs. 143)
> **Scope anchor:** `packages/coding-agent` is N/A — this change targets the
> `web/` Next.js app (the only product surface for Company Brain OS). All file
> paths below are relative to `web/` unless noted.
> **`require_tradeoffs`:** true — every major decision records its tradeoff.

## 1. Overview

The change converts `node_embeddings.embedding` from `jsonb` to a real
pgvector `vector(768)` column with an HNSW cosine index, makes
`createPgVectorStore` the real retrieval backend (in-memory fallback when DB
absent), adds a `POST /api/chat` RAG route (embed → retrieve → grounded
generate with citations), and a minimal `/chat` page. It degrades gracefully
at every layer (empty graph, low relevance, LLM down, embeddings service
down).

The design is organized around five technical sub-problems, each with an
approach and a tradeoff section:

1. Schema & migration: `jsonb → vector(768)` + HNSW index + backfill.
2. Retrieval backend: `createPgVectorStore` + multi-tenant isolation.
3. RAG API route: `POST /api/chat` flow + fallbacks.
4. RAG prompt construction: `buildRagPrompt` helper.
5. UI surface: `/chat` page.

---

## 2. Schema & Migration

### 2.1 Drizzle custom type for `vector(768)`

`drizzle-orm@0.45.2` does **not** ship a pgvector column type. Two viable
approaches:

| Option | Description | Verdict |
| --- | --- | --- |
| **A. `customType` factory** | Register a `vector(dim)` custom type via `drizzle-orm`'s `customType({ dataType, toDriver, fromDriver })`. Schema declares `embedding: vector(768)`. | **Chosen.** |
| B. Raw SQL only | Keep schema as `text`/`jsonb`, author migration SQL by hand, rely on raw `db.execute(sql\`...\`)` everywhere. | Rejected — loses type safety, and `createPgVectorStore.upsert` already uses the Drizzle query builder against `nodeEmbeddings`, which requires a typed column. |

**New file:** `web/src/db/vector-type.ts`

```ts
import { customType } from "drizzle-orm";

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return "vector(768)"; },
  toDriver(value: number[]): string { return `[${value.join(",")}]`; },
  // pgvector returns a string like "[0.1,0.2,...]"; parse to number[].
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) return value as number[];
    return JSON.parse(String(value).replace(/[\[\]]/g, "").trim()
      ? `[${String(value).replace(/^\[/, "").replace(/\]$/, "")}]`)
      .map(Number);
  },
});
```

**Schema change** (`web/src/db/schema.ts`):

```ts
- embedding: jsonb("embedding").$type<number[]>().notNull(),
+ embedding: vector("embedding").notNull(),
```

**Tradeoff (Option A):** `customType` requires correct `toDriver`/`fromDriver`
serialization, and the round-trip parse is a hand-written edge case. Risk: a
malformed vector string from pgquery could throw at the driver boundary. We
mitigate with a unit test that round-trips a 768-vector through
`toDriver` → `fromDriver`. The alternative (raw SQL everywhere) would force a
rewrite of the existing `createPgVectorStore.upsert` builder path and lose
Drizzle's type inference on `nodeEmbeddings.embedding`.

### 2.2 Migration file

Drizzle migrations live as numbered SQL files in `web/drizzle/` and are
applied via `drizzle-kit push` (integration) or `drizzle-kit generate` +
manual apply. `drizzle-kit generate` will produce a naive
`ALTER TABLE ... ALTER COLUMN embedding TYPE vector(768)` that **fails** on
non-castable rows and does **not** drop dimension-mismatched rows or build the
HNSW index. So the migration is **hand-authored** and prefixed above the next
generated number.

**New file:** `web/drizzle/0004_rag_qanda_vector.sql`

```sql
-- 0004_rag_qanda_vector.sql
-- Convert node_embeddings.embedding from jsonb to vector(768) + HNSW cosine index.
-- Destructive for mismatched-dimension rows; see design §2.4 for rollback.

-- 1. Drop rows whose jsonb array length != 768, logging the count.
DO $$
DECLARE
  dropped_count integer;
BEGIN
  DELETE FROM node_embeddings
  WHERE jsonb_array_length(embedding) <> 768;
  GET DIAGNOSTICS dropped_count = ROW_COUNT;
  RAISE NOTICE 'add-rag-qanda: dropped % node_embeddings rows with dim != 768', dropped_count;
END$$;

-- 2. Cast the column in place. jsonb numeric arrays cast cleanly to vector(768).
ALTER TABLE node_embeddings
  ALTER COLUMN embedding TYPE vector(768)
  USING (embedding::vector(768));

-- 3. HNSW cosine index, built CONCURRENTLY to avoid blocking writes.
--    m=16, ef_construction=64 per spec decision resolution #2.
CREATE INDEX CONCURRENTLY IF NOT EXISTS node_embeddings_embedding_hnsw_idx
  ON node_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Tradeoff (CONCURRENTLY vs plain `CREATE INDEX`):** `CONCURRENTLY` does not
lock the table for writes during the build and is safe for production. It
cannot run inside a transaction block — Drizzle applies each
`statement-breakpoint` segment separately, so the index creation must be its
own segment (which the `--> statement-breakpoint` separator enforces). The
downside: if `CONCURRENTLY` fails partway, it leaves an **invalid** index that
must be dropped manually before retry. We accept this risk because the
alternative (blocking build) freezes writes for the duration, and at v1 scale
(thousands of rows) the build is sub-second anyway.

**Tradeoff (in-place cast vs dump/reload):** Casting `jsonb::vector(768)`
works because pgvector accepts a Postgres array literal or a JSON array. No
re-embedding call is needed (spec decision resolution #3). The risk is rows
whose `jsonb` payload is not a flat numeric array (e.g. nested, or contains
strings) — the `DELETE ... WHERE jsonb_array_length(embedding) <> 768` guard
catches length mismatches, and the `ALTER ... USING embedding::vector(768)`
will throw on non-numeric elements, failing the migration loudly rather than
silently corrupting data. A pre-flight `SELECT count(*) FROM node_embeddings
WHERE ...` smoke check is documented in the migration header comment for
operators to run before applying.

### 2.3 Index parameters

`m=16, ef_construction=64` are pgvector HNSW defaults for small-to-medium
datasets. At v1 scale (graph nodes, not documents; expected ≤ thousands of
rows) the build time is sub-second and memory overhead is negligible (~1KB
per row for the graph layer).

**Tradeoff (HNSW vs ivfflat):** HNSW has no `lists`-tuning dependency on
dataset size, gives better recall at low row counts (where ivfflat's
inverted lists are nearly empty and recall collapses), and supports efficient
incremental inserts — important because `upsert` is called on every node
ingest. ivfflat would require `lists = rows/100` re-tuning as the graph grows
and needs `CREATE INDEX` after a bulk load to be effective. We pay a higher
constant memory cost (~2x ivfflat) which is acceptable at v1 scale; revisit if
document RAG (millions of rows) lands.

### 2.4 Rollback

The migration is **destructive for dropped mismatched-dimension rows** and
**non-reversible** for those rows. Documented rollback (operator-run, not
automatic):

```sql
-- Rollback 0004 (loses rows dropped in step 1; no automatic recovery).
DROP INDEX CONCURRENTLY IF EXISTS node_embeddings_embedding_hnsw_idx;
ALTER TABLE node_embeddings
  ALTER COLUMN embedding TYPE jsonb
  USING (to_jsonb(embedding));
-- Re-add the original btree-only node_id index is already present.
```

**Tradeoff (no automatic rollback):** Auto-recovery of dropped rows would
require a pre-migration `CREATE TABLE node_embeddings_backup AS SELECT * FROM
node_embeddings;`, doubling storage and complicating the migration. Per spec
open-risk language, we instead **log the dropped count** (already in the
migration's `RAISE NOTICE`) and document the manual backup command in the
migration header for operators who want a safety net:

```sql
-- Optional pre-flight backup (operator-run, not in the migration):
-- CREATE TABLE node_embeddings_pre_rag_backup AS SELECT * FROM node_embeddings;
```

---

## 3. Retrieval Backend (`createPgVectorStore`)

### 3.1 Schema-driven typed column

`web/src/ai/pgvector-store.ts` already issues a raw `<=>` query via
`db.execute(sql\`...\`)`. With the column now typed`vector(768)`, the
existing query works unchanged **except** for two fixes:

1. **Dimension guard in `upsert`** (R1.4): add a pre-write length check that
   throws before hitting the DB:

   ```ts
   async upsert(id, vector, metadata) {
     if (vector.length !== 768) {
       throw new Error(
         `PgVectorStore.upsert: expected 768-dim vector, got ${vector.length}`,
       );
     }
     // ... existing insert/onConflict path, embedding now goes through the
     // customType toDriver (produces "[v1,v2,...]") rather than JSON.stringify.
   }
   ```

2. **`toDriver` serialization:** remove the manual `JSON.stringify(vector)`
   calls; the `customType` handles `[v1,...]` literal formatting that
   pgvector expects. The `search` query's `${vectorStr}::vector` cast must
   switch from `JSON.stringify(queryVector)` to the same `[...]` literal
   (extract a small `toVectorLiteral(v: number[]): string` helper to share
   between upsert-driven and query-driven paths).

### 3.2 Multi-tenant isolation

`node_embeddings` has **no `company_id` column**; tenancy lives on `nodes`
(`nodes.company_id`, indexed by `nodes_company_idx`). Retrieval must scope to
the caller's `companyId` (R3.2, R3.4, AC-11).

Two approaches:

| Option | Query shape | Verdict |
| --- | --- | --- |
| **A. Join + over-fetch + filter** | `SELECT ne.node_id, ... FROM node_embeddings ne JOIN nodes n ON n.id = ne.node_id WHERE n.company_id = $1 ORDER BY ne.embedding <=> $q LIMIT $topK` | **Chosen for v1.** |
| B. Denormalize `company_id` onto `node_embeddings` + partial HNSW index per tenant | `ALTER TABLE node_embeddings ADD COLUMN company_id ...; CREATE INDEX ... WHERE company_id = $1` per tenant | Rejected for v1 — scope creep, N partial indexes, and pgvector partial HNSW indexes are awkward. Revisit if a tenant grows large enough that the global-index + filter plan degrades. |

**Tradeoff (Option A — global HNSW + post-filter):** HNSW cannot pre-filter
efficiently; the planner scans the global index and filters by `company_id`
after retrieval. For a small topK against a multi-tenant table this means we
may fetch more candidates than needed before the filter prunes. At v1 scale
(small per-tenant graphs) this is fine. To bound worst-case behavior we
over-fetch `topK * 4` candidates inside the SQL `ORDER BY ... LIMIT`, then
take the first `topK` after the join filter — this is invisible to callers
because the `LIMIT` in the SQL is the over-fetch cap and the JS layer slices
to `topK`. If a single tenant's share of the global table is small, the
over-fetch is wasted work; if it is dominant, the over-fetch is a no-op. We
accept the constant-factor cost and document the threshold at which to
migrate to Option B (per-tenant partial index): "when any tenant exceeds
~50k nodes, add `company_id` to `node_embeddings` and a per-tenant partial
HNSW index."

### 3.3 `search` result shape (R2.3)

`SearchResult` already carries `{ id, score, metadata }`. The route will
enrich `metadata` with `nodeName`, `nodeType`, `companyId` by joining
`nodes` in the retrieval query (single round-trip), so the citation builder
does not need a second `nodes` lookup. The `score` is `1 - cosine_distance`
(clip to `[0,1]` to defend against float drift).

### 3.4 `RAG_TOP_K` resolution (R2.4)

```ts
function resolveTopK(): number {
  const raw = process.env.RAG_TOP_K;
  if (raw === undefined || raw === "") return 5;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    console.warn(`RAG_TOP_K="${raw}" out of range (1..50); falling back to 5`);
    return 5;
  }
  return n;
}
const DEFAULT_TOP_K = resolveTopK();
```

**Tradeoff (module-load resolution vs per-call):** Resolving once at module
load is cheap and matches the spec's open-risk note ("computed once at module
load; tests must set/restore the env deterministically"). Per-call resolution
would allow runtime overrides but adds env-reading in the hot path and
complicates caching. We choose module-load resolution; tests use
`vi.resetModules()` + dynamic `import()` to re-resolve with a stubbed env.

### 3.5 In-memory fallback (R2.2)

Unchanged: `createPgVectorStore(undefined)` returns the existing
`VectorStore`-backed adapter. The only addition is the dimension guard is
**also** applied in the fallback path (so behavior matches the DB path for
R1.4 in tests that don't spin up Postgres).

---

## 4. RAG API Route — `POST /api/chat`

### 4.1 File layout

```
web/src/app/api/chat/route.ts          # POST handler
web/src/server/rag/rag-prompt.ts       # buildRagPrompt (pure, R6)
web/src/server/rag/citations.ts        # Citation type + builder
web/src/server/rag/retrieve.ts         # embed → retrieve → contexts pipeline
```

The route is thin; orchestration lives in `server/rag/` so it is unit-testable
without spinning up a Next.js request context (the route handler is covered
by `chat-route.test.ts` with a mocked `requireApiUser`).

### 4.2 Route flow

```ts
// web/src/app/api/chat/route.ts
export async function POST(request: Request) {
  const user = await requireApiUser();           // 401 if no session
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const contexts = await retrieveContexts(user.companyId, question);
  if (contexts.length === 0) {
    return NextResponse.json({
      answer: "Not enough context yet.",
      sources: [],
    });
  }

  // Low-relevance: still answer, but flag low confidence (R4.2).
  const lowConfidence = contexts[0].relevance < 0.2;

  const llmConfig = getLlmConfig();
  let answer: string;
  if (!llmConfig) {
    answer = citedListFallback(contexts, lowConfidence);   // R4.3
  } else {
    try {
      const messages = buildRagPrompt(question, contexts, { lowConfidence });
      answer = await chatCompletion(messages, llmConfig);
    } catch (err) {
      answer = citedListFallback(contexts, lowConfidence); // R4.3
    }
  }

  return NextResponse.json({
    answer,
    sources: contexts.map(toCitation),
  });
}
```

### 4.3 Retrieval pipeline (`retrieve.ts`)

```ts
export async function retrieveContexts(
  companyId: string,
  question: string,
): Promise<RetrievedContext[]> {
  const queryVector = await embed(question);  // R3.3, R4.4 (embed() already falls back to simpleEmbed)
  const store = createPgVectorStore(getDb());  // getDb() may be undefined → in-memory fallback
  const results = await store.search(queryVector, DEFAULT_TOP_K);
  // Enrich with nodeName/nodeType via the nodes table; filter by companyId.
  return enrichAndFilter(results, companyId);
}
```

`enrichAndFilter` does a single `SELECT id, name, type, company_id FROM nodes
WHERE id = ANY($1)` and (a) drops results whose `company_id !== companyId`
(defense-in-depth even though the SQL join already filters — the in-memory
fallback path has no join, so this is the actual isolation mechanism for
fallback mode), and (b) attaches `nodeName`/`nodeType` to `metadata`.

**Tradeoff (isolation in SQL vs in JS):** The DB-backed path filters in SQL
(§3.2). The in-memory fallback path has no SQL filter available, so we filter
in JS after enrichment. This duplicates the isolation logic across two paths.
The alternative — always filter in JS — would let the DB path over-retrieve
unboundedly (no `LIMIT`-effective filter). We choose SQL-filter for DB path
and JS-filter for fallback path, with a shared `assertTenant(results,
companyId)` helper called in **both** paths as a belt-and-suspenders check
(the DB path's JS filter is a no-op in normal operation but catches any future
regression in the SQL join).

### 4.4 Fallbacks matrix

| Condition | Detection | Behavior | Spec ref |
| --- | --- | --- | --- |
| Empty question | `!question.trim()` | HTTP 400, no retrieval | R3.7, AC-9 |
| No session | `requireApiUser` returns `NextResponse(401)` | HTTP 401 | R3.7, AC-9 |
| Unauthorized tenant | `requireApiUser(op, companyId)` 403 | HTTP 403 | R3.7, AC-9 |
| Zero indexed nodes for tenant | `contexts.length === 0` | HTTP 200, `"Not enough context yet."`, `sources: []`, **no LLM call** | R4.1, AC-12 |
| Top relevance `< 0.2` | `contexts[0].relevance < 0.2` | LLM is called with a `lowConfidence: true` prompt flag; answer must reflect low confidence | R4.2, AC-13 |
| `getLlmConfig()` null | checked before LLM call | `citedListFallback(contexts)` — summarizing answer + `sources` populated; HTTP 200 | R4.3, AC-14 |
| `chatCompletion` throws | `try/catch` around the call | same `citedListFallback`; HTTP 200; no unhandled error | R4.3, AC-14 |
| Ollama embeddings down | `embed()` already falls back to `simpleEmbed` internally | retrieval proceeds with `simpleEmbed` 768-dim vector | R4.4, AC-15 |
| DB absent | `getDb()` returns `undefined` | `createPgVectorStore(undefined)` → in-memory `VectorStore` | R2.2, AC-6 |

**Tradeoff (single `try/catch` vs layered error handling):** We use a single
`try/catch` around `chatCompletion` only — retrieval and embedding failures
propagate as 500s because they are not in the spec's graceful-degradation
contract (the spec lists LLM-unavailable and embeddings-service-unavailable,
not "DB totally down mid-request"). A broader `try/catch` would mask real
bugs as 200s. The embeddings fallback is handled **inside** `embed()` (already
ships today), so it never reaches the route's error path.

### 4.5 Citation type (R3.5)

```ts
// web/src/server/rag/citations.ts
export type Citation = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  relevance: number;  // cosine similarity in [0,1]
};
```

`relevance` is clamped to `[0,1]` at the boundary to absorb float drift from
`1 - distance`.

---

## 5. RAG Prompt Construction (`buildRagPrompt`, R6)

```ts
// web/src/server/rag/rag-prompt.ts  (pure, no network/DB)
export type RetrievedContext = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  relevance: number;
  content: string;  // built from the node via buildNodeContent pattern
};

export function buildRagPrompt(
  question: string,
  contexts: RetrievedContext[],
  opts: { lowConfidence?: boolean } = {},
): ChatMessage[] {
  const contextBlock = contexts
    .map((c, i) =>
      `[${i + 1}] ${c.nodeName} (${c.nodeType}) — relevance ${Math.round(c.relevance * 100)}%\n${c.content}`)
    .join("\n\n");

  const system =
    `You are answering strictly from the provided context about the user's organization. ` +
    `Rules:\n` +
    `1. Answer ONLY using facts present in the context blocks below. ` +
    `2. Do not invent, extrapolate, or rely on prior knowledge. ` +
    `3. Cite each fact with the source number, e.g. "(source 2)". ` +
    `4. If the context does not contain the answer, say "I don't have enough context to answer that." ` +
    (opts.lowConfidence
      ? `5. The top retrieved source has low relevance; state explicitly that confidence is low.\n`
      : ``);

  const user =
    `Question: ${question}\n\n` +
    `Context:\n${contextBlock}\n\n` +
    `Answer (cited, grounded only in the context above):`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
```

**Context string:** reuses the `buildNodeContent` pattern from
`organization-memory.ts` (node name, type, related edges, bus factor /
confidence / documented flags when available). We **extract** `buildNodeContent`
into a shared `web/src/ai/node-content.ts` so both `organization-memory.ts`
and `retrieve.ts` call the same function — this prevents drift and is required
by R6.2 ("reusing the `buildNodeContent` pattern").

**Tradeoff (extract vs duplicate):** Extracting `buildNodeContent` touches
`organization-memory.ts` (a non-zero refactor risk against the no-regression
requirement R7). We mitigate by keeping the extracted function's signature and
output byte-identical to the current private function, and by leaving the
existing `organization-memory.test.ts` suite unchanged (R7.2). The extraction
is a pure move + `export`, no logic change. Alternative — duplicating the
function in `retrieve.ts` — would violate DRY and risk the two builders
drifting, which directly threatens citation correctness.

**Tradeoff (citation correctness is prompt-dependent):** Per spec open-risk,
"no ungrounded claims" cannot be fully asserted by unit tests. We rely on (a)
the grounding instruction in the system message, (b) canned LLM fixtures in
`web/test-fixtures/llm/rag-*.json` that are reviewed at design time for
citation coverage, and (c) a follow-up change to add a citation-coverage
heuristic (out of v1 scope). The unit test asserts the **prompt** contains
each context and the grounding instruction, not that the LLM's output is
correct — that is a review-time check on the fixtures.

---

## 6. UI Surface (`/chat`, R5)

### 6.1 File layout

```
web/src/app/chat/page.tsx              # server shell, auth gate, renders <ChatClient />
web/src/app/chat/chat-client.tsx       # client component: input, submit, answer, sources
```

### 6.2 Component sketch

```tsx
"use client";
import { useState } from "react";

type Citation = { nodeId: string; nodeName: string; nodeType: string; relevance: number };

export function ChatClient() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Citation[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAnswer(data.answer);
      setSources(data.sources);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (/* input + submit (disabled while loading) + answer + sources list */);
}
```

### 6.3 State contract

- **Loading:** `status === "loading"` → submit disabled, spinner shown, prior
  answer preserved (R5.3).
- **Error:** `status === "error"` → error message shown, submit re-enabled
  (R5.3).
- **No streaming:** the response is rendered in one shot from `res.json()`
  (R5.4).
- **No conversation history:** `question`/`answer`/`sources` are reset on
  each new submit; there is no message array (R5.4).

**Tradeoff (server shell vs pure client page):** A server shell
(`app/chat/page.tsx`) lets us redirect unauthenticated users server-side via
`getCurrentUser()` before rendering, matching the pattern in other protected
routes. The alternative — a pure client page with a client-side auth check —
would flash the chat UI before redirecting. We choose the server shell for UX
consistency; the actual interactivity is in the client child.

---

## 7. Data Flow (end-to-end)

```
User types question in /chat
  → ChatClient.onSubmit
  → POST /api/chat { question }
  → requireApiUser() → AuthUser(401/403 if bad)
  → validate question (400 if empty)
  → retrieveContexts(companyId, question)
      → embed(question)               // Ollama nomic-embed-text → simpleEmbed fallback
      → createPgVectorStore(db).search(vec, topK)
          // DB path:  SELECT ne.node_id, 1-(ne.embedding <=> $q) AS sim
          //           FROM node_embeddings ne
          //           JOIN nodes n ON n.id = ne.node_id
          //           WHERE n.company_id = $companyId
          //           ORDER BY ne.embedding <=> $q
          //           LIMIT $topK * 4   (over-fetch for post-filter safety)
      → enrichAndFilter(results, companyId)  // attach nodeName/nodeType, JS tenant filter
  → if contexts.length === 0 → 200 "Not enough context yet." sources:[] (no LLM)
  → if contexts[0].relevance < 0.2 → lowConfidence=true
  → if getLlmConfig() == null → citedListFallback(contexts)
  → else try chatCompletion(buildRagPrompt(question, contexts, {lowConfidence}))
        catch → citedListFallback(contexts)
  → 200 { answer, sources: contexts.map(toCitation) }
  → ChatClient renders answer + sources
```

---

## 8. File changes (forecast)

| Path | Change | LOC (est.) |
| --- | --- | --- |
| `web/src/db/vector-type.ts` | **new** — `customType` for `vector(768)` | ~25 |
| `web/src/db/schema.ts` | `node_embeddings.embedding`: `jsonb` → `vector` | ~2 |
| `web/drizzle/0004_rag_qanda_vector.sql` | **new** — migration + HNSW index | ~30 |
| `web/src/ai/pgvector-store.ts` | dimension guard, `toDriver` literal, over-fetch + tenant join, `RAG_TOP_K` | ~60 |
| `web/src/ai/node-content.ts` | **new** — extracted `buildNodeContent` | ~40 |
| `web/src/ai/organization-memory.ts` | import extracted `buildNodeContent` (no logic change) | ~5 |
| `web/src/server/rag/rag-prompt.ts` | **new** — `buildRagPrompt` | ~40 |
| `web/src/server/rag/citations.ts` | **new** — `Citation` type + `toCitation` | ~15 |
| `web/src/server/rag/retrieve.ts` | **new** — `retrieveContexts` + `enrichAndFilter` | ~50 |
| `web/src/app/api/chat/route.ts` | **new** — `POST` handler | ~60 |
| `web/src/app/chat/page.tsx` | **new** — server shell | ~15 |
| `web/src/app/chat/chat-client.tsx` | **new** — client UI | ~80 |
| **Tests** | | |
| `web/src/ai/pgvector-store.test.ts` | **new** — dim guard, `<=>` SQL assertion, fallback, `RAG_TOP_K` | ~120 |
| `web/src/server/rag/rag-prompt.test.ts` | **new** — prompt injection + purity | ~60 |
| `web/src/app/api/chat/route.test.ts` | **new** — 400/401/403, 200 grounded, tenant isolation, empty graph, low-rel, LLM null/throw, embeddings fallback | ~180 |
| `web/src/app/chat/chat-client.test.tsx` | **new** — render, loading, error, no streaming/history | ~100 |
| `web/test-fixtures/llm/rag-*.json` | **new** — canned LLM responses | ~30 |
| `web/src/db/integration/rag-qanda.integration.test.ts` | **new** — migration + index + `<=>` round-trip + tenant isolation against `pgvector/pgvector:pg16` | ~120 |

**Estimated total:** ~1080 LOC (under the 500-changed-lines review budget for
*production* code; the tests + fixtures + migration push the total over, but
the review budget applies to production changes per the SDD preflight note).
If the reviewer flags the test LOC against the budget, the integration test
file can be deferred to a follow-up without blocking v1 acceptance (it is
already gated behind `TESTCONTAINERS=1` and does not run in the default
suite).

---

## 9. Test strategy

Per spec §Test plan, unchanged in design. Key design-level notes:

- **`pgvector-store.test.ts`** uses a mock `Db` whose `execute` captures the
  SQL string and asserts it contains `<=>`, `ORDER BY ... <=>`, `LIMIT`, and
  the `nodes.company_id` join. No real Postgres needed.
- **`route.test.ts`** mocks `requireApiUser`, `embed`, `createPgVectorStore`,
  `getLlmConfig`, `chatCompletion` via `vi.mock`. The empty-graph case
  asserts `chatCompletion` was **never called** (R4.1).
- **`rag-prompt.test.ts`** asserts the returned message array contains each
  context's `nodeName`, `nodeType`, `relevance`, `content`, and the grounding
  instruction; asserts no side effects (call twice, compare outputs).
- **`chat-client.test.tsx`** uses `happy-dom` + mocked `fetch`; asserts the
  submit button is disabled during `loading`, an error message renders on
  non-2xx, and submitting twice does not retain the first answer (no history).
- **`rag-qanda.integration.test.ts`** spins up `pgvector/pgvector:pg16` via
  testcontainers, runs the migration, asserts the column type is `vector(768)`
  via `information_schema.columns`, asserts the HNSW index exists via
  `pg_indexes`, round-trips an `upsert` + `search`, asserts the dim-mismatch
  guard throws against the real DB, and asserts tenant isolation at the DB
  level (companyA insert → companyB query returns 0 rows). Skips with a
  recorded reason when `TESTCONTAINERS !== "1"`.

---

## 10. Migration / rollout plan

1. **Pre-flight (operator):** optional
   `CREATE TABLE node_embeddings_pre_rag_backup AS SELECT * FROM node_embeddings;`
   for safety net (documented in migration header, not automated).
2. **Apply migration:** `npx drizzle-kit push` (dev) or run
   `0004_rag_qanda_vector.sql` against the target DB. The `DO $$ ... $$` block
   logs the dropped-row count via `RAISE NOTICE`.
3. **Verify:** `SELECT atttypid::regtype FROM pg_attribute WHERE attrelid =
   'node_embeddings'::regclass AND attname = 'embedding';` → `vector(768)`;
   `\di node_embeddings_embedding_hnsw_idx` → exists.
4. **Deploy app:** the new `/api/chat` route and `/chat` page are additive;
   no existing route changes. `createPgVectorStore` changes are
   backward-compatible (same contract, stronger guard).
5. **Smoke test:** authenticated `POST /api/chat { "question": "test" }`
   against a tenant with ≥1 indexed node → expect 200 with non-empty
   `sources`.

**Rollback** (§2.4): drop the HNSW index, alter the column back to `jsonb`
via `to_jsonb(embedding)`. Dropped mismatched-dimension rows are **not
recovered**. Rollback is operator-run and documented; it is not wired into
`drizzle-kit` because `drizzle-kit drop` would also drop the table.

---

## 11. Decisions summary (with tradeoff one-liners)

| # | Decision | Tradeoff (one line) |
| --- | --- | --- |
| D1 | `customType` for `vector(768)` (vs raw SQL) | Hand-written `toDriver`/`fromDriver` parse risk; mitigated by round-trip unit test. |
| D2 | Hand-authored migration `0004_*.sql` (vs drizzle-kit generate) | `drizzle-kit generate` cannot express cast + drop + HNSW; manual SQL is the only correct path. |
| D3 | `CREATE INDEX CONCURRENTLY` for HNSW | No write lock; failure leaves invalid index needing manual drop — acceptable at v1 scale. |
| D4 | In-place `jsonb::vector(768)` cast (vs re-embed) | No re-embedding call needed; non-numeric `jsonb` fails loudly (good). |
| D5 | HNSW `m=16, ef_construction=64` (vs ivfflat) | Better recall + no `lists` tuning; ~2x memory vs ivfflat, fine at v1 scale. |
| D6 | Global HNSW + SQL join filter (vs per-tenant partial index) | No scope creep; over-fetches for small tenants — revisit at 50k nodes/tenant. |
| D7 | Over-fetch `topK * 4` + JS `assertTenant` belt-and-suspenders | Wastes work when tenant is small; buys isolation safety in fallback path. |
| D8 | Module-load `RAG_TOP_K` resolution | Tests need `vi.resetModules()`; cheap and matches spec open-risk note. |
| D9 | Extract `buildNodeContent` to shared module | Touches `organization-memory.ts` (R7 risk); mitigated by byte-identical move + unchanged tests. |
| D10 | Single `try/catch` around `chatCompletion` only | Retrieval/embedding failures surface as 500s (not masked); embeddings fallback is internal to `embed()`. |
| D11 | Server shell + client child for `/chat` | Extra file vs pure client page; avoids auth-flash UX. |
| D12 | Manual rollback, no auto-recovery of dropped rows | Operator-run; logged dropped count is the audit trail. |

---

## 12. Open questions for the parent / next phase

- **Per-tenant partial index threshold (D6):** confirm the 50k-nodes/tenant
  trigger is acceptable as a documented future threshold, or whether the
  parent wants the `company_id` denormalization in v1. (Default: defer.)
- **Citation-coverage heuristic:** spec open-risk; out of v1. Confirm defer.
- **Integration test LOC vs 500-line review budget:** if the reviewer counts
  the integration test file against the budget, it can be deferred to a
  follow-up without blocking v1 (it is `TESTCONTAINERS`-gated).

No blocking decisions identified — proceeding to tasks phase is safe.
