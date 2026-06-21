# Tasks — add-whisper-transcription

> Phase: tasks. `strict_tdd: true` (RED → GREEN → TRIANGULATE → REFACTOR).
> `protect_review_workload: true` against a 500-line review budget. Provider
> calls are mocked at the seam; no test requires a real `whisper.cpp` binary,
> cloud credentials, or `ffprobe`. Every task ends with `npm --prefix web run
> test` (and `npm --prefix web run typecheck` for non-test source).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1200–1500 (≈10 new files + 7 edited files + migration + 4 new test files) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (provider seam + processFile + existing-test rewrite) → PR 2 (DB table + job CRUD + worker) → PR 3 (upload policy + routes + bootstrap + restart sweep) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

### Chain map (dependency-ordered)

- **PR 1 — Provider seam + `processFile` (AC-1, AC-2, AC-3, AC-4, AC-7, AC-10, AC-11).**
  Types, error class, three providers, factory switch, `ocr-pipeline.ts` media
  branch, and the `ocr-transcription.test.ts` stub-pinning rewrite. No DB, no
  routes. Foundation for PR 2/3.
- **PR 2 — Job persistence + worker (AC-5, AC-6).**
  `transcription_jobs` table, migration `0007`, `transcription-jobs.ts` CRUD,
  `transcription-worker.ts` (tick + restart sweep), worker→`ingestText`→
  `savePending` wiring. Depends on PR 1's provider seam.
- **PR 3 — Routes, limits, bootstrap (AC-5 upload half, AC-8).**
  `upload-policy.maxBytesForMime`, `StorageAdapter.size`, `POST /api/transcribe`,
  `GET /api/transcribe/jobs/:id`, server bootstrap `startTranscriptionWorker()`.
  Depends on PR 2's job CRUD.

A `pending` fallback applies only if the reviewer overrides `auto-chain` — in
that case set `Chain strategy: size-exception` and ship as one PR with the
three task groups as sequentially-applied commits.

## Cross-cutting task rules

- RED steps write the failing test **first** and run `npm --prefix web run test`
  to confirm it fails for the reason the spec predicts (not for a syntax error).
- GREEN steps make the RED test pass with the minimal change; TRIANGULATE adds a
  second variant; REFACTOR reorganizes without changing behavior.
- Each task lists its verification command and rollback boundary (the file(s)
  it owns). Do not edit files outside the listed set without splitting a task.
- `provider: "stub"` / `"ollama"` and the strings `"Transcription pending"`,
  `"not yet integrated"`, `"unsupported"` (as a media happy-path result) MUST
  NOT survive into the production path after PR 1.

---

## PR 1 — Provider seam + `processFile`

### Task 1.1 — RED: pin the new `TranscriptionResult` / `TranscriptionError` contract

- **Files (test only):** `web/src/ai/transcription.test.ts` (new).
- **Action:** Add tests asserting:
  - `TranscriptionResult.provider` type accepts `"whisper-cpp" | "whisper-api" | "unavailable"` and **rejects** `"stub"` / `"ollama"` at compile time (use a `// @ts-expect-error` block).
  - `new TranscriptionError("unavailable", "...")` produces `error.code === "unavailable"` and `error instanceof Error`.
  - `TranscriptionResult` has optional `noSpeech?: boolean` and `decodeError?: string`.
