# Design — Passive Capture

## Context

`/capture` already turns a guided interview into proposals persisted via
`POST /api/graph/proposals`. `src/ai/extraction.ts` extracts entities from text;
`src/domain/interview.ts` produces `GraphOperationProposal[]`. Passive capture
reuses all of this with a different *front door*: arbitrary text instead of a
guided Q&A.

## Decisions & tradeoffs

### Human-in-the-loop (non-negotiable)
- **Chosen:** ingestion never writes directly; it only creates **pending
  proposals** a human approves.
  - + Trust + accuracy: LLM/heuristic extraction is fallible; auto-writing would
    poison the graph and destroy buyer trust.
  - − Adds a review step. This is a feature, not friction — it is the audit trail.

### Where pending proposals live
- **Chosen (v1):** generate on submit and hold in the inbox; persist proposals
  to an `ingestion_sources` row for provenance/audit.
  - Tradeoff: if we want async/batch ingestion (connectors) we need a queue;
    out of scope for v1, the source abstraction leaves room for it.

### Connectors later, abstraction now
- Define a `SourceText { id, label, text, capturedAt }` boundary. v1 producers:
  paste + upload. Slack/Gmail/Zoom are future producers of the same type — the
  extraction → inbox path is unchanged. ponytail: build the two cheap sources,
  not the connector platform, but don't hard-code paste-only.

### Extraction cost/quality
- Reuse existing extraction (heuristic + optional LLM). LLM calls are the cost
  driver; gate behind config and fall back to heuristics (already the pattern in
  `src/ai/client.ts`). Tradeoff: heuristic-only yields fewer/weaker proposals,
  acceptable since a human reviews anyway.
