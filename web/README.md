# Company Brain OS Web

Next.js F0 scaffold for Company Brain OS.

## What exists in F0

- Next.js App Router + TypeScript app.
- Tailwind CSS styling with a minimal shadcn/ui-compatible `Button`.
- Universal graph domain model: 6 node types, 7 edge types, `knowledge_type`, and `confidence`.
- Invariant validation for closed catalogs and permitted edge endpoints.
- F0.5 adaptive interview engine: one-question-at-a-time probes, deepen/widen policy, graph operation proposals, and first-alarm detection.
- F1/F3 boundary confirmation layer: approve/reject proposed graph operations, validate the resulting graph, and emit append-only events.
- F1 Graph Service: deterministic in-memory CRUD for nodes and edges, cascade delete, validation gate, and append-only mutation audit log shaped for the `event_log` table.
- F2 Canvas: tldraw interactive graph canvas rendering confirmed interview data, color-coded by node type, with bidirectional sync to GraphService.
- F3 LLM extraction: OpenCode Go (GLM-5.2) for entity extraction in the adaptive interview engine, with heuristic fallback.
- F4 Canvas↔Chat sync: unified `/dashboard` page with GraphCanvas and InterviewChat sharing one GraphService; canvas edits appear in the chat event log and interview proposals trigger canvas re-sync.
- Drizzle schema for `nodes`, `edges`, `node_layout`, and append-only `event_log` (text IDs, aligned with domain contract).
- Postgres + Apache AGE persistence: `PersistentGraphService` backed by Drizzle repository; Docker container provisioned.
- In-memory repository fallback for fast unit tests (no DB needed).
- Self-serve email/password signup: creates a company and owner user.
- Split unit/integration test setup: unit tests exclude `*.integration.test.ts`; integration tests use Testcontainers.

## What is intentionally skipped

Missions, real-time collaboration, and persisted canvas layout are still future work. OCR/transcription integrations keep explicit fallback/stub behavior when external providers are unavailable.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test -- --run
npm run test:integration
npm run build
```

## Data strategy

Target: Postgres + Apache AGE.

F0 source of truth: relational `nodes` and `edges` tables (text IDs, no UUID layer).

### Integration tests

```bash
# Requires Docker Desktop / Docker Engine.
npm run test:integration
```

Integration tests start a disposable `pgvector/pgvector:pg16` container with Testcontainers, initialize `vector`, attempt Apache AGE, and apply the Drizzle schema. If AGE is unavailable, AGE-specific checks report a non-blocking skip reason. If Docker Desktop is not running or its Linux engine is broken, fix Docker first and rerun this command.

Regular `npm test` intentionally excludes `src/**/*.integration.test.ts` so local unit feedback stays fast and DB-free.

### Running with PostgreSQL

```bash
# Start Postgres + AGE container
docker run -d --name company-brain-db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=company_brain_os -p 5432:5432 \
  apache/age:latest

# Apply migration
npm run db:generate
DATABASE_URL=postgres://postgres:postgres@localhost:5432/company_brain_os npm run db:push
```

See [`docs/postgres-persistence.md`](./docs/postgres-persistence.md), [`docs/data-strategy.md`](./docs/data-strategy.md), [`docs/f05-interview.md`](./docs/f05-interview.md), [`docs/graph-confirmation.md`](./docs/graph-confirmation.md), and [`docs/f2-canvas.md`](./docs/f2-canvas.md).
