# Proposal — harden-test-coverage

## Problem statement

Four core contracts in Company Brain OS have zero or shallow test coverage despite being on the critical production path:

1. **DB / Apache AGE / pgvector** — `createDrizzleGraphRepository` (`web/src/db/repository.ts:147`) enforces multi-tenant `companyId` scoping, append-only `event_log` writes, and FK cascade deletes. Every persistent test uses `createInMemoryGraphRepository()` instead. AGE and pgvector are never exercised.
2. **Canvas sync (F2/F4)** — The write-back logic in `GraphCanvas.tsx:158-230` (`registerAfterCreateHandler` / `registerAfterChangeHandler` / `registerBeforeDeleteHandler`) and `syncToCanvas` (`GraphCanvas.tsx:111-157`) is untested. Existing tests cover only pure shape mappers.
3. **Auth flow (F13)** — `auth/config.ts` (`authorized` / `jwt` / `session` callbacks), `auth/nextauth.ts` (`authorize` Credentials provider), and `auth/api-guard.ts` (`requireApiUser`) are untested. Only pure RBAC functions are covered.
4. **AI paths** — `extraction.test.ts` tests parsing with a single canned response; edge cases (empty, partial, unicode, reasoning-wrapped JSON) are missing. `ocr-pipeline.ts` `processFile` and `transcription.ts` stub are untested.

## Proposed solution

**Gap 1 — DB/AGE/pgvector integration via testcontainers.** Add `testcontainers` devDep. Spin `pgvector/pgvector:pg16` container per run (matches `docker-compose.prod.yml:4`) with AGE installed via init SQL. Tests in `web/src/db/integration/*.test.ts` using a separate `web/test.integration.config.ts`. Run via `npm run test:integration`, gated by `DATABASE_URL` or `TESTCONTAINERS` env so default `npm test` is unaffected. Coverage: multi-tenant isolation, append-only `event_log` ordering, FK cascade on node delete, pgvector embedding round-trip, AGE openCypher path-query smoke (`MATCH (p:Person)-[:MASTERS]->(k:Knowledge) RETURN p,k`).

**Gap 2 — Canvas sync extraction (REFACTOR + test).** Extract a pure `createCanvasSync(editor, service)` controller from `GraphCanvas.tsx` into `web/src/canvas/canvas-sync.ts`. TDD: write `canvas-sync.test.ts` first defining the contract (create shape → `service.createNode`; delete shape → `service.deleteNode`; service event → reconcile shapes), then extract. Use a `FakeEditor` stub (no DOM, no tldraw, no `happy-dom`). `GraphCanvas.tsx` is refactored to delegate to the extracted controller — **flagged as a refactor touching production code**.

**Gap 3 — Auth callback tests.** Unit-test `authorized`, `jwt`, `session` callbacks as pure functions (`auth-config.test.ts`, no infra). Integration-test `authorize()` with seeded DB (`authorize.integration.test.ts`, gated). Test `requireApiUser` with mocked `auth()`.

**Gap 4 — AI contract fixtures.** Extend `extraction.test.ts` with canned JSON edge cases (empty, partial fields, unicode, reasoning-before-JSON). Add OCR fixture image + `.txt` fixture; test `processFile` (Tesseract.js works in Node). Add transcription stub contract test asserting `TranscriptionResult` shape.

**Infra:** devDeps `testcontainers`; npm script `test:integration`. Prefer `FakeEditor` to avoid `happy-dom`.

## Scope

**In:** 4 test gaps + test infrastructure (testcontainers config, integration vitest config, `test:integration` script, fixtures, canvas-sync extraction).

**Out:** Playwright E2E, load/stress tests, real Whisper API integration, AGE query module beyond a smoke path query (no AGE query module exists in `src/` yet).

## Success criteria

- Integration tests pass in CI via `npm run test:integration` (testcontainers).
- `canvas-sync.ts` contract verified by `FakeEditor` tests; `GraphCanvas.tsx` delegates to it with no behavior change.
- Auth `authorized`/`jwt`/`session` callbacks covered by pure unit tests; `authorize()` covered by gated integration test.
- AI extraction edge cases covered; OCR `processFile` tested with fixture; transcription stub contract verified.
- Default `npm test` still passes and does not run integration tests.
- `npm --prefix web run typecheck` passes after canvas-sync extraction.

## Risks

- **testcontainers on Windows dev** requires Docker Desktop running (already needed for prod compose). CI on Linux is unaffected.
- **canvas-sync extraction is a refactor** touching `GraphCanvas.tsx` — risk of behavior drift mitigated by TDD (tests first) and thin React glue.
- **AGE in testcontainers** requires custom init SQL (`apt-get install postgresql-16-age`); if the image lacks AGE packages, fall back to pgvector-only integration and defer AGE smoke.
- **next-auth v5 beta** has no official test helpers — callbacks are directly callable, but beta API churn could require test updates.

## Rollback

- Revert `canvas-sync.ts` extraction; `GraphCanvas.tsx` retains original inline logic.
- Remove `test.integration.config.ts`, `web/src/db/integration/`, `test:integration` script, `testcontainers` devDep.
- Remove added test files and fixtures.
- No production behavior changes beyond the canvas-sync extraction (which is behavior-preserving).
