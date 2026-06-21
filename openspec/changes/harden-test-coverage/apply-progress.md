# Apply Progress — harden-test-coverage

## Status

In progress / implemented primary coverage hardening slices.

## Implemented

### Test infrastructure

- Added dev dependencies: `cross-env`, `testcontainers`, `@testcontainers/postgresql`.
- Added `web/test.integration.config.ts` for `src/**/*.integration.test.ts`.
- Updated `web/vitest.config.ts` so regular unit tests exclude integration tests.
- Added `npm run test:integration` script.
- Added `web/src/db/integration/setup.ts` to start `pgvector/pgvector:pg16`, create `vector`, attempt `age`, run Drizzle schema push, and expose skip metadata.
- Added `web/src/db/integration/db-extensions.integration.test.ts` covering pgvector vector distance, AGE availability/skip reason, and core schema table creation.
- Updated `web/README.md` with integration test/Docker notes.

### Canvas sync extraction

- Added RED/GREEN tests in `web/src/canvas/canvas-sync.test.ts` for create, delete, service-to-canvas sync, and handler disposal.
- Added `web/src/canvas/canvas-sync.ts` with `EditorLike`, `EditorLikeShape`, `createCanvasSync`, helpers, id mappers, and `dispose()`.
- Refactored `web/src/canvas/GraphCanvas.tsx` to delegate sync/write-back behavior to `createCanvasSync()` while preserving tldraw richText label reading in the React adapter.

### Auth coverage

- Added `web/src/auth/config.test.ts` for `jwt`, `session`, and `authorized` callbacks including public `/register` and API route behavior.
- Extracted `authorizeCredentials()` to pure module `web/src/auth/authorize.ts` and wired it into `web/src/auth/nextauth.ts`.
- Added `web/src/auth/authorize.test.ts` covering missing credentials, unknown email, invalid password, and valid user payload.
- Added `web/src/auth/requireApiUser.test.ts` covering 401 unauthenticated, 403 forbidden, and allowed owner operation.

### AI / OCR / transcription coverage

- Added `web/src/ai/ocr-transcription.test.ts` for text extraction, unsupported audio/video placeholders, unsupported binary placeholders, Whisper stub text, and transcription fallback when Ollama is unavailable.

## Verification evidence

- Focused canvas suite: `2 passed files, 17 passed tests`.
- Focused auth suite: `3 passed files, 11 passed tests`.
- Focused AI/OCR suite: `2 passed files, 12 passed tests`.
- Integration suite: `1 passed file, 3 passed tests`.
- Full unit suite after all hardening changes: `39 passed files, 1 skipped file, 350 passed tests, 3 skipped tests`.
- `npm run typecheck`: passed.
- LSP diagnostics on touched infra/canvas/auth/AI files: clean after hint cleanup.

## Residual notes

- `npm install` reports 7 moderate npm audit findings; no `npm audit fix --force` was run because it could introduce unrelated breaking dependency changes.
- AGE integration is intentionally non-blocking when the container image lacks AGE.
