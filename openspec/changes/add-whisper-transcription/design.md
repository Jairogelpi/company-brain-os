# Design — add-whisper-transcription

> Phase: design. `require_tradeoffs: true` (config `rules.design.require_tradeoffs`).
> Scope: first slice from `proposal.md` — one real provider (local `whisper.cpp`
> default, cloud fallback via env), async job handling, media upload route, and
> wiring the transcript through the existing `ingestText` → `savePending` →
> inbox → proposal pipeline. Diarization, streaming, video frames, and a
> queue-infra replacement are out of v1 (see `spec.md` Non-goals).

This design is grounded in the current code:

- `web/src/ai/transcription.ts` — the `TranscriptionService` interface,
  `StubTranscriptionService`, `OllamaTranscriptionService`, and the
  `createTranscriptionService()` factory that today hard-codes the
  Ollama→Stub chain. `TranscriptionResult.provider` is currently typed
  `"ollama" | "stub" | "whisper-api"` — it must grow `whisper-cpp` and
  `unavailable` and drop `stub` from the production contract.
- `web/src/ai/ocr-pipeline.ts` — `processFile()` routes `audio/*`/`video/*`
  to a `method: "unsupported"` placeholder; `transcribeWithWhisper()` is a
  stub returning `"[Transcription via Whisper not yet integrated…]"`. This
  is the seam that must call the real provider and return `method: "text"`.
- `web/src/app/api/ingest/route.ts` + `web/src/domain/ingest.ts` +
  `web/src/server/ingestion.ts` — the existing text ingest path
  (`ingestText` → `savePending` as `pending` `ingestion_items`). The
  completed transcript MUST reuse this exact path; no media-only proposal
  flow is introduced.
- `web/src/app/api/upload/route.ts` + `web/src/lib/upload-policy.ts` +
  `web/src/lib/storage.ts` — an existing authenticated multipart upload
  route with an allow-list (already permits `audio/mpeg`, `audio/wav`,
  `audio/ogg`, `video/mp4`, `video/webm`), `MAX_UPLOAD_BYTES = 50 MB`
  today, and a pluggable `StorageAdapter` (disk default, S3 optional).
- `web/src/db/schema.ts` + `web/drizzle/*.sql` — Drizzle schema with
  additive migrations; the new job table follows the same conventions
  (`text` PK, `companyId` default + index, `created_at`/`updated_at`
  timestamptz).
- `web/src/auth/api-guard.ts` — `requireApiUser("graph.node.create")` is
  the permission used by `/api/ingest`; the media route reuses it so the
  same contributor+ gate applies.

## 1. Architecture overview

```
┌────────────┐   multipart    ┌──────────────────┐
│  Client    │──────────────▶│ POST /api/upload │  (existing route, extended)
│ (inbox UI) │◀─── {jobId,───│  + media check   │
└────┬───────┘     statusUrl} └────────┬─────────┘
     │ poll                                 │ insert row
     ▼                                      ▼
┌────────────────────┐        ┌──────────────────────────┐
│ GET /api/transcribe│        │ transcription_jobs (DB)   │
│   -jobs/:id        │◀──────│  queued|processing|        │
│  (status + text)   │        │  completed|failed         │
└────────────────────┘        └──────────┬───────────────┘
                                          │ pick queued
                                          ▼
                              ┌──────────────────────────┐
                              │ TranscriptionWorker       │
                              │  (in-process tick, v1)    │
                              │  → provider.transcribe()  │
                              │  → ingestText + savePending│
                              └──────────┬───────────────┘
                                          ▼
                              Provider seam (mockable):
                              WhisperCppService | CloudSttService
                                | UnavailableService (explicit)
```

The design adds three production modules and one DB table, and edits two
existing modules. It deliberately keeps the worker **in-process** for v1
(no BullMQ/Redis/external runner) while persisting state in Postgres so
jobs survive reloads — this matches the proposal's "DB-backed job row is
sufficient for v1" decision and the self-hosted posture (no new infra).

## 2. Provider architecture (Whisper backend choice)

### 2.1 Provider seam

`web/src/ai/transcription.ts` is refactored so the provider is the only
I/O boundary and every implementation lives behind
`TranscriptionService`. The `TranscriptionResult` union is widened and
the `stub`/`ollama` providers are removed from the **production** path:

