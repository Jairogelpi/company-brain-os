# Design — Bus-Factor Simulator

## Context

`src/domain/simulator.ts` (`simulatePersonLeaving`, `simulateMultipleLeaving`)
and `src/domain/advanced-features.ts` (`simulateDeepImpact`) already implement
the logic as pure functions over `nodes`/`edges`. This change is almost entirely
**exposure**, not new logic.

## Decisions & tradeoffs

### Client-side vs server-side simulation
- **Chosen:** run the simulation **client-side** on the snapshot from `/api/graph`.
  - + Instant, no new endpoint, demo feels real-time as you toggle people.
  - − Ships the graph to the browser; fine at SMB scale (hundreds of nodes).
- Rejected: a `/api/simulate` endpoint — needed only if graphs grow large or we
  want to email simulation results; keep as upgrade path.

### Reuse vs. re-implement cascade
- **Chosen:** reuse `simulateDeepImpact` for cascade; do not re-derive.
- Tradeoff: couples the page to that function's report shape — acceptable, it is
  already the canonical impact model and unit-tested.

### Euro coupling
- The euro figure depends on [add-financial-risk-exposure]. The simulator MUST
  degrade gracefully (structural impact only) when costs are absent, so the two
  features can ship independently.

### Multi-select UX
Toggling several people recomputes via `simulateMultipleLeaving`. ponytail: a
simple checklist of people + a results panel beats a draggable canvas for v1.
