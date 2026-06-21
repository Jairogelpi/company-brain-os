# F0 data strategy: Postgres + AGE, with relational truth first

The approved target is PostgreSQL with Apache AGE for graph traversal. F0 does not pretend that AGE is available locally or in the managed provider.

## Source of truth in F0

The canonical graph is stored in relational tables:

- `nodes`: closed universal node catalog (`Person`, `Knowledge`, `Process`, `Asset`, `Unit`, `Risk`).
- `edges`: closed relationship catalog (`MASTERS`, `LEARNS`, `REQUIRES`, `EXECUTES`, `PRODUCES`, `DEPENDS_ON`, `BELONGS_TO`).
- `node_layout`: canvas render metadata only, never business truth.
- `event_log`: append-only audit stream and future node timeline source.

This keeps tests and development independent of a live database while preserving the graph-as-truth architecture.

## AGE expectation

When Postgres is provisioned, verify AGE explicitly before adding graph traversal migrations:

```sql
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
```

If the provider does not support AGE, keep `nodes` and `edges` as the production graph store. For SME-scale graphs, relational traversal is enough for the MVP and avoids a second database.

## Drizzle

The migration-ready schema lives in `src/db/schema.ts`. Generate SQL with:

```bash
npm run db:generate
```

Requires `DATABASE_URL` only when pushing/running migrations against a real database.
