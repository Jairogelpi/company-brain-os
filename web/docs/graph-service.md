# F1 Graph Service

Source: `src/domain/graph-service.ts`, tests: `src/domain/graph-service.test.ts`.

## Purpose

The Graph Service is the single source of truth for the live in-memory graph. It exposes deterministic CRUD operations for nodes and edges, validates every mutation against `validateGraph`, and appends a typed, append-only event log shaped for the Drizzle `event_log` table.

No database persistence, AI API calls, auth, canvas, missions, or routes are involved in this slice.

## API

### `createGraphService(options?)`

Creates a new `GraphService` instance. Options:

- `actorId?: string` — included in every event
- `companyId?: string` — included in every event

### Node CRUD

| Method | Description |
|--------|-------------|
| `createNode(node)` | Creates a node. Validates the full graph. Throws if duplicate ID or invalid. |
| `readNode(id)` | Returns a copy of the node, or `undefined`. |
| `updateNode(id, patch)` | Merges patch into the node. Validates. Throws if missing or invalid. |
| `deleteNode(id)` | Removes the node and all edges referencing it (cascade). Returns cascaded edge IDs. |
| `listNodes()` | Returns copies of all nodes. |

### Edge CRUD

| Method | Description |
|--------|-------------|
| `createEdge(edge)` | Creates an edge. Validates endpoints exist and are compatible. Throws if duplicate ID, missing nodes, or invalid endpoints. |
| `readEdge(id)` | Returns a copy of the edge, or `undefined`. |
| `updateEdge(id, patch)` | Merges patch into the edge. Validates. Throws if missing or invalid. |
| `deleteEdge(id)` | Removes the edge. Does not cascade. |
| `listEdges()` | Returns copies of all edges. |

### Proposal Integration

| Method | Description |
|--------|-------------|
| `applyConfirmedProposals(proposals)` | Applies an array of `GraphOperationProposal[]` directly through CRUD. Used after the confirmation layer has filtered to approved proposals. |
| `applyProposalsWithDecisions(proposals, decisions)` | Delegates to `confirmGraphProposals` for decision validation, then applies only approved proposals. Rolls back on validation failure. |

### Event Log

| Method | Description |
|--------|-------------|
| `eventLog()` | Returns copies of all recorded events in order. |

## Guarantees

1. **Validation gate**: Every mutating operation validates the full resulting graph. Invalid mutations are rejected without partial application.
2. **Cascade delete**: Removing a node automatically removes all edges that reference it. Cascaded edge IDs are recorded in the event.
3. **Immutability**: All reads return deep copies. Mutating a returned object does not affect the service state.
4. **Event audit trail**: Every successful mutation appends a typed event with `id`, `companyId`, `actorId`, `eventType`, `payload` (including `before`/`after` snapshots), and `createdAt`.
5. **No partial commits on failure**: If validation fails after applying a change, the change is reverted and no event is recorded.
6. **Proposal integration**: `applyProposalsWithDecisions` uses the confirmation layer as a gate and rolls back all changes if the resulting graph would be invalid.

## Event types

| EventType | Payload fields |
|----------|---------------|
| `graph.node.created` | `nodeId`, `after` |
| `graph.node.updated` | `nodeId`, `before`, `after` |
| `graph.node.deleted` | `nodeId`, `before`, `cascadedEdgeIds` |
| `graph.edge.created` | `edgeId`, `after` |
| `graph.edge.updated` | `edgeId`, `before`, `after` |
| `graph.edge.deleted` | `edgeId`, `before` |

These map directly to the `event_log` table: `id` → `id`, `companyId` → `company_id`, `actorId` → `actor_id`, `eventType` → `event_type`, `payload` → `payload`, `createdAt` → `created_at`.

## Verification

Run from `web/`:

```bash
npm test -- --run src/domain/graph-service.test.ts
npm test -- --run
npm run build
npm run db:generate
```
