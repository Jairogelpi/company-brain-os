# Company Brain OS web application

This directory contains the production Next.js application, worker, database schema and tests. The repository-level [README](../README.md) is the current setup and architecture guide; the accepted product contract is [Company Brain OS v4](../docs/product/COMPANY_BRAIN_OS_V4.md).

## Commands

```bash
npm ci
npm run dev
npm run typecheck
npm test -- --run
npm run test:e2e
npm run test:critical
npm run build
```

Database-backed integration tests require a migrated PostgreSQL 16 database with pgvector:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/company_brain_os \
  npx vitest --config test.integration.config.ts run
```

The canonical truth is the approved assertion/evidence ledger. `nodes` and `edges` are a deterministic, disposable projection; UI, AI and imports can only submit reviewed claims through the canonical writer.
