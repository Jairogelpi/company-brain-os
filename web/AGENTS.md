# Company Brain OS web rules

## Product contract

- Follow `docs/product/COMPANY_BRAIN_OS_V4.md`.
- The immutable assertion/evidence ledger is canonical. `nodes` and `edges` are a rebuildable projection only.
- AI and imports create proposals. Only an authorized human can approve organizational truth.
- A document is not verified transfer. Mission closure requires a competent backup, required access, evidence and an independent reviewer.
- Risks are deterministic, versioned derived records, never graph nodes.
- Measure continuity dependency, never employee productivity, loyalty or performance.

## Domain invariants

- Canonical entities: `Person`, `Knowledge`, `Process`, `Asset`, `OrganizationalUnit`, `ExternalParty`, `Project`, `System`, `Document`.
- `ExternalParty.attributes.subtype` distinguishes clients and suppliers.
- Canonical relationships are the closed catalog in `src/domain/graph.ts`.
- Every projected node and edge must expose assertion provenance.
- Rejected, expired, superseded and archived assertions never project.
- No business operation may infer `default` or `demo-corp` as a tenant.

## Security invariants

- Every business query is organization-scoped; RLS context is set inside the same database transaction as the query.
- Never use the database owner for the production app.
- Uploads are tenant-partitioned, signature-checked and malware-scanned before storage.
- Do not log captured content, credentials, raw uploads or sensitive HR data.

## Stack

- Next.js App Router, React, strict TypeScript and Tailwind CSS.
- Prefer Server Components; use `"use client"` only at interactive leaves.
- Domain modules must not depend on Next.js.
- Keep provider integrations behind interfaces.

## Verification

Before claiming done:

```bash
npm run typecheck
npm test -- --run
npm run test:e2e
npm run test:critical
npm run build
```
