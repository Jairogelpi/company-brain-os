# Tasks — harden-test-coverage

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1200 (8 new test files, 2 new src modules, 1 refactor, fixtures, configs) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (infra + Gap 1 integration) → PR 2 (canvas-sync extraction) → PR 3 (auth + AI + verify) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

## Phase 1: Test infrastructure (testcontainers dep, vitest configs, npm script, gating)

1. - [ ] Add `testcontainers` and `@testcontainers/postgresql` to `web/package.json` devDependencies; run `npm --prefix web install`.
2. - [ ] Add `cross-env` devDep if missing (needed for `TESTCONTAINERS=1` script portability).
3. - [ ] Create `web/test.integration.config.ts` with `include: ["src/**/*.integration.test.ts"]`, `environment: "node"`, `@` alias (AC #2).
4. - [ ] Harden `web/vitest.config.ts` `include` to `["src/**/*.test.ts"]` and add `exclude: ["src/**/*.integration.test.ts"]` (AC #2/#18).
5. - [ ] Add `test:integration` npm script: `cross-env TESTCONTAINERS=1 vitest --config test.integration.config.ts run` (AC #3).
6. - [ ] Create `web/src/db/integration/setup.ts` exporting `startIntegrationDb()`, `shouldRunIntegration()`, `integrationSkipReason`, `describeIntegration()` wrapper per design.md.
7. - [ ] In `setup.ts`: start `pgvector/pgvector:pg16` container, `CREATE EXTENSION vector`, run `drizzle-kit push` once.
8. - [ ] In `setup.ts`: attempt `apt-get install postgresql-16-age` + `CREATE EXTENSION age`; on failure set `ageAvailable=false` with recorded reason (AC #8).
9. - [ ] Verify `npm --prefix web run test` still passes and does not pick up `.integration.test.ts` files (AC #18).

## Phase 2: Gap 2 canvas-sync extraction (TDD: test first, then extract, then delegate)

1. - [ ] RED: Create `web/src/canvas/canvas-sync.test.ts` with `FakeEditor` implementing `EditorLike`; assert create shape → `service.createNode` called with mapped fields (AC #9).
2. - [ ] RED: Add test — delete shape → `service.deleteNode(id)` called (AC #9).
3. - [ ] RED: Add test — service event → `syncToCanvas` reconciles shapes to `listNodes()/listEdges()` (AC #9).
4. - [ ] GREEN: Create `web/src/canvas/canvas-sync.ts` exporting `EditorLike`, `EditorLikeShape`, `createCanvasSync`, and re-exported helpers `parseNodeType`/`parseNodeName`/`readLabel`/id-mappers.
5. - [ ] TRIANGULATE: Add `dispose()` test asserting all handler unsubscribers fire and no further service calls occur.
6. - [ ] REFACTOR: Rewrite `GraphCanvas.tsx` `CanvasSync` to delegate to `createCanvasSync(editor, service)` per design.md (behavior-preserving) (AC #10).
7. - [ ] Verify existing `web/src/components/graph-canvas.test.ts` passes unchanged (AC #10).
8. - [ ] Run `npm --prefix web run typecheck` → exit 0 (AC #17).

## Phase 3: Gap 3 auth tests (auth-config, requireApiUser, authorize export refactor, authorize integration)

1. - [ ] Create `web/src/auth/auth-config.test.ts`: unit-test `authorized` redirect vs allow across `/login`, `/api/x`, `/dashboard` (AC #11).
2. - [ ] Add `jwt` callback test asserting `id/role/companyId/validationDomains` propagate; second call preserves token (AC #11).
3. - [ ] Add `session` callback test asserting `session.user.*` populated from token (AC #11).
4. - [ ] Refactor `web/src/server/auth/nextauth.ts` (or `auth/nextauth.ts`) to export `authorizeCredentials(credentials)` and pass it into `Credentials({ authorize: authorizeCredentials })`.
5. - [ ] Create `web/src/auth/requireApiUser.test.ts` with `vi.mock` of `auth()`; assert 401 null user, 403 disallowed operation, 200 allowed (AC #13).
6. - [ ] Create `web/src/auth/authorize.integration.test.ts`: gated via `describeIntegration`; seed bcrypt user via testcontainer DB; valid creds → user object, invalid password → null, unknown email → null (AC #12).

## Phase 4: Gap 4 AI contract tests (extraction edge fixtures, OCR fixture + test, transcription stub test)

1. - [ ] Add fixtures `web/test-fixtures/llm/{empty,partial,unicode,reasoning-wrapped}.json` per design.md (AC #14).
2. - [ ] Extend `web/src/ai/extraction.test.ts` to iterate the 4 fixtures through `parseSignals` asserting graceful handling (AC #14).
3. - [ ] Add `web/test-fixtures/ocr/sample.png` (200×40 "COMPANY BRAIN OS") and `web/test-fixtures/ocr/sample.txt` (`"hello world"`) (AC #15).
4. - [ ] Create `web/src/ai/ocr-pipeline.test.ts`: copy fixture into temp `UPLOAD_DIR`, run `processFile`, assert image→`method:"ocr"` non-empty text and `.txt`→`method:"text"` exact match (AC #15).
5. - [ ] Create `web/src/ai/transcription.test.ts`: `vi.stubEnv` forces stub; assert `createTranscriptionService()` returns stub whose `transcribe()` resolves to `TranscriptionResult` shape (AC #16).

## Phase 5: Gap 1 integration tests (setup, graph-repo integration, AGE smoke, pgvector round-trip)

1. - [ ] Create `web/src/db/integration/graph-repo.integration.test.ts` gated by `describeIntegration`; `beforeAll` starts container via `startIntegrationDb()` (AC #4).
2. - [ ] Add multi-tenant isolation test: companyA cannot read companyB nodes/edges/events (AC #4).
3. - [ ] Add `event_log` append-only ordering + no-UPDATE assertion (AC #5).
4. - [ ] Add FK cascade delete test: node delete cascades edges + event_log rows (AC #6).
5. - [ ] Add pgvector embedding round-trip within float32 tolerance (AC #7).
6. - [ ] Add AGE openCypher `MATCH (p:Person)-[:MASTERS]->(k:Knowledge) RETURN p,k` smoke; skip with reason when `ageAvailable=false` (AC #8).

## Phase 6: Verify (typecheck, unit test, integration test gated)

1. - [ ] Run `npm --prefix web run typecheck` → exit 0 (AC #17).
2. - [ ] Run `npm --prefix web run test` → exit 0, no integration files executed (AC #18).
3. - [ ] Run `npm --prefix web run test:integration` (Docker required) → integration suite passes or skips cleanly when Docker absent.
4. - [ ] Update `web/README.md` with integration test instructions + Docker Desktop note.
