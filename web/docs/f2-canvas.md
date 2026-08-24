# Graph canvas

The canvas is a view/editor over the tenant graph projection. Reads come from the persistent projection; edits call authenticated graph APIs, which translate human actions into approved assertions and rebuild the projection. Canvas shape state never becomes business truth.

Pure shape mapping remains isolated for deterministic tests. Display coordinates belong in `node_layout`; entity and relationship facts belong in the assertion ledger.

Primary implementation: `src/canvas`, `src/app/(app)/graph`, `src/server/graph.ts`, `src/domain/canonical-graph-writer.ts`.
