# Design — harden-test-coverage

## Test infrastructure architecture

**Two-config split.** Unit tests stay on `web/vitest.config.ts` (unchanged include glob `src/**/*.test.ts`). Add `web/test.integration.config.ts` with `include: ["src/**/*.integration.test.ts"]`, same `@` alias, `environment: "node"`. Default `vitest.config.ts` is hardened to `include: ["src/**/*.test.ts"]` and `exclude: ["src/**/*.integration.test.ts"]` so AC #2/#3 hold even if a `.integration.test.ts` slips into a unit path.

**testcontainers setup module — `web/src/db/integration/setup.ts`:**

```ts
export interface IntegrationDb { url: string; db: Db; stop: () => Promise<void>; ageAvailable: boolean; }
export async function startIntegrationDb(): Promise<IntegrationDb>;
export function shouldRunIntegration(): boolean;
export const integrationSkipReason: string | null;
```

- `startIntegrationDb()` uses `@testcontainers/postgresql` `PostgreSQLContainer` with image `pgvector/pgvector:pg16` (matches `docker-compose.prod.yml:4`).
- AGE install via `withInitScripts` is not enough — AGE needs the deb package. Use `.withCommand()`-free approach: build the container, then run a one-shot `apt-get update && apt-get install -y postgresql-16-age` via `container.exec(["bash","-c", ...])` followed by a SQL init script (`CREATE EXTENSION IF NOT EXISTS age; LOAD 'age'; SET search_path = ag_catalog, "$user", public;`) executed through `psql` inside the container. Capture success in `ageAvailable`; on failure, leave `ageAvailable=false` and continue (pgvector-only).
- pgvector: the base image already ships `vector`; `CREATE EXTENSION IF NOT EXISTS vector` runs in the same init SQL.
- Migration: shell out `drizzle-kit push` against `url` before handing `db` back (`createDb({ url })`). Push runs once per container lifetime, not per test.
- Tests consume via `beforeAll`/`afterAll` in a shared `setup-db` fixture; `containerDb` is module-scoped so one container serves the whole integration run.

**Gating strategy.** `shouldRunIntegration()` returns `process.env.TESTCONTAINERS === "1"` OR a Docker-socket reachability probe (`http://localhost:2375/_ping` on Windows, `/var/run/docker.sock` stat on Linux). If false, every integration test calls `it.skip(integrationSkipReason ?? "docker unavailable")` via a tiny `describeIntegration()` wrapper. The npm script `test:integration` sets `TESTCONTAINERS=1 cross-env vitest --config test.integration.config.ts run`. Default `npm test` never sets the flag, so AC #3/#18 hold even on a machine with Docker running.

**npm scripts (`web/package.json`):** `test:integration` (cross-env + flag), `test` unchanged.

## canvas-sync extraction design

**New module `web/src/canvas/canvas-sync.ts`** owns all logic currently inline in `GraphCanvas.tsx`'s `CanvasSync` component (lines 111–230): `syncToCanvas`, the three `sideEffects.register*Handler` callbacks, the `isSyncing` guard, label parsing (`parseNodeType`/`parseNodeName`/`readLabel`), and id mapping (`shapeIdToDomainId`/`domainIdToShapeId`).

**EditorLike interface — minimal subset of tldraw `Editor`:**

```ts
export interface EditorLike {
  getCurrentPageShapes(): { id: string; type: string; props?: { text?: unknown } }[];
  createShapes(shapes: unknown[]): void;
  deleteShapes(ids: string[]): void;
  sideEffects: {
    registerAfterCreateHandler(kind: "shape", h: (s: EditorLikeShape) => void): () => void;
    registerAfterChangeHandler(kind: "shape", h: (prev: EditorLikeShape, next: EditorLikeShape) => void): () => void;
    registerBeforeDeleteHandler(kind: "shape", h: (s: EditorLikeShape) => void): () => void;
  };
}
export type EditorLikeShape = { id: string; type: string; props?: { text?: unknown } };
```

`tldraw`'s real `Editor` is structurally compatible (TS structural typing), so `GraphCanvas.tsx` passes its `useEditor()` result straight in with no adapter.

**`createCanvasSync(editor: EditorLike, service: GraphService): { syncToCanvas(): void; dispose(): void }`**

- Returns `syncToCanvas()` (reconcile shapes from `service.listNodes()/listEdges()` — extracted verbatim from current lines 113–152) and `dispose()`.
- On construction, registers the three handlers (lines 158–220) and returns their unsubscribers; `dispose()` calls all four.
- Reads `service.subscribe` if present (GraphService already emits events per `graph-service.ts:236`) so external service mutations re-trigger `syncToCanvas` — replicating the current `useEffect` service-event listener without React.

**GraphCanvas.tsx delegation (refactor, behavior-preserving):** The `CanvasSync` component becomes:

```tsx
const editor = useEditor();
useEffect(() => {
  if (!editor) return;
  const sync = createCanvasSync(editor, service);
  sync.syncToCanvas();
  return () => sync.dispose();
}, [editor, service]);
useEffect(() => { /* syncVersion bump → sync.syncToCanvas() */ }, [syncVersion]);
```

