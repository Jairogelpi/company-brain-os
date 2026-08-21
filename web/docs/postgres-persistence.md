# PostgreSQL persistence

Production uses PostgreSQL 16 with pgvector. Drizzle repositories are wrapped in a transaction that sets `app.organization_id` before touching tenant-owned tables. PostgreSQL RLS is forced, the runtime role is not the table owner, and composite foreign keys reject cross-tenant references.

Persistence groups:

- canonical ledger: assertions, evidence sources/items and links;
- projection: nodes, edges, layout, embeddings and event log;
- workflow: Inbox, missions, submissions and transfer verifications;
- operations: uploads, transcription jobs, distributed rate limits and notification delivery outbox.

Migrations live in `drizzle/`. Production uses `npm run db:migrate`; `db:seed` is local demonstration data only. See [DEPLOY](../../DEPLOY.md) and the [SaaS security model](../../docs/security/SAAS_SECURITY.md).
