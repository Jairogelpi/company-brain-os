# Changelog

All notable changes to Company Brain OS are documented here. The project uses a pilot-readiness release track; repository releases must not be interpreted as customer-outcome certification.

## Unreleased

No repository-controlled release debt is currently scheduled. New work should be driven by real pilot evidence, security findings, operational evidence or clearly scoped product requirements rather than speculative feature expansion.

## v1.0.0-pilot — Formal pilot repository release

### Engineering quality

- Added deterministic repository lint policy for suppression markers, debugger statements and unresolved executable-code TODO/FIXME/HACK markers.
- Added deterministic formatting policy for line endings, trailing whitespace and final newlines.
- Added both gates to CI and `npm run verify:all`.

### Browser evidence

- Added pinned Playwright/Chromium browser E2E.
- Proves anonymous protected-route redirect, real credentials login for the seeded owner and authenticated navigation across critical protected areas.
- Keeps the canonical Pedro → Laura domain E2E as an independent lower-level acceptance proof.

### Application security

- Added GitHub CodeQL static analysis for JavaScript/TypeScript on master, pull requests and a weekly schedule.
- Retained production dependency audit, PostgreSQL tenant-isolation tests, secure upload controls and least-privilege runtime architecture.

### Repository hygiene

- Removed local `.mimocode/` and `.pi/` tool artifacts from the public repository and ignored them going forward.
- Explicitly marked `openspec/` and `docs/superpowers/` as non-canonical historical archives.
- Added formal `v1.0.0-pilot` release notes and an idempotent one-shot GitHub Release workflow.

### Documentation and setup

- Rebuilt the public README around the current Next.js 16.3.2 / React 19.2 architecture.
- Added a canonical documentation map under `docs/README.md`.
- Documented Docker, no-Docker and hybrid setup paths, including Windows PowerShell and macOS/Linux commands.
- Synchronized CONTRIBUTING and the release scorecard with the permanent CI, browser and security gates.
- Made the distinction between implemented, repository-verified and externally validated evidence explicit.

### Evidence boundary

This release establishes repository-controlled engineering readiness for pilot evaluation only. Real customer outcomes, paid-pilot proof, timed restore evidence, legal approval and independent security assessment remain external validation gates tracked separately.

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