The `isSyncing` ref moves inside `createCanvasSync` as a module-level closure. Helpers `parseNodeType`/`parseNodeName`/`readLabel`/id-mappers move into `canvas-sync.ts` and are re-exported for the existing `graph-canvas.test.ts` regression (AC #10).

**FakeEditor (no DOM, no `@tldraw/tldraw`, no `happy-dom`):** a plain TS class implementing `EditorLike` with arrays of shapes, spy counters for `createShapes`/`deleteShapes`, and handler registries that tests invoke directly (`fake.fireCreate(shape)`). Lets `canvas-sync.test.ts` assert create→`service.createNode` called with mapped fields, delete→`service.deleteNode(id)`, and service-event→reconcile.

## Auth test design

**`web/src/auth/auth-config.test.ts` (pure, no infra):** imports `authConfig.callbacks`. Three shapes:

- `authorized`: invoke with `{ auth: null, request: { nextUrl: { pathname } } }` for `/login`, `/api/x`, `/dashboard` → expect `true`, `true`, `false` (redirect). With `auth: { user: { email } }` → `true`.
- `jwt`: invoke `{ token: {}, user: { id, role, companyId, validationDomains } }` → assert `token.id/role/companyId/validationDomains` populated; second call with `user: undefined` preserves token.
- `session`: invoke `{ session: { user: {} }, token: { id, role, companyId, validationDomains } }` → assert `session.user.*` populated.

**`web/src/auth/requireApiUser.test.ts` (mocked `auth()`):** `vi.mock("./nextauth", () => ({ getCurrentUser: vi.fn() }))`. Cases: null user → 401 NextResponse; user present, `operation` disallowed by `guardOperation` → 403; user present, allowed → returns `AuthUser`. Reuses existing `permissions.test.ts` fixtures.

**`web/src/auth/authorize.integration.test.ts` (gated):** imports the raw Credentials authorize function. Extraction: refactor `nextauth.ts` to export `export async function authorizeCredentials(credentials): Promise<AuthUser | null>` and pass it into `Credentials({ authorize: authorizeCredentials })` — keeps production wiring intact while making the function unit-callable. Test seeds a bcrypt-hashed user via `db.insert(users)` against the testcontainer DB, asserts valid creds return user object, invalid password returns null, unknown email returns null. Skips when `shouldRunIntegration()` is false.

## AI contract test design

**Fixtures under `web/test-fixtures/llm/`:** `empty.json` (`""`), `partial.json` (only `personName`), `unicode.json` (CJK names + emoji), `reasoning-wrapped.json` (`"Let me think... { ...json... }"`). `extraction.test.ts` extends its existing `client.chatCompletion` mock table to iterate these fixtures through `parseSignals`, asserting graceful handling (safe defaults or correct parse) per AC #14.

**OCR fixtures `web/test-fixtures/ocr/`:** `sample.png` (a tiny 200×40px image with literal text "COMPANY BRAIN OS" rendered via any pre-existing raster — committed binary, generated once with a Node canvas or hand-made) and `sample.txt` (`"hello world"`). `ocr-pipeline.test.ts` calls `processFile` against a temp copy under `uploads/` (processFile reads `join(UPLOAD_DIR, filename)`, so the test copies the fixture into `os.tmpdir()`-backed `uploads` via `beforeEach`). Asserts image → `method: "ocr"`, non-empty `text` containing expected tokens; `.txt` → `method: "text"`, exact match. Tesseract.js works in Node, no external service.

**Transcription stub test `web/src/ai/transcription.test.ts`:** asserts `createTranscriptionService()` (when Ollama unreachable / not configured) returns stub; `transcribe("x.wav","audio/wav")` resolves to an object satisfying `TranscriptionResult` (non-empty `text`, `language` string, `confidence` number, `provider === "stub"`). Uses `vi.stubEnv` to force stub mode deterministically.

## Tradeoffs

- **testcontainers vs compose:** testcontainers gives per-run isolation and zero manual `docker compose up`, at the cost of a devDep and slower startup (~8s per container). Chosen for CI determinism; compose rejected (manual gating, no isolation).
- **FakeEditor vs happy-dom:** FakeEditor needs no DOM/tldraw and runs in the default `node` vitest project, fast and deterministic. happy-dom would require a separate React-rendering project, `@testing-library/react`, and tldraw's browser-only deps — high maintenance for thin React glue. FakeEditor wins; the real `Editor`'s structural compatibility keeps delegation type-safe.
- **Canned JSON vs record/replay:** canned fixtures lock the *parser* contract (what we own); record/replay would lock the *LLM* contract (what we don't). Canned chosen — smoke test already covers real-API when `OPENCODE_API_KEY` is set.

## Risks & mitigations

- **Windows Docker:** Docker Desktop required; `shouldRunIntegration()` skips cleanly. Document in `web/README.md`.
- **canvas-sync refactor drift:** TDD (test first, then extract); `graph-canvas.test.ts` unchanged and must still pass (AC #10); typecheck gate (AC #17).
- **AGE install in container:** `postgresql-16-age` deb may be missing on the pgvector image's apt repo. Mitigation: `apt-get install` failure → `ageAvailable=false` → AGE smoke test `it.skip("AGE unavailable: <apt error>")` with reason captured (AC #8). pgvector round-trip and all other integration tests proceed. No build-time hard dependency on AGE.
- **next-auth v5 beta churn:** callbacks invoked directly; if signatures change, only the three unit tests need updating.

## Out of scope

- Playwright/E2E, load/stress, real Whisper, AGE query module beyond the single path-query smoke, coverage thresholds, migrating existing unit tests, any production behavior change beyond the behavior-preserving canvas-sync extraction.