```ts
export type TranscriptionProvider =
  | "whisper-cpp"
  | "whisper-api"
  | "unavailable";

export interface TranscriptionResult {
  text: string;            // "" (empty/whitespace) on no-speech
  language: string;        // "unknown" if the provider doesn't report it
  confidence: number;      // 0-100; 0 when unknown but text present is allowed
  provider: TranscriptionProvider;
  /** Present only on no-speech so the caller can mark the job `completed`
   * with an explicit empty marker instead of fabricating proposals. */
  noSpeech?: boolean;
  /** Present when the provider could not decode the bytes (codec error). */
  decodeError?: string;
}

export interface TranscriptionService {
  transcribe(filePath: string, mimeType: string): Promise<TranscriptionResult>;
  transcribeBuffer(buffer: Buffer, mimeType: string): Promise<TranscriptionResult>;
}
```

A new `TranscriptionError` typed error class is introduced for the
unreachable/decode cases so callers can `instanceof`-check rather than
string-match (supports AC-3 and AC-11):

```ts
export class TranscriptionError extends Error {
  constructor(
    public readonly code: "unavailable" | "decode" | "config",
    message: string,
  ) { super(message); this.name = "TranscriptionError"; }
}
```

The `provider: "unavailable"` *result* and the `TranscriptionError` are
both valid ways to surface unavailability; the worker normalizes either
into a `failed` job row with a reason. The spec's "MUST NOT return a
placeholder string that looks like content" is enforced by the type
itself — `provider` can no longer be `"stub"`, and the only way to return
text with `provider: "unavailable"` is to also set an empty `text`.

### 2.2 Whisper.cpp provider (default)

`WhisperCppService` calls a **local `whisper.cpp` server** over HTTP
(`POST /inference` with multipart audio, JSON response with `text`).
This is the `whisper.cpp` `server` example binary, started by the
operator alongside Ollama/Postgres.

**Tradeoff — HTTP server vs. CLI subprocess** (this is the central
backend-choice tradeoff the config `require_tradeoffs` rule asks for):

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **`whisper.cpp` HTTP server** (chosen) | One model load persists across requests (no 5-15s cold-start per file); easy to mock in tests by stubbing `fetch` to `WHISPER_CPP_URL`; naturally supports a future streaming endpoint; horizontal scale by pointing `WHISPER_CPP_URL` at a dedicated box. | Operator must run the `server` binary (not just the CLI); one more long-lived process to supervise. | **Chosen.** The persistence + mockability + future-streaming wins outweigh the ops cost, which is no worse than the already-required Ollama long-lived process. |
| `whisper.cpp` CLI subprocess per file | No long-lived process to supervise; trivially scriptable. | Model reload per invocation (5-15s+ on CPU) makes 1h meetings painful; harder to mock cleanly (must stub `child_process`); no path to streaming. | Rejected for v1; document as an alternative the operator can wire by pointing `WHISPER_CPP_URL` at a thin local wrapper. |
| Cloud STT API (`whisper-api`) | Zero local ops, fast, GPU-backed. | Per-minute cost, data egress (privacy regression vs. the on-prem posture), vendor lock-in, needs live creds in CI. | Kept as the **config fallback** (`TRANSCRIPTION_PROVIDER=cloud`), not the default, per proposal's self-host posture. |

`WhisperCppService` reads `WHISPER_CPP_URL` (default
`http://localhost:8080`) and a `WHISPER_CPP_MODEL` (default
`ggml-base.en.bin`, operator-pinned). It sends the file bytes via
multipart; on non-2xx or fetch failure it throws `TranscriptionError`
with code `"unavailable"`. If the server returns a 4xx with a
codec/decode message, it throws with code `"decode"`. A 2xx with empty
`text` is returned as `{ text: "", provider: "whisper-cpp", noSpeech: true }`.

### 2.3 Cloud provider (fallback)

