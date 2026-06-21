# Spec — harden-test-coverage

> **Domain note:** The proposal has no `Capabilities` section. Affected domains are
> inferred from the four gaps (`db-integration`, `canvas-sync`, `auth`, `ai-paths`).
> No canonical `openspec/specs/{domain}/spec.md` exists for any of them, so this is
> a full new spec, not a delta. **Risk:** if the parent intends delta semantics,
> canonical specs must be authored first.

## Requirements

### Requirement: DB/AGE/pgvector Integration Suite

The system MUST provide an integration test suite that spins a real
`pgvector/pgvector:pg16` Postgres container with Apache AGE installed, runs the
Drizzle migration, and exercises `createDrizzleGraphRepository` against it.

- **R1.1** `testcontainers` MUST be a devDependency.
- **R1.2** A separate `web/test.integration.config.ts` vitest config MUST exist
  and exclude integration files from the default unit `vitest.config.ts`.
- **R1.3** `npm run test:integration` MUST run the integration suite; default
  `npm test` MUST NOT run integration tests.
- **R1.4** Integration tests MUST be gated (skip when Docker/`TESTCONTAINERS` is
  absent) so CI Linux runs them and local Windows without Docker skips cleanly.

#### Scenario: Multi-tenant isolation

- GIVEN companyA and companyB each have nodes, edges, and event_log rows
- WHEN `createDrizzleGraphRepository({ companyId: companyA })` lists nodes/edges/events
- THEN only companyA rows are returned; companyB rows are never visible.

#### Scenario: Append-only event_log ordering

- GIVEN two events are appended for the same tenant
- WHEN the event_log is read ordered by `createdAt`
- THEN order matches insertion and no UPDATE path exists on `event_log`.

#### Scenario: FK cascade delete

- GIVEN a node with dependent edges and event_log rows
- WHEN the node is deleted
- THEN dependent edges cascade-delete and `event_log` rows cascade per schema.

#### Scenario: pgvector embedding round-trip

- GIVEN a node embedding is written as a float vector
- WHEN it is read back
- THEN the vector round-trips with no precision loss beyond float32 tolerance.

#### Scenario: AGE openCypher path-query smoke

- GIVEN a Person node and Knowledge node linked by a MASTERS edge in AGE
- WHEN `MATCH (p:Person)-[:MASTERS]->(k:Knowledge) RETURN p,k` is executed
- THEN the matching pair is returned.
- IF the AGE extension cannot be installed in the container, the AGE scenario
  MUST skip with a recorded reason (pgvector-only fallback), per proposal risk.

### Requirement: Canvas Sync Controller Extraction

The system MUST extract write-back logic from `GraphCanvas.tsx` into a pure
`createCanvasSync(editor, service)` controller at `web/src/canvas/canvas-sync.ts`
and verify it with a `FakeEditor` (no DOM, no tldraw, no `happy-dom`).

#### Scenario: Create shape writes node

- GIVEN a `FakeEditor` and a `GraphService` spy
- WHEN a shape is created on the editor
- THEN `service.createNode` is called with mapped node fields.

#### Scenario: Delete shape deletes node

- WHEN a shape is deleted on the editor
- THEN `service.deleteNode` is called for the corresponding node id.

#### Scenario: Service event reconciles canvas

- WHEN the service emits an event (node added/removed)
- THEN `syncToCanvas` reconciles editor shapes to match `service.listNodes()`/`listEdges()`.

#### Scenario: GraphCanvas delegates with no behavior change

- GIVEN `GraphCanvas.tsx` delegates to `createCanvasSync`
- WHEN the existing `graph-canvas.test.ts` mapping tests run
- THEN they pass unchanged (no behavior drift).

### Requirement: Auth Callback Coverage

The system MUST cover `auth/config.ts` (`authorized`, `jwt`, `session`) as pure
unit tests, `requireApiUser` with mocked `auth()`, and `authorize()` via a
gated seeded-DB integration test.

#### Scenario: authorized redirect vs allow

- GIVEN a request without session and a request with session
- WHEN the `authorized` callback is invoked
- THEN it redirects unauthenticated users and allows authenticated users.

#### Scenario: jwt/session field propagation

- GIVEN a mock token/user with role and companyId
- WHEN `jwt` then `session` callbacks run
- THEN the session exposes role and companyId.

#### Scenario: authorize() seeded-DB integration (gated)

- GIVEN a seeded user with bcrypt hash in the testcontainer DB
- WHEN `authorize({ email, password })` is called with valid then invalid creds
- THEN it returns the user object on valid and null on invalid.
- IF `DATABASE_URL`/`TESTCONTAINERS` is absent, the scenario MUST skip.

