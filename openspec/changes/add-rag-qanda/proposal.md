# Proposal — add-rag-qanda

## Problem

The platform has pgvector, an embeddings client, an in-memory vector store, and LLM generation modules — but cannot answer a user question about their own organization with grounded, cited context. The `node_embeddings.embedding` column is `jsonb`, so real pgvector similarity search is impossible, and there is no retrieval+generation chat endpoint. The most obvious AI value surface (ask a question, get a cited answer) is missing.

## Outcome

A user types a question ("Who knows how to configure the filler, and what happens if they leave?") and receives an answer grounded in retrieved graph nodes with citations (node name, type, relevance), powered by real pgvector cosine search + LLM generation over the retrieved context.

## Target users and situations

- Any operator who wants a natural-language read on the knowledge graph instead of clicking through pages.
- Reviewers validating coverage: "what's undocumented and critical?"
- Succession planning: "what breaks if Pedro leaves?" (complements the simulator with a narrative answer).

## Current-state gap

- `node_embeddings.embedding` is `jsonb` → no efficient vector distance search.
- No vector index (ivfflat/HNSW).
- Retrieval is in-memory only (`OrganizationMemory` + `VectorStore`), not persisted.
- No `/api/chat` or Q&A route; no RAG prompt that injects retrieved context into generation.

## Implications and impact

- Schema migration: `jsonb` → `vector(768)` + index. Requires backfill of existing embeddings.
- New API route + UI surface for Q&A.
- Grounding reduces hallucination risk vs. free-form LLM calls — a correctness win.
- Reuses `consultant.ts`/`wiki-generator.ts` generation patterns.

## Edge cases

- Empty graph / no embeddings → answer with "not enough context yet," not a hallucinated answer.
- Question unrelated to graph → retrieved context has low relevance → answer reflects that (cited, low-confidence).
- LLM unavailable → return retrieved context as a cited list (graceful, matches existing fallback posture).
- Embedding dimension mismatch (if model swapped) → guard at upsert.

## First-slice scope boundaries

In:

- Migrate `node_embeddings.embedding` to `vector(768)` + cosine index.
- Wire `createPgVectorStore` as the real retrieval backend (fallback to in-memory when DB absent).
- `/api/chat` route: embed question → retrieve top-k node contexts → LLM answer with citations.
- Minimal chat UI surface (input + answer + cited sources).

Out (v1):

- Document chunk embeddings (retrieval is over graph node context).
- Streaming responses.
- Multi-turn conversation memory.

## Non-goals

- Replacing `GlobalSearch`'s in-memory command palette.
- General-purpose document RAG (follow-up change).

## Product constraints

- Citations are mandatory in the answer (no ungrounded claims).
- Degrades gracefully when LLM or DB unavailable.
- Self-hostable: Ollama embeddings + existing LLM client config.

## Decision gaps to resolve in spec

- Retrieval top-k value (5? configurable?).
- Vector index type: ivfflat (simpler, tunable `lists`) vs HNSW (better recall, more memory).
- Whether to backfill embeddings on migration or lazy-rebuild.
- Chat UI placement (new page vs dashboard widget vs command palette extension).

## Business tradeoffs

- Grounded RAG increases trust and reduces hallucination liability vs free-form chat — worth the migration cost.
- Graph-only retrieval (v1) is fast to ship; document RAG is a bigger follow-up and should not block this.
- HNSW gives better recall at higher memory cost; ivfflat is cheaper but needs `lists` tuning — pick per dataset size expectation.
