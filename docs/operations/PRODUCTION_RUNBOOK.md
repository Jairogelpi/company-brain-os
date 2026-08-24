# Production runbook

## Release gate

Before release, require green CI for migrations, unit tests, canonical E2E, critical coverage, tenant isolation, typecheck and production build. Deploy an immutable image digest and record the migration version.

## Start and verify

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 migrate provision-app-role clamav app worker
```

Expected services: `postgres`, completed `migrate`, completed `provision-app-role`, healthy `clamav`, running `app`, running `worker`.

Smoke test with a newly created organization, never a seeded production tenant:

1. Register the first owner.
2. Capture a statement and verify it reaches Inbox.
3. Approve it and verify projected rows show provenance.
4. Upload the EICAR test file in an isolated test environment and verify rejection.
5. In Settings, map the assessor, backup and reviewer logins to distinct canonical Person nodes; complete the Pedro/Laura journey and verify documentation alone does not close dependency risk.
6. Assign a mission, verify the in-app bell, and confirm the email provider receives exactly one idempotent delivery request.

If email is enabled, configure `NOTIFICATION_EMAIL_WEBHOOK_URL` and `NOTIFICATION_EMAIL_WEBHOOK_TOKEN`. Missing provider configuration leaves email rows failed/retryable; it never marks them delivered.

## Backup and restore

- PostgreSQL: encrypted daily full backup plus point-in-time WAL retention appropriate to the contract.
- Object storage: versioning or equivalent protection and lifecycle policies matching customer retention.
- Keep database and object snapshots under the same recovery point label.
- Quarterly restore test: restore into an isolated environment, run migrations in check mode and execute the canonical E2E.

Define customer-specific RPO/RTO in the order form. A sensible pilot target is RPO 24 hours and RTO 8 hours; do not promise a tighter SLA without measured restore evidence.

## Upgrade note: explicit Person identity

Migration `0026` auto-maps only unique exact user/Person name matches. It deliberately stops if an already approved transfer cannot be given explicit assessor and reviewer Person identities. Resolve ambiguous legacy identities in a tested copy before the production migration; do not invent mappings merely to make the constraint pass.

## Incident sequence

1. Contain: disable affected credentials or route, preserve evidence and avoid destructive cleanup.
2. Scope: organizations, records, time window and data classes.
3. Eradicate and recover from a verified point.
4. Notify according to contract and applicable law.
5. Write a blameless post-incident report with corrective tests and owners.

## Rollback

Application images may roll back only when the previous version is compatible with the current schema. Database migrations are forward-only; use a corrective migration rather than deleting production data. Restore is the last resort and requires explicit incident authority.
