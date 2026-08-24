# Company Brain OS documentation

This directory is the canonical documentation map for the current product. Start with the product contract, then follow the path that matches your role.

## New to the project

1. [Repository overview](../README.md) — what the product does, why it is different, how to run it and what is actually verified.
2. [Company Brain OS v4](product/COMPANY_BRAIN_OS_V4.md) — accepted product contract and current ontology.
3. [Pedro → Laura](demo/PEDRO_LAURA.md) — executable end-to-end proof of the central dependency-transfer loop.
4. [Release scorecard](RELEASE_SCORECARD.md) — precise boundary between repository evidence and external validation.

## Engineering and architecture

- [Canonical ledger architecture](architecture/CANONICAL_LEDGER.md) — approved assertions/evidence as truth; graph as deterministic projection.
- [Product contract](product/COMPANY_BRAIN_OS_V4.md) — behavior and domain model that implementation must satisfy.
- [Repository CI](../.github/workflows/ci.yml) — authoritative repository-controlled release gate.
- [Contributing](../CONTRIBUTING.md) — local verification, PR, security and evidence standards.

The architecture rule to preserve is simple: AI and imports may propose facts, but only governed human review can promote them into canonical truth. Derived graph/risk state must remain rebuildable from approved evidence.

## Security reviewers

- [Security policy](../SECURITY.md) — disclosure process, supported versions and non-negotiable development rules.
- [SaaS security model](security/SAAS_SECURITY.md) — tenant isolation, authorization, uploads and threat controls.
- [Release scorecard](RELEASE_SCORECARD.md) — security evidence required by the repository gate versus evidence that requires an independent external party.

## Operators and deployment

- [Deployment guide](../DEPLOY.md) — production configuration and deployment requirements.
- [Production runbook](operations/PRODUCTION_RUNBOOK.md) — operational procedures, verification and recovery responsibilities.
- [Production Compose](../docker-compose.prod.yml) — deployable service topology.

Production intentionally differs from demo/local mode: it uses a least-privilege database role, starts the worker and malware scanning services, and never seeds demo tenants or credentials automatically.

## Product, buyer and pilot material

- [Portfolio case study](portfolio/CASE_STUDY.md) — concise product/engineering narrative.
- [Pilot offer](commercial/PILOT_OFFER.md) — pilot scope and measurement plan.
- [One-page offer](commercial/ONE_PAGE.md) — buyer-facing positioning and sales playbook.
- [Release scorecard](RELEASE_SCORECARD.md) — evidence required before stronger product/company claims are made.

Repository tests demonstrate implementation behavior, not customer ROI. Paid-pilot outcomes, legal approval, restore-drill evidence and independent security validation must come from real external work.

## Historical material

Historical design notes are retained only when they help explain decisions or preserve old links. They are not the current product contract. See [`archive/`](archive/) when historical context is required.

## Source-of-truth hierarchy

If documents disagree, use this order:

1. current executable code and database migrations
2. [Company Brain OS v4](product/COMPANY_BRAIN_OS_V4.md)
3. [Release scorecard](RELEASE_SCORECARD.md) for evidence/claim status
4. architecture, security and operations documents
5. historical/archive material

Any contradiction found between levels 1–4 is documentation debt and should be fixed in the same change that introduces it.
