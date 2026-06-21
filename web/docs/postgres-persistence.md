# Postgres + AGE Persistence

The F1 Graph Service now supports real database persistence through PostgreSQL with Apache AGE.

## Architecture

```
┌─────────────────────────────────────────┐
│  PersistentGraphService (domain)        │
│  - validate-then-commit                 │
│  - event log append-only                │
│  - cascade deletes                      │
│  - proposal integration                 │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  GraphRepository (interface)            │
│  - createNode / readNode / ...          │
│  - createEdge / readEdge / ...          │
│  - saveEvent / listEvents               │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┴──────────┐
     │                    │
┌────▼──────────┐  ┌──────▼──────────────┐
│ Drizzle Repo  │  │ In-Memory Repo      │
│ (production)  │  │ (tests, demo)       │
│ PostgreSQL    │  │ Map<string, Node>   │
└───────────────┘  └─────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `src/db/index.ts` | Database connection factory (`createDb`) |
| `src/db/schema.ts` | Drizzle schema: `nodes`, `edges`, `node_layout`, `event_log` |
| `src/db/repository.ts` | `GraphRepository` interface + Drizzle impl + in-memory fallback |
| `src/domain/persistent-graph-service.ts` | `PersistentGraphService` backed by repository (async) |
| `src/domain/graph-service.ts` | Original sync `GraphService` (in-memory, unchanged) |

## In-Memory vs Persistent

- **`GraphService` (sync)**: Used by F0.5/F1/F2 code. In-memory Maps. No DB dependency.
- **`PersistentGraphService` (async)**: New. Backed by `GraphRepository`. Validates and commits to DB.

Both implement the same semantic contract: validate-then-commit, event log, cascade deletes, idempotency.

## Setup

### 1. Start PostgreSQL with AGE

```bash
docker run -d --name company-brain-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=company_brain_os \
  -p 5432:5432 \
  apache/age:latest
```

### 2. Enable AGE extension

```sql
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
```

### 3. Run migrations

```bash
npm run db:generate  # Generate SQL
npm run db:push      # Apply to DB (requires DATABASE_URL)
```

### 4. Connection string

Default: `postgres://postgres:postgres@localhost:5432/company_brain_os`

Override via `DATABASE_URL` env var.

## AGE Integration Points

The AGE extension is installed and the `ag_graph` catalog is available. Graph traversal queries (for F5 Metrics, F6 Risk) will use AGE's Cypher-compatible queries against the `nodes` and `edges` tables. Current F1 uses standard PostgreSQL queries via Drizzle.

AGE graph creation (future):

```sql
SELECT * FROM ag_catalog.create_graph('company_brain');
```

## Text IDs

All primary keys use `text` type to match the domain's string-based ID contract (e.g., `"node-person-pedro"`). No UUID mapping layer. This is intentional: the domain is the source of truth; the database adapts.

## Testing

Tests use `createInMemoryGraphRepository()` — no real DB needed. The full test suite (88 tests across 6 files) passes against the in-memory fallback.
