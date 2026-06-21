# Company Brain OS web agent rules

## Stack

- Next.js App Router with TypeScript.
- Prefer Server Components by default. Add `"use client"` only at interactive leaves.
- Use `next/font`; do not add Google Font `<link>` tags.
- Tailwind CSS is the styling baseline.
- shadcn/ui components are copied into `src/components/ui`; add only the component needed.

## Product constraints

- The graph is the source of truth. Do not duplicate business graph data in canvas/UI state.
- Canvas layout belongs in `node_layout` only.
- Do not add auth, AI calls, missions, or canvas code during F0 unless a task explicitly advances that phase.
- AI extraction must output typed graph operations for human confirmation; never mutate the graph from raw model text.

## Domain invariants

- Node types are closed: `Person`, `Knowledge`, `Process`, `Asset`, `Unit`, `Risk`.
- Edge types are closed: `MASTERS`, `LEARNS`, `REQUIRES`, `EXECUTES`, `PRODUCES`, `DEPENDS_ON`, `BELONGS_TO`.
- Sector-specific detail belongs in attributes, not new node or edge types.
- `Knowledge` requires `knowledge_type` and `confidence` from 0 to 100.

## Data strategy

Postgres + Apache AGE is the target. Until AGE support is verified in the chosen provider, relational `nodes` and `edges` are the canonical graph store.

## Verification

Before claiming done:

```bash
npm test -- --run
npm run build
```
