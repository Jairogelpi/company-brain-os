# SaaS security model

## Tenant boundary

Every protected business row carries a non-null organization ID. Canonical graph, event, mission, transfer, ingestion, embedding, transcription, upload, notification and user-profile tables use PostgreSQL RLS with `FORCE ROW LEVEL SECURITY`. Application code establishes `app.organization_id` inside the same transaction as each query, which is required for pooled connections.

Composite foreign keys prevent an edge, submission, verification or evidence link from pointing at a row owned by another organization. Production provisions `company_brain_app`, a non-owner database role, so it cannot bypass RLS. Migrations use the database owner; runtime does not.

CI creates a non-superuser and verifies that cross-tenant reads are invisible and cross-tenant writes are rejected.

## Authorization

Roles are owner, validator, contributor and viewer. Sensitive operations are deny-by-default and route handlers enforce the required operation. AI output has no privileged execution path. Submission authors cannot approve their own evidence; transfer approval must also be independent of assessor and backup. Authenticated users are explicitly mapped 1:1 to canonical `Person` IDs inside the tenant before they can assess or review a transfer. The domain and database compare those stable IDs—never names—and reject self-assessment or self-review.

Workspace invitations are owner-only, expire after seven days and store only SHA-256 token hashes. Re-inviting an address revokes its previous pending token; acceptance is rate-limited and atomically consumes the token while creating the tenant user.

## Uploads

- Server-generated UUID filenames only.
- Object keys partitioned by a SHA-256 organization namespace.
- MIME allow-list plus magic-byte verification.
- SHA-256 content hash returned for audit linkage.
- ClamAV INSTREAM scanning before storage; production fails closed if scanning is unavailable.
- SVG, HTML and JavaScript are rejected; non-inline-safe files download as attachments.
- `nosniff`, sandbox CSP and private cache headers on downloads.
- Disk adapter rejects path traversal and refuses accidental overwrite.
- S3 SDK is part of the production dependency set.
- The worker deletes expired objects and retains expired metadata for audit; failed deletes remain inaccessible and are retried.

## Abuse and async work

Upload rate limiting is a PostgreSQL-backed token bucket, so limits hold across app replicas. Transcription runs in a separate worker and produces Inbox proposals rather than canonical graph writes. Mission assignment creates an in-app record and email outbox row in the same tenant transaction; the worker acknowledges a real provider response before delivery, retries with bounded exponential backoff and dead-letters repeated failures.

## Operational requirements

- TLS termination is mandatory outside a private development network.
- Use S3-compatible encrypted object storage and lifecycle policies for multi-host production.
- Back up PostgreSQL and object storage together; test restore quarterly.
- Rotate `AUTH_SECRET`, database passwords, storage credentials and AI keys.
- Never place real company content in logs, fixtures, screenshots or support tickets.

## Known boundary

User authentication identities are globally looked up by unique email before a tenant is known. That table contains only login identity, organization and authorization fields. Salary, contract, department, phone, biography and the canonical Person mapping live in the RLS-protected `user_profiles` table; full profile reads are limited to the subject or organization owner, and non-owners can edit only their name, phone and biography. Only owners can assign a Person mapping, and the application verifies that the target is a Person in the same tenant.
