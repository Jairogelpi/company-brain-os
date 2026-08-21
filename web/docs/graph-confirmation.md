# Graph proposal confirmation boundary

Every extracted `GraphOperationProposal` requires exactly one approve/reject decision. `confirmGraphProposals` validates the candidate state atomically; `CanonicalGraphWriter.applyProposalsWithDecisions` persists only approved proposals as approved assertions and rebuilds the projection.

Guarantees:

- no missing, duplicate or out-of-range decisions;
- rejected proposals are never persisted;
- invalid endpoint/type combinations fail before commit;
- decision order does not change the result;
- AI has no approval identity or direct projection-write path.

Primary implementation: `src/domain/graph-confirmation.ts` and `src/domain/canonical-graph-writer.ts`.
