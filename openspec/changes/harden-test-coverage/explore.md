# Explore — harden-test-coverage

## Gap 1: DB/AGE/pgvector integration

**Current state:** Every persistent test uses `createInMemoryGraphRepository()` (`web/src/db/repository.ts:252`). The real `createDrizzleGraphRepository` (`repository.ts:147`) — which enforces multi-tenant `companyId` scoping (`repository.ts:151-154`, `scopeNode`/`scopeEdge`), append-only `event_log` writes (`repository.ts:237`), and FK cascade deletes (`schema.ts:38-41`) — has zero integration coverage. `web/src/server/graph.ts:17` wires the Drizzle repo into production but is never tested against a real DB. AGE (`web/docs/age-setup.sql`) and pgvector (`schema.ts:83-93`, `nodeEmbeddings`) are not exercised at all.

**Infra options:**

1. **Testcontainers (recommended for CI):** `testcontainers-node` spins a `pgvector/pgvector:pg16` container per run (matches `docker-compose.prod.yml:4`). AGE requires `apt-get install postgresql-16-age` inside the container — testcontainers supports custom init SQL via bind mount. Pragmatic on Linux CI; on Windows dev, Docker Desktop is required (already needed for prod compose).
2. **docker-compose test profile:** Add `docker-compose.test.yml` reusing the pgvector image + a one-shot migrate. Simpler than testcontainers but requires manual `docker compose up` before `npm test`. Doesn't isolate per-run.
3. **External dev Postgres only:** Skip CI integration; gate tests behind `DATABASE_URL` env presence (like `smoke.test.ts` does with `OPENCODE_API_KEY` at `smoke.test.ts:16`). Lowest friction, weakest guarantee.

**Recommended:** testcontainers for CI + env-gated fallback for local. Integration tests live in `web/src/db/integration/*.test.ts`, excluded from default `vitest.config.ts:4` include glob via a separate `integration` project entry or `test.integration.config.ts`.

