# F2 Graph Canvas (tldraw)

F2 renders the organizational graph as an interactive tldraw canvas, seeded with interview data confirmed in F0.5/F1.

## Architecture

```
GraphService (truth)  ←→  GraphCanvas (view)
     │                          │
     │  service.listNodes()     │  editor.createShapes()
     │  service.listEdges()     │  nodeToShape / edgeToShape
     │                          │
     └──── canvas mutations ────┘
          write back to service
```

- **Source of truth**: `GraphService` (in-memory for F2). The canvas is a view; all mutations go through the service.
- **Shape mapping**: Pure functions in `canvas-mapping.ts` convert domain nodes/edges to tldraw geo/arrow shapes, testable in isolation.
- **Color coding**: Nodes are color-coded by type (Person=blue, Knowledge=orange, Process=green, Asset=violet, Unit=grey, Risk=red).
- **Layout**: Simple grid layout (ponytail: no force-directed). Columns of 3, rows sized dynamically.
- **Sync**: On mount and on service event log growth, the canvas reconciles shapes with the service state.

## Files

| File | Purpose |
|------|---------|
| `src/canvas/GraphCanvas.tsx` | tldraw React component; `"use client"`, mounts `<Tldraw>` and syncs with GraphService |
| `src/canvas/canvas-mapping.ts` | Pure functions: `nodeToShape`, `edgeToShape`, `getNodeColor` |
| `src/canvas/graph-canvas.test.ts` | Tests for shape mapping and sync layer (13 tests) |
| `src/app/canvas/page.tsx` | `/canvas` route seeded with demo interview data |
| `docs/f2-canvas.md` | This document |

## Usage

Visit `/canvas` to see the graph rendered from demo interview data. Nodes appear as labeled rectangles, edges as arrows between them.

## Scope

- In-memory GraphService only; no DB persistence.
- No auth, missions, or AI calls.
- Tldraw's built-in shape palette (geo rectangles, arrow connectors), no custom shape definitions.
- Grid layout; add force-directed or user-saved layout when `node_layout` persistence is wired (F5+).

## Next

- F3/F4: Sync canvas edits back through the GraphService, then enable dual-way sync with chat AI extraction.
- F5+: Persist `node_layout` (positions) so canvas layout survives reloads.