#### Scenario: requireApiUser 401/403/200

- GIVEN `auth()` mocked to return null, a session without permission, a session with permission
- WHEN `requireApiUser` runs
- THEN it returns 401, 403, and 200 respectively.

### Requirement: AI Path Contract Tests

The system MUST extend extraction parsing tests with edge-case canned JSON
fixtures, test `ocr-pipeline.processFile` with a fixture image, and assert the
transcription stub returns a `TranscriptionResult`-shaped object.

#### Scenario: Extraction edge cases

- GIVEN fixtures for empty response, partial fields, unicode payload, and
  reasoning-wrapped JSON
- WHEN `parseSignals` processes each
- THEN it handles gracefully (returns safe defaults or parses correctly) without
  throwing.

#### Scenario: OCR processFile with fixture

- GIVEN a small fixture image containing text and a `.txt` fixture
- WHEN `processFile` runs on each
- THEN extracted text is non-empty for the image and matches for the `.txt`.

#### Scenario: Transcription stub contract

- GIVEN `createTranscriptionService()` returns the stub
- WHEN it transcribes a fixture
- THEN the result satisfies `TranscriptionResult` (text, segments, duration).

### Requirement: Typecheck After Extraction

`npm --prefix web run typecheck` MUST pass after `canvas-sync.ts` extraction and
`GraphCanvas.tsx` delegation.

#### Scenario: typecheck green

- WHEN `npm --prefix web run typecheck` runs
- THEN it exits 0 with no new errors.

## Acceptance criteria (numbered, testable)

1. `testcontainers` appears in `web/package.json` devDependencies.
2. `web/test.integration.config.ts` exists and the default `vitest.config.ts`
   excludes `**/integration/**`.
3. `npm run test:integration` runs the integration suite; `npm test` does not
   execute any `*.integration.test.ts` file.
4. Integration test asserts companyA cannot read companyB nodes/edges/events.
5. Integration test asserts `event_log` insertion ordering and no-UPDATE.
6. Integration test asserts FK cascade delete of edges and event_log on node delete.
7. Integration test asserts pgvector embedding round-trip within float32 tolerance.
8. AGE openCypher path-query smoke runs or skips with a recorded reason.
9. `web/src/canvas/canvas-sync.ts` exports `createCanvasSync`; `canvas-sync.test.ts`
   asserts create→`createNode`, delete→`deleteNode`, event→reconcile.
10. `GraphCanvas.tsx` delegates to `createCanvasSync`; existing
    `graph-canvas.test.ts` tests pass unchanged.
11. `auth-config.test.ts` covers `authorized`, `jwt`, `session` as pure functions.
12. `authorize.integration.test.ts` covers valid/invalid creds, gated on env.
13. `requireApiUser` test asserts 401/403/200 with mocked `auth()`.
14. Extraction tests include empty, partial, unicode, and reasoning-wrapped fixtures.
15. OCR `processFile` test runs against `web/test-fixtures/ocr/` fixtures.
16. Transcription stub test asserts `TranscriptionResult` shape.
17. `npm --prefix web run typecheck` exits 0 after canvas-sync extraction.
18. `npm --prefix web run test` exits 0 with no integration tests executed.

## Non-goals

- Playwright / browser E2E (login → canvas → interview).
- Load, stress, or fuzz tests.
- Real Whisper API or real LLM calls in CI.
- AGE query module beyond a single openCypher path-query smoke.
- Coverage thresholds or coverage reporting tooling.
- Migrating existing unit tests to integration tests.

## Test plan

- **Unit (default `npm test`):** `canvas-sync.test.ts` (FakeEditor),
  `auth-config.test.ts` (pure callbacks), `requireApiUser` test (mocked
  `auth()`), extended `extraction.test.ts` edge cases, OCR `processFile` test,
  transcription stub test, existing `graph-canvas.test.ts` regression.
- **Integration (`npm run test:integration`, gated):**
  `graph-repo.integration.test.ts` (multi-tenant, event_log, cascade, pgvector,
  AGE smoke), `authorize.integration.test.ts` (seeded DB).
- **Static:** `npm --prefix web run typecheck` after extraction.
- **Fixtures:** `web/test-fixtures/ocr/{sample.png,sample.txt}`,
  `web/test-fixtures/llm/*.json` edge-case canned responses.
- **Gating:** integration suite skips when Docker/`TESTCONTAINERS` is absent;
  default `npm test` never invokes the integration config.