**What to test:** multi-tenant isolation (companyA can't see companyB nodes/edges/events), append-only event_log ordering, FK cascade on node delete, pgvector embedding round-trip, AGE openCypher path query (e.g. `MATCH (p:Person)-[:MASTERS]->(k:Knowledge) RETURN p,k`).

## Gap 2: F2/F4 canvas+realtime

**Current state:** `graph-canvas.test.ts` tests only pure mapping functions (`nodeToShape`, `edgeToShape`, `getNodeColor`) — no tldraw editor, no write-back. `interview-chat.test.ts` tests the in-memory `GraphService` event log (`graph-service.ts:236`) but never touches `GraphCanvas.tsx`. The actual write-back lives in `GraphCanvas.tsx:158-230`: `registerAfterCreateHandler`/`registerAfterChangeHandler`/`registerBeforeDeleteHandler` calling `service.createNode`/`updateNode`/`deleteNode`. The `syncToCanvas` function (`GraphCanvas.tsx:111-157`) reads `service.listNodes()`/`listEdges()` and calls `editor.createShapes`/`deleteShapes`.

**Minimal contract test approach:** tldraw's `useEditor()` requires a `<Editor>` React context. Two options:

1. **jsdom + `@tldraw/tldraw` test harness:** Render `<CanvasSync>` inside a tldraw `<Editor>` with jsdom environment. Requires `happy-dom` or `jsdom` vitest env + `@testing-library/react`. Heavy but exercises real side-effect handlers.
2. **Fake editor host (recommended):** Define a minimal `FakeEditor` implementing only `getCurrentPageShapes()`, `createShapes()`, `deleteShapes()`, and `sideEffects.register*Handler()` — the 4 methods `CanvasSync` calls. Extract `CanvasSync` logic into a testable `createCanvasSync(editor, service)` function (pure, no React). Test: create shape → service.createNode called; delete shape → service.deleteNode called; service event → syncToCanvas reconciles shapes. No DOM needed.

**Recommended:** Option 2 — extract and test the sync controller as a pure unit. This is the actual contract; the React glue is thin.

## Gap 3: F13 auth flow

**Current state:** `permissions.test.ts` tests pure RBAC functions only. `auth/config.ts` (edge-safe, `authorized` callback at `config.ts:47-57`), `auth/nextauth.ts` (Credentials provider + bcrypt + DB query at `nextauth.ts:21-49`), `auth/api-guard.ts` (`requireApiUser`), and `middleware.ts` are untested.

**next-auth v5 beta test strategy:** Auth.js v5 (`next-auth@5.0.0-beta.31`, `package.json:24`) exposes `signIn`/`signOut` server actions and `auth()` session reader. No official test helpers, but:

1. **Unit-test the `authorized` callback directly** (`config.ts:47`): pass mock `{ auth, request }` objects, assert redirect vs allow. Pure function, no HTTP needed.
2. **Unit-test the `jwt`/`session` callbacks** (`config.ts:21-43`): pass mock token/user, assert fields propagate. Pure.
3. **Integration-test `authorize` in `nextauth.ts:26`:** Needs a real DB (ties to Gap 1 testcontainers) with a seeded user + bcrypt hash. Call `authorize({email, password})` directly, assert returns user object or null. No HTTP stack needed.
4. **`requireApiUser` integration** (`api-guard.ts:14`): mock `auth()` to return session or null, assert 401/403/200.

**Recommended:** Steps 1-2 as pure unit tests (no infra). Steps 3-4 as integration tests gated on `DATABASE_URL`. No full HTTP test needed — Auth.js v5 callbacks are directly callable.

## Gap 4: AI paths

**Current state:** `extraction.test.ts` mocks `client.chatCompletion` (`extraction.test.ts:51`) — tests parsing, not LLM behavior. `smoke.test.ts` calls real API but is skipped without `OPENCODE_API_KEY` (`smoke.test.ts:16`). `infrastructure.test.ts:46` only checks `processFile` is a function. `transcription.ts` and `ocr-pipeline.ts` are stubs (`transcription.ts:14-32` StubTranscriptionService, `ocr-pipeline.ts:107-114` transcribeWithWhisper stub).

**Strategy — contract tests with canned JSON (recommended):**
The extraction contract is the JSON schema that `parseSignals` expects (personName, knowledgeName, critical, documented, etc.). Test against:

1. **Canned LLM JSON fixtures** (already done in `extraction.test.ts` — extend with edge cases: empty response, partial fields, unicode, reasoning-before-JSON wrapping).
2. **Record/replay** adds maintenance burden and brittle coupling to a specific LLM version. Skip for now; the smoke test covers real-API validation when a key is present.
3. **OCR:** Test `processFile` (`ocr-pipeline.ts:31`) with a fixture image in `web/test-fixtures/ocr/` — Tesseract.js works in Node, no external service. Test text/markdown path with a fixture `.txt`.
4. **Transcription:** The stub is the contract. Test that `createTranscriptionService()` returns stub when Ollama unreachable, and that the stub output format matches `TranscriptionResult` interface (`transcription.ts:1-6`). Real Whisper is out of scope.

## Test infrastructure to create

| File | Purpose |
|------|---------|
| `web/test.integration.config.ts` | Vitest config for integration project (separate from unit `vitest.config.ts:1`) |
| `web/src/db/integration/setup.ts` | testcontainers Postgres+AGE+pgvector bootstrap, runs `drizzle-kit push` |
| `web/src/db/integration/graph-repo.integration.test.ts` | Gap 1: multi-tenant, event_log, cascade, pgvector |
| `web/src/canvas/canvas-sync.ts` | Extracted pure sync controller from `GraphCanvas.tsx` |
| `web/src/canvas/canvas-sync.test.ts` | Gap 2: fake editor + service write-back contract |
| `web/src/auth/auth-config.test.ts` | Gap 3: authorized/jwt/session callback unit tests |
| `web/src/auth/authorize.integration.test.ts` | Gap 3: Credentials authorize with seeded DB |
| `web/test-fixtures/ocr/sample.png` + `.txt` | Gap 4: OCR/text-extraction fixtures |
| `web/test-fixtures/llm/*.json` | Gap 4: canned LLM response fixtures for edge cases |
| `web/package.json` devDeps | `testcontainers`, `happy-dom` or `jsdom` (if React canvas test) |

## Out of scope

- Playwright E2E (login → canvas → interview full browser flow)
- Load/stress tests
- Real Whisper API integration tests
- AGE openCypher query layer beyond a smoke path query (no AGE query module exists yet in `src/`)

## Open questions for proposal

1. Is `testcontainers` acceptable as a devDependency, or should integration tests use an external Docker compose only (CI-driven)?
2. Should the canvas sync controller extraction (`canvas-sync.ts`) be a refactor task in the proposal, or is modifying `GraphCanvas.tsx` in-scope for this hardening change?
3. AGE has no query module in `src/` yet — is a minimal openCypher path-query smoke test sufficient, or should we defer AGE tests until the AGE query layer is built?
4. Should integration tests run in the default `npm test` command (gated by env) or be a separate `npm run test:integration` script?
