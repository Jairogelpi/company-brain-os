# Company Brain OS — Master Product Specification v4.0

**Product:** Company Brain OS  
**Category:** Operational Continuity Intelligence  
**Market:** companies with 20–500 employees  
**Languages:** Spanish and English  
**Status:** accepted master specification

## Product promise

Company Brain OS finds the people, knowledge, processes, systems and external relationships a company cannot afford to lose, then turns each exposure into a verifiable mitigation plan.

The value loop is:

```text
discover exposure → explain evidence and impact → assign mitigation mission
→ capture and validate knowledge → verify a real backup → recalculate risk
```

The North Star Metric is **Critical Exposures Mitigated**: a critical exposure only counts when its required evidence, control and—when relevant—backup assessment are approved and the residual risk has been recalculated.

## Non-negotiable principles

1. Evidence before confidence: no organizational claim becomes operational truth without provenance, evidence and human control.
2. The canonical source is an immutable assertion-and-evidence ledger. The graph is a materialized, rebuildable projection of approved assertions.
3. AI may extract, propose, explain and draft; it may not approve facts, close risks, alter permissions or make employment decisions.
4. Risks are deterministic, versioned and explainable derived records—not AI-authored graph nodes.
5. A document is not a verified transfer. A backup counts only with valid evidence, competency and access where required.
6. The product measures operational dependency, never employee productivity, loyalty or performance.
7. The first experience produces an explainable exposure in under ten minutes, never an empty canvas.

## Canonical domain

Core entities: `Person`, `Knowledge`, `Process`, `System`, `Asset`, `ExternalParty`, `OrganizationalUnit`, `Project`, and `Document`.

`ExternalParty` replaces the separate Client and Supplier node types through a subtype. `Risk` is removed from the organizational graph and stored as a derived, versioned domain record.

Core relationships include `MASTERS`, `LEARNS`, `EXECUTES`, `REQUIRES`, `BACKS_UP`, `OWNS`, `MANAGES`, `ADMINISTERS`, `DOCUMENTS`, `BELONGS_TO`, `PRODUCES`, `INTERACTS_WITH`, `REPLACES` and `VALIDATES`. `DEPENDS_ON` is an explicit escape hatch with a reason and quality monitoring.

Each assertion has subject, predicate, object or scalar value, source, status, proposer, approver, validity window, recording time, supersession chain, confidence class, review date and metadata. Assertions are `draft`, `proposed`, `approved`, `disputed`, `rejected`, `superseded`, `expired` or `archived`.

## Product capabilities

- Adaptive continuity interview and structured import.
- Evidence-backed review inbox for AI and import proposals.
- Explainable risk rules for knowledge, process, system and relationship exposure.
- Missions for documentation, transfer, assessment, recovery, supplier alternatives and succession.
- Contributions, artifacts, validation policies and competency assessments.
- Non-destructive simulations of people, systems, suppliers and assets becoming unavailable.
- A cited Knowledge Assistant that abstains when evidence is missing, conflicting, expired or unauthorized.
- Executive dashboard, audit-ready reports, notifications and a continuity timeline.

## Security and SaaS constraints

The platform is a multi-tenant SaaS using PostgreSQL Row-Level Security. Every business record has a non-null organization foreign key; workers, caches, storage keys and logs carry explicit tenant context. Access is deny-by-default RBAC with ABAC for sensitive domains.

Uploads require MIME validation, quarantine, malware scanning, isolated processing, short-lived signed URLs and retention controls. Production does not create demo users or data. All sensitive actions are audited. AI inputs are untrusted data and cannot change system instructions or invoke privileged actions.

## Architecture

The initial architecture is a modular monolith: Next.js application services and domain modules on PostgreSQL + pgvector, object storage, and a separately deployed background worker. Domain modules do not depend on Next.js. External AI, storage, email, transcription and billing providers are behind interfaces.

## Delivery roadmap

- **R0 — Domain Correction:** ledger, evidence, graph projection, ontology correction, derived risks and invariants.
- **R1 — SaaS Security Foundation:** organizations, memberships, RLS, audit, secure storage and worker.
- **R2 — Continuity Scan:** ten-minute onboarding, first exposure, review and first mission.
- **R3–R4:** capture, validation, assessments and verified transfers.
- **R5–R6:** simulator, succession, cited assistant.
- **R7–R8:** billing, public API, integrations and enterprise controls.

## R0 acceptance criteria

1. The approved graph can be deterministically rebuilt from the ledger.
2. Every active relationship has provenance.
3. Every risk declares the exact rule, input facts, evidence and affected entities.
4. `Risk`, `Client` and `Supplier` no longer represent canonical graph types.
5. No business operation relies on `default` or `demo-corp` tenant values.
6. Rejected assertions never appear in the graph projection.

## Canonical demonstration

If Pedro alone configures a production line and administers its control system, while Laura has only observed it, the system must show the knowledge and system single points of failure, cite the supporting assertions, create a transfer mission, capture and validate the procedure, assess Laura independently, and only then reduce the relevant risk.
