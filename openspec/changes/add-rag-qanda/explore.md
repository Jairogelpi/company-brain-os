# Explore — add-rag-qanda

## Idea

Turn the existing pgvector + embeddings infrastructure into a working retrieval-augmented Q&A: users ask natural-language questions about their organization's knowledge graph and documents, and get answers grounded in retrieved nodes/docs with citations. The infra is 80% there but the schema stores embeddings as `jsonb` (not `vector`) so real similarity search does not work, and there is no retrieval+generation chat endpoint.

## Current state (evidence)

- `web/src/ai/embeddings.ts`: Ollama `nomic-embed-text` (768-dim) with `simpleEmbed` fallback. Works.
- `web/src/ai/vector-store.ts`: in-memory `VectorStore` + `cosineSimilarity` + `simpleEmbed`. Works.
- `web/src/ai/pgvector-store.ts`: `PgVectorStore` interface + `createPgVectorStore(db?)` with in-memory fallback. Uses raw SQL against `node_embeddings`.
- `web/src/db/schema.ts` L125-135:
  - `node_embeddings` table exists with `embedding: jsonb("embedding").$type<number[]>()`.
  - **Gap:** `jsonb` cannot do pgvector `<=>` distance search efficiently; it should be `vector(768)` with an ivfflat or HNSW index.
  - Only `node_embeddings_node_idx` on `nodeId`; no vector index.
- `web/src/ai/organization-memory.ts`: `OrganizationMemory` builds `MemoryContext` from graph nodes + metrics, uses in-memory `VectorStore` + `simpleEmbed`, exposes `search()`. Already a retrieval layer, but in-memory only.
- `web/src/ai/consultant.ts` + `wiki-generator.ts`: LLM generation patterns already established (`chatCompletion`, `getLlmConfig`, heuristic fallbacks).
- No `/api/chat` or Q&A route exists; no RAG retrieval+generation endpoint.

## Why now

pgvector is already installed and `node_embeddings` exists, so the leap to real vector search is a schema migration + wiring, not new infra. The consultant and wiki generator prove the LLM generation path. The missing piece is a retrieval-augmented chat that answers questions with cited graph context — the most obvious "AI value" surface for users.

## Non-goals

- Replacing the in-memory `OrganizationMemory` search used by `GlobalSearch` (that stays for the command palette).
- Streaming token-by-token responses in v1 (return full answer).
- Multi-turn conversational memory across requests in v1.
- Embedding arbitrary uploaded documents beyond graph nodes (v1 retrieves over node context; document RAG is a follow-up).

## Open questions for proposal

1. Retrieval corpus: graph nodes only (v1) vs graph nodes + ingested document chunks. Graph-only is simpler and reuses `OrganizationMemory` context building.
2. Schema migration: add a `vector(768)` column alongside `jsonb`, or convert. Conversion is cleaner but needs a backfill.
3. Citation shape: node id + name + relevance score, rendered in the UI.
4. Generation: use `consultant.ts` patterns, or a dedicated RAG prompt with retrieved context injected.

## Assumptions to validate

- 768-dim matches `nomic-embed-text` (confirmed in embeddings.ts).
- pgvector `<=>` cosine distance is the right operator (confirmed by vector-store cosine usage).
- The existing `OrganizationMemory.MemoryContext` is a good retrieval unit.
