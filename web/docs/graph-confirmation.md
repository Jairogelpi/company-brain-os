# Graph proposal confirmation boundary

This slice implements the F1/F3 boundary between AI/interview extraction and the graph source of truth.

Source: `src/domain/graph-confirmation.ts`.

## Purpose

Interview and future AI extraction code may propose graph operations, but raw text never mutates the graph directly. Every `GraphOperationProposal[]` must pass through an explicit human decision layer:

- `approve` applies the proposal to an in-memory draft graph;
- `reject` skips the proposal;
- every proposal must have exactly one decision;
- the resulting graph is validated with `validateGraph` before it is committed.

No database, auth, canvas, missions, AI calls, or tRPC routes are involved in this slice.

## Guarantees

The confirmation layer:

1. Applies only approved proposals.
2. Logs rejected proposals without applying them.
3. Blocks invalid resulting graphs atomically.
4. Treats `update_node` on a missing node as an error.
5. Deduplicates repeated node/edge creates by ID.
6. Does not mutate input proposals or the current graph.
7. Returns append-only events shaped for future `event_log` persistence.

## Event log

Returned events use this shape:

```ts
type GraphConfirmationEvent = {
  id: string;
  companyId?: string;
  actorId?: string;
  eventType:
    | "graph.proposal.approved"
    | "graph.proposal.rejected"
    | "graph.proposal.applied"
    | "graph.proposal.failed";
  payload: Record<string, unknown>;
  createdAt: string;
};
```

Future persistence can map this directly into the `event_log` table payload. This implementation keeps it deterministic and in-memory for unit tests.

## Failure behavior

Validation failures return `ok: false`, the original graph, failure issues, and the event log ending in `graph.proposal.failed`. Draft changes are not partially committed.

Examples of blocked commits:

- unknown node or edge types;
- invalid edge endpoints;
- edge references to missing nodes;
- invalid Knowledge `knowledgeType` or `confidence`;
- missing update targets;
- missing, duplicate, or out-of-range decisions.

## Verification

Run from `web/`:

```bash
npm test -- --run src/domain/graph-confirmation.test.ts
npm test -- --run
npm run build
npm run db:generate
```