- **Verify:** `npm --prefix web run test -- transcription.test.ts` → RED (module doesn't export the new types / error class yet).
- **Rollback:** delete the new test file.

### Task 1.2 — GREEN: widen `TranscriptionResult` and add `TranscriptionError`

- **Files:** `web/src/ai/transcription.ts`.
- **Action:**
  - Replace `provider` union with `TranscriptionProvider = "whisper-cpp" | "whisper-api" | "unavailable"`.
  - Add `noSpeech?: boolean`, `decodeError?: string` to `TranscriptionResult`.
  - Add the `TranscriptionError` class with `code: "unavailable" | "decode" | "config"`.
  - Keep `StubTranscriptionService` / `OllamaTranscriptionService` **only** as exported test fixtures (clearly commented); remove them from the production factory path in Task 1.6.
- **Verify:** `npm --prefix web run test -- transcription.test.ts` → GREEN; `npm --prefix web run typecheck` → clean.
- **Rollback:** revert `transcription.ts` type widenings.

### Task 1.3 — RED: `UnavailableService` returns explicit `provider: "unavailable"`

- **Files (test):** `web/src/ai/transcription.test.ts`.
- **Action:** Add a test: `new UnavailableService().transcribe("x.mp3", "audio/mpeg")` resolves to `{ text: "", provider: "unavailable", confidence: 0, language: "unknown" }` and does not throw.
- **Verify:** RED (`UnavailableService` not exported).
- **Rollback:** remove the test block.

### Task 1.4 — GREEN: implement `UnavailableService`

- **Files:** `web/src/ai/transcription-providers/unavailable.ts` (new), `web/src/ai/transcription-providers/index.ts` (new, re-export).
- **Action:** Implement `UnavailableService implements TranscriptionService` returning the fixed result for both `transcribe` and `transcribeBuffer`.
- **Verify:** GREEN.
- **Rollback:** delete the two new files.

### Task 1.5 — RED + GREEN: `WhisperCppService` (AC-1, AC-2, AC-3, AC-11)

- **Files (test):** `web/src/ai/transcription.test.ts`.
- **RED action:** Tests that stub `globalThis.fetch` to return `{ text: "hello world" }` for a 2xx multipart response; assert `provider: "whisper-cpp"`, `confidence > 0`, `text === "hello world"`. Add a 2xx empty-text case asserting `{ text: "", provider: "whisper-cpp", noSpeech: true }`. Add a network-reject case asserting `TranscriptionError` with `code: "unavailable"`. Add a 400-with-decode-message case asserting `code: "decode"`. Repeat for `video/webm` (AC-2).
- **Verify:** RED (`WhisperCppService` not exported).
- **GREEN files:** `web/src/ai/transcription-providers/whisper-cpp.ts` (new).
- **GREEN action:** Implement `WhisperCppService` reading `WHISPER_CPP_URL` (default `http://localhost:8080`) and `WHISPER_CPP_MODEL` from the injected `env`. POST multipart to `/inference`; map 2xx → result, empty text → `noSpeech: true`, fetch reject / non-2xx → `TranscriptionError("unavailable")`, 4xx with decode hint → `TranscriptionError("decode")`.
- **Verify:** GREEN; `npm --prefix web run typecheck`.
- **TRIANGULATE:** add a test where the server returns a `language` field and assert it propagates.
- **Rollback:** delete the new file + test block.

### Task 1.6 — RED + GREEN: config-driven factory (AC-4)

- **Files (test):** `web/src/ai/transcription.test.ts`.
- **RED action:** Tests calling `createTranscriptionService(env)` with: (a) `{}` → returns `WhisperCppService`; (b) `{ TRANSCRIPTION_PROVIDER: "cloud" }` with key → `CloudSttService`; (c) `{ TRANSCRIPTION_PROVIDER: "cloud" }` without key → `UnavailableService`; (d) `{ TRANSCRIPTION_PROVIDER: "none" }` → `UnavailableService`; (e) default does NOT return an `OllamaTranscriptionService` instance. Use `instanceof` checks.
- **Verify:** RED (factory still returns Ollama→Stub).
- **GREEN files:** `web/src/ai/transcription-providers/cloud.ts` (new), `web/src/ai/transcription.ts` (rewrite `createTranscriptionService` to the `switch` from the design; keep the module singleton export for non-test callers).
- **GREEN action:** Implement `CloudSttService` + `makeCloudService(env)` that returns `UnavailableService` when `TRANSCRIPTION_CLOUD_API_KEY` is missing. Rewrite the factory per design §2.5.
- **Verify:** GREEN; typecheck.
- **Rollback:** revert factory + delete `cloud.ts`.

### Task 1.7 — RED: `processFile` media branch uses the injected service (AC-1, AC-2, AC-7, AC-11)

- **Files (test):** `web/src/ai/ocr-transcription.test.ts` (edited — AC-10 fulcrum).
- **RED action:** Replace the stub-pinning assertions for `audio/*`/`video/*` with:
  - Happy path: inject a fake `TranscriptionService` returning `{ text: "real transcript", provider: "whisper-cpp", confidence: 80 }`; assert `processFile("interview.mp3", "audio/mpeg", svc)` → `{ method: "text", text: "real transcript", confidence: 80 }` and `text` does NOT contain `"Transcription pending"` / `"not yet integrated"` / `"unsupported"`.
  - Video: same for `meeting.webm` / `video/webm` (AC-2).
  - Silent audio: inject `{ text: "", provider: "whisper-cpp", noSpeech: true, confidence: 0 }`; assert `method: "text"`, `text: ""` (AC-7).
  - Unavailable: inject a service that throws `TranscriptionError("unavailable")`; assert `processFile` re-throws (does NOT return `method: "unsupported"` placeholder) (AC-3).
  - Decode error: inject `TranscriptionError("decode")`; assert re-throw with `code: "decode"` (AC-11).
- **Verify:** `npm --prefix web run test -- ocr-transcription.test.ts` → RED (current stub returns placeholder / `method: "unsupported"`).
- **Rollback:** revert test edits.

### Task 1.8 — GREEN: rewrite `ocr-pipeline.ts` media branch + remove stub string (AC-10)

- **Files:** `web/src/ai/ocr-pipeline.ts`.
- **Action:**
  - `processFile(filePath, mimeType, service?)` — `service` defaults to the module singleton.
  - `audio/*` / `video/*` branch: `const r = await service.transcribe(filePath, mimeType)`. If `r.provider === "unavailable"` or `r.decodeError` → throw `TranscriptionError`. Otherwise return `{ text: r.text, method: "text", confidence: r.confidence }` (empty `text` allowed).
  - Remove `transcribeWithWhisper()` stub body / the `"Transcription via Whisper not yet integrated"` string; either delete it or repoint it to `service.transcribe()` with a deprecation comment (keep the export only if an existing import requires it — check with `grep`).
  - Leave text / markdown / image / PDF branches untouched.
- **Verify:** `npm --prefix web run test -- ocr-transcription.test.ts` → GREEN; full suite `npm --prefix web run test` → only the new/replaced assertions flip, no unrelated regressions; `npm --prefix web run typecheck`.
- **TRIANGULATE:** add an `audio/wav` happy-path variant and a `video/mp4` variant.
- **REFACTOR:** extract the media-branch mapping into a small `toOcrResult(r: TranscriptionResult)` helper if the branch grows past ~15 lines.
- **Rollback:** revert `ocr-pipeline.ts`.

### Task 1.9 — PR 1 close: full suite + AC checklist

- **Action:** Run `npm --prefix web run test` and `npm --prefix web run typecheck`. Manually verify AC-1, AC-2, AC-3, AC-4, AC-7, AC-10, AC-11 are GREEN at the unit level (routes/DB not yet). Confirm no assertion anywhere expects `"Transcription pending"`, `"not yet integrated"`, or `provider: "stub"` as a happy path (`grep -R "Transcription pending\|not yet integrated\|provider: \"stub\"" web/src web/test` should return nothing in happy-path test bodies).
- **Verify:** suite green; grep clean.
- **Rollback boundary:** PR 1 branch is the rollback unit.

---

## PR 2 — Job persistence + worker

### Task 2.1 — RED: `transcription_jobs` schema and migration

- **Files (test):** `web/test/server/transcription-job.test.ts` (new).
- **RED action:** Import `transcriptionJobs` from `web/src/db/schema.ts`; assert the table exists and columns `id`, `companyId`, `userId`, `source`, `storageKey`, `mimeType`, `status`, `transcript`, `noSpeech`, `failReason`, `provider`, `durationSeconds`, `createdAt`, `updatedAt` are present (compile-time + a runtime shape check against a fixture insert). Assert `status` defaults to `"queued"`.
- **Verify:** RED (`transcriptionJobs` not exported).
- **Rollback:** delete the test file.

### Task 2.2 — GREEN: add table + generate migration

- **Files:** `web/src/db/schema.ts`, `web/drizzle/0007_transcription_jobs.sql` (generated).
- **Action:** Add the `transcriptionJobs` pgTable per design §4.1 (text PK, `companyId` default + index, `status` index, timestamptz defaults). Run `npm --prefix web run db:generate` and verify the generated `0007_*.sql` is purely additive (`CREATE TABLE` + two `CREATE INDEX`, no `ALTER`/enum change). If the generated name differs from `0007`, keep the generated name and update the design reference.
- **Verify:** `npm --prefix web run test -- transcription-job.test.ts` → GREEN; inspect the SQL file.
- **Rollback:** revert schema + delete migration.

### Task 2.3 — RED + GREEN: `transcription-jobs.ts` CRUD

- **Files (test):** `web/test/server/transcription-job.test.ts`.
- **RED action:** Tests for `createJob`, `getJob`, `updateStatus`, `claimQueued` (atomic flip `queued`→`processing`, oldest first, batch cap), `reclaimProcessing` (startup sweep `processing`→`queued`). Use the project's existing Testcontainers Postgres fixture if the suite already spins one for `ingestion.ts`; otherwise use an in-memory fixture `Map` (spec allows in-memory **only in test fixtures**) behind the same CRUD interface.
- **Verify:** RED.
- **GREEN files:** `web/src/server/transcription-jobs.ts` (new).
- **GREEN action:** Implement the CRUD against Drizzle, mirroring `ingestion.ts` patterns. `claimQueued` uses `UPDATE ... WHERE status='queued' ... RETURNING` (or a transactional select-then-update) to avoid double-pick.
- **Verify:** GREEN; typecheck.
- **TRIANGULATE:** add a two-row `claimQueued` batch test asserting order + cap.
- **Rollback:** delete the module + test block.

### Task 2.4 — RED: worker completes a job and feeds `ingestText` → `savePending` (AC-5)

- **Files (test):** `web/test/server/transcription-job.test.ts`.
- **RED action:** Seed a `queued` row; inject a fake `TranscriptionService` returning `{ text: "hello", provider: "whisper-cpp", confidence: 80 }`; stub `ingestText` and `savePending`; call `runTranscriptionWorkerOnce()`; assert the row flips to `completed`, `transcript === "hello"`, `provider === "whisper-cpp"`, and `savePending` was called with `companyId`, `source`, `"text"`, and non-empty proposals.
- **Verify:** RED (`runTranscriptionWorkerOnce` not exported).
- **Rollback:** remove the test block.

### Task 2.5 — GREEN: `transcription-worker.ts` happy + empty + failure paths

- **Files:** `web/src/server/transcription-worker.ts` (new).
- **Action:** Implement `runTranscriptionWorkerOnce()` per design §4.2: claim a small batch, call `service.transcribe()`, on success store `transcript`/`noSpeech`/`provider` and set `completed`; if `!noSpeech && transcript.trim() !== ""` call `ingestText` then `savePending` (exact `/api/ingest` text path); if `noSpeech` or empty → `completed` with `noSpeech: true` and **no** ingest call (AC-7); on `TranscriptionError` or `provider: "unavailable"` → `failed` + `failReason` and no ingest call (AC-3, AC-11).
- **Verify:** GREEN for the happy path; then add RED tests for (a) silent audio → `completed`/`noSpeech`/zero `savePending` calls (AC-7) and (b) `TranscriptionError("unavailable")` → `failed`/`failReason`/zero `savePending` calls (AC-3), and make them GREEN.
- **TRIANGULATE:** add a `provider: "unavailable"` result (not thrown) variant → `failed`.
- **Rollback:** delete the module + test blocks.

### Task 2.6 — RED + GREEN: restart sweep + `startTranscriptionWorker` (AC-6)

- **Files (test):** `web/test/server/transcription-job.test.ts`.
- **RED action:** Seed a `processing` row; simulate a restart by calling `reclaimProcessing()` then re-reading the row; assert it is `queued` again with `companyId` intact (AC-6 strict-literal: row is still retrievable with prior `companyId`; the sweep additionally re-enqueues). Add a test that `startTranscriptionWorker(intervalMs)` calls `runTranscriptionWorkerOnce` on a tick and is stoppable via the returned `StopFn`.
- **Verify:** RED.
- **GREEN files:** `web/src/server/transcription-worker.ts` (extend).
- **GREEN action:** Export `startTranscriptionWorker(intervalMs?)` (default `Number(process.env.TRANSCRIPTION_WORKER_INTERVAL_MS) || 5000`) returning a `StopFn` that clears the interval. The restart sweep is `reclaimProcessing()` called once at start.
- **Verify:** GREEN; typecheck.
- **Rollback:** revert the additions.

### Task 2.7 — PR 2 close

- **Action:** `npm --prefix web run test` + `npm --prefix web run typecheck`. Verify AC-5 (worker half) and AC-6 GREEN.
- **Rollback boundary:** PR 2 branch.

---

## PR 3 — Routes, limits, bootstrap

### Task 3.1 — RED + GREEN: `maxBytesForMime` (AC-8 size half)

- **Files (test):** `web/test/app/media-upload.test.ts` (new) — or a focused `upload-policy.test.ts` if one exists.
- **RED action:** Assert `maxBytesForMime("audio/mpeg")` returns `MAX_MEDIA_BYTES` (default 100 MB, env-tunable) and `maxBytesForMime("text/csv")` returns the existing `MAX_UPLOAD_BYTES` (50 MB).
- **GREEN files:** `web/src/lib/upload-policy.ts`.
- **GREEN action:** Add `maxBytesForMime(mime)` that returns `MAX_MEDIA_BYTES` for `audio/*`/`video/*` and `MAX_UPLOAD_BYTES` otherwise. Wire `/api/upload` to use it so non-media stays at 50 MB.
- **Verify:** GREEN; typecheck; existing upload tests still pass.
- **Rollback:** revert `upload-policy.ts` + test.

### Task 3.2 — RED + GREEN: `StorageAdapter.size(key)` (AC-8 size lookup)

- **Files (test):** `web/test/app/media-upload.test.ts` (extend) or `storage.test.ts` if present.
- **RED action:** Assert the disk adapter's `size(key)` returns the byte length of a written fixture file; assert the S3 adapter maps to `HeadObject.ContentLength` (stub the S3 client).
- **GREEN files:** `web/src/lib/storage.ts`.
- **GREEN action:** Add optional `size(key): Promise<number>` to `StorageAdapter`; implement for disk (`fs.stat`) and S3 (`HeadObject`).
- **Verify:** GREEN; typecheck.
- **Rollback:** revert `storage.ts` + test.

### Task 3.3 — RED: `POST /api/transcribe` enqueue + limits (AC-5, AC-8)

- **Files (test):** `web/test/app/media-upload.test.ts` (extend).
- **RED action:** Tests:
  - Auth: no `requireApiUser("graph.node.create")` → 401.
  - Non-media MIME → 400, no job row.
  - Invalid `filename` (not `/^[a-f0-9-]{36}\.[a-z0-9]+$/i`) → 400.
  - Size > `MAX_MEDIA_BYTES` → 413 size reason, no job row (AC-8).
  - Duration > `MAX_MEDIA_DURATION_MIN` **with `ffprobe` stubbed present** → 400 duration reason, no job row (AC-8).
  - Happy path: valid media → 200 `{ jobId, status: "queued", statusUrl: "/api/transcribe/jobs/<jobId>" }`, row exists scoped to `user.companyId` (AC-5).
- **Verify:** RED (route doesn't exist).
- **Rollback:** remove the test block.

### Task 3.4 — GREEN: implement `POST /api/transcribe`

- **Files:** `web/src/app/api/transcribe/route.ts` (new).
- **Action:** Implement per design §5.1: auth gate, filename validation, MIME media-class check, `storage.size` → 413 if > `MAX_MEDIA_BYTES`, `ffprobe` duration probe **if available** → 400 if > `MAX_MEDIA_DURATION_MIN` (default 120); if `ffprobe` absent, skip the pre-enqueue check (flagged deviation — worker enforces post-probe). Insert `queued` job via `createJob`; return `{ jobId, status, statusUrl }`.
- **Verify:** GREEN for all RED cases; typecheck.
- **Rollback:** delete the route + test block.

### Task 3.5 — RED + GREEN: `GET /api/transcribe/jobs/:id` poll (AC-5)

- **Files (test):** `web/test/app/job-status.test.ts` (new).
- **RED action:** Tests: 404 for missing id; 404 for row belonging to a different `companyId` (tenant isolation); `queued`/`processing` → 200 with `status`, `updatedAt`, **no** `transcript`; `completed` → 200 with `transcript` + `noSpeech` + `provider`; `failed` → 200 with `failReason` and no `transcript` (AC-3, AC-11).
- **GREEN files:** `web/src/app/api/transcribe/jobs/[id]/route.ts` (new).
- **GREEN action:** Implement per design §5.2: `requireApiUser()`, `getJob`, tenant check, payload gating on `status`.
- **Verify:** GREEN; typecheck.
- **Rollback:** delete the route + test.

### Task 3.6 — RED + GREEN: server bootstrap starts worker + sweep (AC-6 restart)

- **Files (test):** extend `web/test/server/transcription-job.test.ts` or a new bootstrap test.
- **RED action:** Assert the server bootstrap module calls `startTranscriptionWorker()` once (spy on the export) and invokes `reclaimProcessing()` at startup. Keep the test hermetic (do not actually start the interval in unit tests — inject a no-op or assert the call count).
- **GREEN files:** the server bootstrap module (wherever migrations run on startup — discover with `grep` for the migration runner; edit only that file).
- **GREEN action:** Call `reclaimProcessing()` then `startTranscriptionWorker()` on bootstrap, guarded so it runs only in the server runtime (not during build/import).
- **Verify:** GREEN; typecheck; full `npm --prefix web run test` stays green.
- **Rollback:** revert the bootstrap edit + test.

### Task 3.7 — PR 3 close + full acceptance sweep

- **Action:** Run `npm --prefix web run test` and `npm --prefix web run typecheck`. Walk every AC (1–11) and confirm it has a GREEN test. Re-run the AC-10 grep: `grep -R "Transcription pending\|not yet integrated\|provider: \"stub\"" web/src web/test` returns nothing in happy-path test bodies. Confirm the `ffprobe` deviation is either resolved (binary required) or documented in the apply summary.
- **Verify:** suite + typecheck green; AC matrix complete.
- **Rollback boundary:** PR 3 branch; full rollback = drop all three PR branches.

---

## AC → task coverage matrix

| AC | Covered by |
|----|------------|
| AC-1 | 1.5, 1.7, 1.8 |
| AC-2 | 1.5, 1.7, 1.8 |
| AC-3 | 1.5, 1.6, 1.7, 2.5 |
| AC-4 | 1.6 |
| AC-5 | 2.4, 2.5, 3.3, 3.5 |
| AC-6 | 2.6, 3.6 |
| AC-7 | 1.7, 2.5 |
| AC-8 | 3.1, 3.3 |
| AC-9 | 1.8 (text/CSV branches untouched) + existing `ingest.test.ts` stays green |
| AC-10 | 1.7, 1.8, 3.7 (grep) |
| AC-11 | 1.5, 1.7, 2.5, 3.5 |

## Open decisions for the apply phase (resolve before GREEN on the relevant task)

1. **`ffprobe` binary** — require it (ship pre-enqueue duration check) or keep the worker-enforced fallback as a documented v1 deviation (Task 3.4). Either satisfies AC-8.
2. **`transcribeWithWhisper` export** — delete or repoint (Task 1.8); decide via `grep` of existing imports.
3. **Migration filename** — keep `0007` or accept the `db:generate`-emitted name (Task 2.2).
4. **AC-6 test shape** — strict-literal ("still retrievable with prior status") vs. sweep-enqueued ("back to `queued`"); the tasks pick strict-literal with the sweep as a guarded enhancement (Task 2.6).