`CloudSttService` calls a configurable cloud Whisper-compatible API
(`TRANSCRIPTION_CLOUD_URL`, `TRANSCRIPTION_CLOUD_API_KEY`). It is
selected only when `TRANSCRIPTION_PROVIDER=cloud`. Unconfigured cloud
(no key) MUST degrade to `UnavailableService` (AC: "leaving it
unconfigured must degrade to explicit unavailability, not a crash") — it
MUST NOT throw synchronously at construction.

### 2.4 Unavailable provider (explicit degradation)

`UnavailableService` is a real `TranscriptionService` whose
`transcribe()` always returns
`{ text: "", provider: "unavailable", confidence: 0 }`. It is selected
by the factory when the configured provider cannot be constructed (e.g.
`cloud` with no credentials) **or** when the operator explicitly sets
`TRANSCRIPTION_PROVIDER=none`. This is the explicit-degradation seam:
text/CSV ingest never touches it (AC-9), and media ingest surfaces it as
a `failed` job (AC-3).

### 2.5 Factory (config-driven selection — AC-4)

```ts
export function createTranscriptionService(
  env: NodeJS.ProcessEnv = process.env,
): TranscriptionService {
  switch (env.TRANSCRIPTION_PROVIDER ?? "whisper-cpp") {
    case "whisper-cpp": return new WhisperCppService(env);
    case "cloud":       return makeCloudService(env);  // → Unavailable if unconfigured
    case "none":        return new UnavailableService();
    default:            return new UnavailableService();
  }
}
```

The `env` parameter is what makes AC-4 testable without mutating
`process.env` globally. The module-level `transcriptionService` singleton
is still exported for non-test callers; tests use the factory directly.

## 3. Wiring `processFile()` (AC-1, AC-2, AC-7, AC-11)

`ocr-pipeline.ts` changes minimally:

- `processFile()` accepts an optional `service?: TranscriptionService`
  argument (defaults to the module singleton) so tests inject a mock at
  the provider boundary without touching `fetch`.
- The `audio/*`/`video/*` branch calls `service.transcribe(filePath, mimeType)`:
  - On a result with `provider !== "unavailable"` and non-`decodeError`:
    return `{ text: result.text, method: "text", confidence: result.confidence }`.
    An empty `text` (silent audio) is returned as
    `{ text: "", method: "text", confidence: 0 }` — the caller (the
    worker) decides whether to mark the job `completed` with the
    `no-speech` marker (AC-7).
  - On a thrown `TranscriptionError` or `provider: "unavailable"`:
    **re-throw** so the worker records a `failed` job. This replaces the
    silent `method: "unsupported"` placeholder (AC-3, AC-11).
- The `transcribeWithWhisper()` stub is **removed** (or repointed to
  `service.transcribe()` and re-exported for back-compat with the
  existing test import). The stub string
  `"Transcription via Whisper not yet integrated"` is deleted (AC-10).
- Text, markdown, image, and PDF branches are **unchanged** — the
  existing `ocr-transcription.test.ts` text/OCR assertions stay green.

## 4. Async job handling (AC-5, AC-6)

### 4.1 Job table — `transcription_jobs`

New Drizzle table, additive migration `0007_transcription_jobs.sql` (next
in the existing `0000`…`0006` sequence), following the codebase's
conventions (text PK, `companyId` default + index, timestamptz):

```ts
export const transcriptionJobs = pgTable("transcription_jobs", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().default("default"),
  userId: text("user_id").notNull(),
  source: text("source").notNull(),           // original filename for provenance
  storageKey: text("storage_key").notNull(),  // uuid.ext in the StorageAdapter
  mimeType: text("mime_type").notNull(),
  status: text("status").$type<"queued" | "processing" | "completed" | "failed">()
    .notNull().default("queued"),
  transcript: text("transcript"),             // null until completed
  noSpeech: boolean("no_speech").notNull().default(false),
  failReason: text("fail_reason"),
  provider: text("provider"),                 // whisper-cpp | whisper-api | unavailable
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("transcription_jobs_company_idx").on(t.companyId),
  index("transcription_jobs_status_idx").on(t.status),
]);
```

Indexes mirror `ingestion_items` and `missions` (company + status).
Migration is purely additive (new table, no enum changes, no FK to
`nodes`), so it runs cleanly on the existing Postgres stack — the
spec-flagged migration risk is mitigated by avoiding enum/alter
operations.

### 4.2 Worker — in-process tick (v1)

`web/src/server/transcription-worker.ts` exposes:

```ts
export async function runTranscriptionWorkerOnce(): Promise<void>
export function startTranscriptionWorker(intervalMs?: number): StopFn
```

`runTranscriptionWorkerOnce()` selects `queued` rows (oldest first,
capped at a small batch), flips each to `processing` (atomic
`UPDATE ... WHERE status='queued'` to avoid double-pick under concurrency),
calls `service.transcribe()`, and on success:

1. Stores `transcript` + `noSpeech` + `provider` and sets `completed`.
2. If `!noSpeech && transcript.trim() !== ""`, calls
   `ingestText(transcript, { source, existingNodeIds })` then
   `savePending(companyId, source, "text", proposals)` — **the exact
   path `/api/ingest` uses for text paste** (AC-5 "completed transcript
   feeds the existing ingest pipeline"). No media-only proposal flow.
3. If `noSpeech` or empty transcript, marks `completed` with
   `noSpeech: true` and does **not** call `ingestText` (AC-7 — zero new
   proposals, consistent with empty text paste which already returns
   `proposals.length === 0`).

On failure (`TranscriptionError` or `provider: "unavailable"`), sets
`failed` + `failReason` and does **not** call `ingestText` (AC-3, AC-11).

`startTranscriptionWorker()` runs `runTranscriptionWorkerOnce()` on a
`setInterval` (default 5s, env `TRANSCRIPTION_WORKER_INTERVAL_MS`). It
is started in the Next.js server bootstrap (the same place migrations
run on startup) **and** is injectable/stoppable for tests.

**Tradeoff — in-process worker vs. external worker (queue infra):**

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **In-process `setInterval` tick** (chosen) | No new infra (matches self-hosted posture and the proposal's "DB-backed job row is sufficient for v1"); trivial to test by calling `runTranscriptionWorkerOnce()` directly; state is in Postgres so it survives reloads. | Single-server only (no horizontal fanout); a long transcription blocks one tick (mitigated by small batch + the 120-min cap); if the process dies mid-`processing`, the row is stranded. | **Chosen for v1.** The stranded-row case is handled by a **restart sweep** (below). Horizontal scale is explicitly a non-goal for v1 (proposal). |
| External worker process / BullMQ+Redis | Horizontal scale, retries, backoff. | New infra (Redis) breaks the self-hosted-only stack; more moving parts; out of v1 scope. | Rejected for v1 (proposal Non-goal: "a job-queue infrastructure replacement"). |

**Restart sweep (AC-6):** on startup, the worker runs
`UPDATE transcription_jobs SET status='queued', updatedAt=now() WHERE
status='processing'` to reclaim rows orphaned by a crash. AC-6's
"survives a process reload" test asserts the row is still retrievable
with its `companyId` and prior status after a simulated restart; the
sweep additionally re-enqueues `processing` rows so they aren't lost.
The AC-6 test may assert either "still retrievable with prior status"
(the spec's literal text) **or** "re-enqueued to `queued`" — both
satisfy "no silent loss of the upload"; the tasks phase will pick the
strict-literal version and treat the sweep as a guarded enhancement.

### 4.3 Provider calls are mocked at the boundary

Per the spec risk note, tests inject a fake `TranscriptionService`
through `processFile(..., service)` and through the worker's
constructor argument. No test issues a real HTTP call to `whisper.cpp`.
`WhisperCppService` itself is unit-tested by stubbing `globalThis.fetch`
(the same pattern the existing `ocr-transcription.test.ts` already uses
for the Ollama reachability check).

## 5. Media upload route (AC-5, AC-8)

### 5.1 Route shape

A new **`POST /api/transcribe`** route (not a mutation of `/api/upload`,
to keep upload orthogonal and reusable) accepts:

```json
{ "filename": "<uuid>.<ext>", "mimeType": "audio/mpeg", "source": "interview.mp3" }
```

`filename` is the server-generated storage key returned by `/api/upload`
(the client uploads first, then kicks off transcription). The route:

1. `requireApiUser("graph.node.create")` — same gate as `/api/ingest`.
2. Validates `filename` against the existing `/^[a-f0-9-]{36}\.[a-z0-9]+$/i`
   shape used by `/api/upload/[filename]` (no client-supplied paths).
3. Rejects non-media MIME with `400` (`isAllowedMime` + `classifyMediaType === "audio"|"video"`).
4. **Size check (AC-8):** `await getStorage().exists(filename)` and read
   length from the storage adapter (extend `StorageAdapter` with an
   optional `size(key)` or stat the file on disk); reject `> MAX_MEDIA_BYTES`
   (default `100 * 1024 * 1024`, env `MAX_MEDIA_BYTES`) with `413` and a
   size reason. No job row is created.
5. **Duration check (AC-8):** if `ffprobe` is available, probe duration;
   reject `> MAX_MEDIA_DURATION_MIN` (default `120`, env
   `MAX_MEDIA_DURATION_MIN`) with `400` and a duration reason. No job row
   is created. **Deviation flag:** if `ffprobe` is not available, the
   route skips the pre-enqueue duration check and the **worker** enforces
   it post-probe (failing the job with a `400`-equivalent reason). This
   matches the spec's flagged deviation and avoids making `ffprobe` a
   hard CI dependency.
6. Inserts a `transcription_jobs` row (`queued`, scoped to
   `user.companyId` + `user.id`), and returns
   `{ jobId, status: "queued", statusUrl: "/api/transcribe/jobs/<jobId>" }`.

**Why a two-step upload→transcribe instead of one multipart route?**
The existing `/api/upload` already does authenticated multipart with an
allow-list and storage adapter; reusing it avoids duplicating that
security surface and lets a large upload complete before any
transcription concerns (size already enforced at 50 MB there). The v1
media limit of 100 MB exceeds the current global 50 MB cap, so
`MAX_UPLOAD_BYTES` is raised to `max(MAX_UPLOAD_BYTES, MAX_MEDIA_BYTES)`
when the upload's MIME is media — enforced in `/api/upload` via a
`maxBytesForMime(mime)` helper so non-media uploads keep the 50 MB cap.

### 5.2 Status route — `GET /api/transcribe/jobs/:id`

- `requireApiUser()` (read access; the row is scoped by `companyId`).
- Returns `{ id, status, updatedAt, provider?, transcript?, noSpeech?, failReason? }`.
- `transcript` is included only when `status === "completed"` (avoids
  leaking partial text from a `processing` row).
- A `queued`/`processing` row returns no transcript — the client polls.
- A `failed` row returns `failReason` (AC-3, AC-11) and no transcript.
- 404 when the row doesn't exist or belongs to a different `companyId`
  (tenant isolation, matching the `ingestion_items` pattern).

### 5.3 List route (optional, v1.1) — out of scope

A `GET /api/transcribe/jobs` list endpoint is not required by any AC and
is deferred; the inbox UI links a completed job to the proposals it
produced via the shared `source` string (the original filename).

## 6. Data flow: completed transcript → inbox

```
worker: service.transcribe(storageKey) -> { text, noSpeech, provider }
  |  noSpeech or text.trim()===""  ───────────────▶  job=completed, noSpeech=true
  |  (AC-7: zero new proposals)
  ▼  non-empty text
ingestText(text, { source: job.source, existingNodeIds })  // SAME as /api/ingest text path
  ▼
savePending(job.companyId, job.source, "text", proposals)   // SAME as /api/ingest
  ▼
ingestion_items rows (status=pending) ──▶ existing /api/inbox review UI
```

Because the transcript reuses `ingestText` + `savePending`, **every
existing inbox behavior is inherited for free**: dedup against existing
nodes, PENDING status, review approve/reject, and the "nothing new
found" message on empty extractions. No new proposal kind, no new
review UI, no new permission.

## 7. Error / degradation matrix

| Trigger | Provider outcome | Job row | HTTP (route) | Ingest effect | AC |
|---|---|---|---|---|---|
| Reachable `whisper.cpp`, speech present | `{ provider:"whisper-cpp", text:"...", confidence>0 }` | `completed`, transcript stored | `200` on poll with transcript | `ingestText`→`savePending` PENDING proposals | AC-1, AC-5 |
| Reachable `whisper.cpp`, video audio track | same as above for `video/webm` | `completed` | `200` with transcript | proposals created | AC-2 |
| Reachable `whisper.cpp`, silent audio | `{ provider:"whisper-cpp", text:"", noSpeech:true }` | `completed`, `noSpeech=true`, no transcript | `200` with `noSpeech:true`, empty transcript | **zero** new proposals | AC-7 |
| `whisper.cpp` server unreachable | `TranscriptionError("unavailable")` or `{ provider:"unavailable" }` | `failed`, `failReason` | upload route `200` (job accepted); poll `200` with `status:"failed"` + `failReason` | none | AC-3 |
| Unsupported codec (e.g. `audio/x-unknown`) | `TranscriptionError("decode")` | `failed`, `failReason="decode: ..."` | poll `200` with `status:"failed"` | none | AC-11 |
| `cloud` selected but no API key | factory → `UnavailableService` | `failed`, `failReason="cloud unconfigured"` | poll `200` with `status:"failed"` | none | AC-3 (degrade, not crash) |
| File > 100 MB | n/a (rejected before work) | **no row created** | `POST /api/transcribe` `413` size reason | none | AC-8 |
| Duration > 120 min (ffprobe present) | n/a (rejected before work) | **no row created** | `POST /api/transcribe` `400` duration reason | none | AC-8 |
| Duration > 120 min (ffprobe absent) | worker probes, fails job | `failed`, `failReason="duration limit"` | poll `200` with `status:"failed"` (deviation) | none | AC-8 (flagged deviation) |
| No `whisper.cpp`, text/CSV ingest | n/a (path untouched) | n/a | `/api/ingest` `200` PENDING proposals as today | proposals created | AC-9 |
| Non-media MIME to `/api/transcribe` | n/a | **no row created** | `400` non-media reason | none | route contract |

The matrix makes the spec's "explicit unavailability, never fake
content" rule mechanically enforceable: the **only** way a transcript
string reaches `ingestText` is `provider ∈ {whisper-cpp, whisper-api}`
**and** `!noSpeech` **and** `text.trim() !== ""`. Every other cell
either rejects pre-work, fails the job, or marks `noSpeech` with zero
proposals.

## 8. File changes (summary for the tasks phase)

**New files:**

- `web/src/ai/transcription-providers/whisper-cpp.ts` — `WhisperCppService`.
- `web/src/ai/transcription-providers/cloud.ts` — `CloudSttService` + `makeCloudService`.
- `web/src/ai/transcription-providers/unavailable.ts` — `UnavailableService`.
- `web/src/ai/transcription-providers/index.ts` — re-exports + factory split.
- `web/src/server/transcription-worker.ts` — `runTranscriptionWorkerOnce`, `startTranscriptionWorker`, restart sweep.
- `web/src/server/transcription-jobs.ts` — DB CRUD (`createJob`, `getJob`, `updateStatus`, `claimQueued`, `reclaimProcessing`) mirroring `ingestion.ts`.
- `web/src/app/api/transcribe/route.ts` — `POST` (enqueue).
- `web/src/app/api/transcribe/jobs/[id]/route.ts` — `GET` (poll).
- `web/drizzle/0007_transcription_jobs.sql` — additive migration.
- Tests (new): `web/src/ai/transcription.test.ts` (provider seam, AC-3/4/11), `web/test/app/media-upload.test.ts` (AC-5/8), `web/test/app/job-status.test.ts` (AC-5 poll), `web/test/server/transcription-job.test.ts` (AC-6 durability).

**Edited files:**

- `web/src/ai/transcription.ts` — widen `TranscriptionResult`, add `TranscriptionError`, rewrite `createTranscriptionService()` to the config switch, delete `StubTranscriptionService`/`OllamaTranscriptionService` from the production path (kept only as test fixtures if needed).
- `web/src/ai/ocr-pipeline.ts` — `processFile()` media branch calls the injected service and re-throws on unavailable/decode; remove `transcribeWithWhisper` stub string.
- `web/src/db/schema.ts` — add `transcriptionJobs` table.
- `web/src/lib/upload-policy.ts` — add `maxBytesForMime(mime)` so media uploads allow up to `MAX_MEDIA_BYTES` while non-media stays at `MAX_UPLOAD_BYTES`.
- `web/src/lib/storage.ts` — add optional `size(key)` to `StorageAdapter` (disk: `stat`; S3: `HeadObject` `ContentLength`).
- `web/src/ai/ocr-transcription.test.ts` — replace stub-pinning assertions with real-provider + explicit-unavailability assertions (AC-10).
- Server bootstrap (wherever migrations run on startup) — call `startTranscriptionWorker()` and the restart sweep.

## 9. Test strategy (strict TDD)

Per `strict_tdd: true`, every AC goes **RED first** on current code, then
GREEN. Provider calls are mocked at the seam (`processFile(..., service)`
injection, `env`-injected factory, `globalThis.fetch` stub for
`WhisperCppService`); no test requires a real `whisper.cpp` or cloud
credentials. The DB durability test (AC-6) uses the existing
Testcontainers Postgres pattern (project already has
`@testcontainers/postgresql` and a `test.integration.config.ts`) or, if
the unit suite must stay DB-free, a mock `Db` with an in-memory `Map`
that survives the "restart" by being re-read — the spec allows
in-memory maps **only in test fixtures**, so AC-6's RED/GREEN can use a
fixture map while the production `transcription-jobs.ts` module targets
the real Drizzle table.

The `ocr-transcription.test.ts` edits are the AC-10 fulcrum: the current
tests pin `"Transcription pending"`, `"not yet integrated"`, and
`provider: "stub"`; they become tests asserting a real transcript on the
media happy path and a typed error / `provider: "unavailable"` on
backend-down. The same edge (unsupported media, unavailable backend) is
covered under the new behavior — tests are updated, not silently dropped.

## 10. Tradeoffs summary (required by `require_tradeoffs: true`)

1. **Whisper backend: `whisper.cpp` HTTP server (chosen) vs. CLI subprocess
   vs. cloud-only.** Chose the HTTP server for model-reuse, clean
   mocking, and a path to streaming; rejected CLI for per-file cold-start
   and harder mocking; kept cloud as a config fallback, not the default,
   to preserve the on-prem privacy posture.
2. **Job durability: DB-backed `transcription_jobs` row (chosen) vs.
   in-memory map.** DB wins for durability across reloads (AC-6) and
   tenant scoping; in-memory allowed only in test fixtures.
3. **Worker: in-process `setInterval` tick (chosen) vs. external
   worker/Redis queue.** In-process matches the self-hosted, no-new-infra
   posture and the proposal's v1 boundary; horizontal scale and retry
   backoff are explicitly deferred. Stranded `processing` rows are
   reclaimed by a startup sweep.
4. **Upload flow: two-step upload→`/api/transcribe` (chosen) vs. one
   multipart transcription route.** Reusing `/api/upload`'s
   authenticated, allow-listed storage surface avoids duplicating
   security logic and decouples upload completion from transcription
   setup.
5. **Duration enforcement: pre-enqueue `ffprobe` when available, else
   worker-enforced (flagged deviation) vs. hard `ffprobe` dependency.**
   Avoids making `ffprobe` a CI prerequisite; the deviation is recorded
   so the tasks/apply phase can decide whether to ship `ffprobe` as a
   required binary or keep the deferred path.
6. **Provider union: widen types and delete `stub`/`ollama` from the
   production path (chosen) vs. keep them as fallbacks.** Removing them
   from production makes "never fake content" a type-level guarantee
   rather than a convention; they survive only as test fixtures.

## 11. Risks and open items for the tasks phase

- **whisper.cpp server binary** is an operator-supplied runtime; tests
  must never require it. The `env`-injected factory and the
  `processFile(..., service)` seam are the testability hinges.
- **Migration ordering** — `0007_transcription_jobs.sql` is additive but
  the tasks phase must run `npm --prefix web run db:generate` and verify
  the generated SQL matches the hand-sketched DDL above before apply.
- **`ffprobe` deviation** — the tasks phase should decide whether to
  (a) require `ffprobe` and ship the pre-enqueue check, or (b) keep the
  worker-enforced fallback and document it as a v1 deviation in the
  apply summary. Either satisfies AC-8; (b) is lower-friction.
- **`MAX_UPLOAD_BYTES` change** — raising the global cap for media
  affects non-media uploads if implemented naively; the
  `maxBytesForMime(mime)` helper keeps non-media at 50 MB.
- **Inbox UI** — no UI change is required for v1 (completed jobs surface
  as proposals in the existing inbox via the shared `source` string). A
  future "transcription jobs" panel is out of scope.
- **Flat `design.md` shape** — consistent with the spec's flat
  `spec.md`; archive must handle both.
