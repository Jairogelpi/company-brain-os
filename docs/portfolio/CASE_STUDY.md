# Portfolio case study: Company Brain OS

## The problem

Operational knowledge often lives in one person's memory, inbox or undocumented routine. Conventional knowledge bases show what was uploaded; they do not prove who can execute the work, whether access exists, or whether dependency risk actually fell.

## Product thesis

Treat organizational knowledge as evidence-backed claims, derive risks deterministically and close the loop only when a real control is verified. AI accelerates capture and explanation but never becomes the source of truth.

## The hard design decisions

1. **Ledger over mutable graph.** The first architecture allowed direct graph writes. It was corrected so a governed assertion/evidence ledger is canonical, claim content has traceable lifecycle transitions and the graph is reproducible.
2. **Risk as derivation.** Risk nodes were removed from the organizational ontology. Every risk now names a versioned rule, inputs and evidence.
3. **Documentation is not transfer.** Approving an SOP can resolve a documentation gap, but a person-dependency risk remains until a backup demonstrates competency and access under independent review.
4. **Tenant isolation below the API.** Application scoping is backed by RLS, composite tenant foreign keys, a non-owner runtime role and integration tests.
5. **AI without hidden authority.** Model output goes to Inbox. It cannot approve facts, alter permissions or close missions.
6. **Identity without name heuristics.** Owners map logins 1:1 to tenant Person nodes; assessment and independent review compare stable canonical IDs in the API, domain and database.

## Evidence

| Claim | Repository evidence |
| --- | --- |
| Deterministic projection | `graph-projection.ts` and projection service tests |
| Evidence-linked atomic claims | assertion repository batch/evidence tests and canonical E2E |
| No AI direct writes | `/api/graph/build` queues Inbox proposals |
| Explainable risk | `risk-engine.ts` emits rule/version/input/evidence refs |
| Verified transfer | explicit User→Person mapping, mission verification domain, API and UI |
| Canonical E2E | `canonical-pedro-laura.e2e.test.ts` |
| SaaS isolation | RLS migrations and two PostgreSQL integration suites |
| Secure files | tenant storage, signature tests, ClamAV and safe serving headers |
| Durable notification | assignment transaction, delivery outbox, retries/dead letter and user bell |
| Release confidence | CI migration, tests, coverage, E2E, RLS, typecheck and build |

## Result

The repository now demonstrates the complete continuity loop with fictional Pedro/Laura data and automated evidence. This is engineering validation, not a claim of customer impact. Commercial impact must be measured in a paid pilot using the scorecard in [PILOT_OFFER.md](../commercial/PILOT_OFFER.md).

## Responsible boundary

The system measures operational dependency. It is intentionally not an employee surveillance, productivity or performance-ranking product.
