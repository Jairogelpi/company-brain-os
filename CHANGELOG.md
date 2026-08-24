# Changelog

All notable changes to Company Brain OS are documented here. The project currently uses a pilot-readiness release track; repository releases must not be interpreted as customer-outcome certification.

## Unreleased

### Documentation and developer experience

- Rebuilt the public README around the current Next.js 16.3.2 / React 19.2 architecture.
- Added a canonical documentation map under `docs/README.md`.
- Added `npm run verify:all` to reproduce all repository-controlled release-gate categories locally after a clean `npm ci`.
- Synchronized CONTRIBUTING with the permanent CI gate, including PostgreSQL tenant isolation and production dependency audit.
- Made the distinction between implemented, repository-verified and externally validated evidence explicit.
- Began consolidating historical planning material under `docs/archive/` to keep the repository root product-facing.

## 0.1.0 — Pilot-ready repository baseline

### Product

- Canonical assertion/evidence ledger with deterministic graph projection.
- Explainable versioned continuity risks tied to exact facts and rule inputs.
- Mitigation missions with artifact, competency, access, evidence and independent transfer review.
- Human-governed AI/import proposal workflow.
- Simulator, succession playbooks, knowledge assistant and executive metrics.

### SaaS and security

- Organization-scoped RBAC and PostgreSQL RLS.
- Composite tenant foreign keys and least-privilege production database role.
- Expiring one-time workspace invitations with hashed tokens.
- Tenant-partitioned uploads with signature validation, hashing and malware scanning.
- Separate production worker with durable jobs/outbox and bounded retries.

### Verification

- Full automated test suite and canonical Pedro → Laura E2E acceptance journey.
- Critical-domain coverage gate.
- Real PostgreSQL cross-tenant isolation gate.
- Strict TypeScript and production Next.js build gates.
- Production dependency vulnerability gate.
- Reproducible Docker production topology.

### Evidence boundary

This baseline establishes repository-controlled engineering evidence only. Real customer outcomes, paid-pilot proof, timed restore evidence, legal approval and independent security assessment remain external validation gates tracked separately.
