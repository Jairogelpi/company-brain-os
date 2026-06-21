# Spec — add-whisper-transcription

> Domain: `transcription` (no prior canonical spec — full new spec). Make audio/video
> ingestion real so meeting recordings and interviews feed the same ingest → inbox →
> graph-proposal pipeline as text paste. Scope is the first slice from `proposal.md`:
> one real provider (local `whisper.cpp` default), async job handling, and wiring the
> transcript through the existing text ingest path. Diarization, streaming, video
> frames, and a job-queue infra replacement are explicitly out of v1.

## Decisions resolved from proposal gaps

- **Backend**: Local `whisper.cpp` is the default provider (on-prem, zero marginal
  cost, matches the self-hosted Postgres/AGE/Ollama posture). A cloud STT API MAY be
  selected via config (`TRANSCRIPTION_PROVIDER=cloud`) as a fallback for deployments
  that cannot run `whisper.cpp`. Selection is runtime-config-driven, not code-edited.
- **Job persistence**: A DB-backed job row (Drizzle table) MUST persist transcription
  jobs so status survives process reloads. An in-memory map is NOT acceptable for the
  production path; it MAY be used only in test fixtures.
- **Max file size / duration (v1)**: The upload route MUST reject audio/video larger
  than **100 MB** or longer than **120 minutes** with an explicit `413`/`400` error
  before any transcription work starts. These limits are configurable via env.

## Requirements

### Requirement: Real transcription provider, not a placeholder

The system MUST produce a real transcript from audio/video files using a configured
speech-to-text provider. The `transcribeWithWhisper()` stub returning
`"[Transcription via Whisper not yet integrated…]"` and `processFile()` returning
`method: "unsupported"` for `audio/*`/`video/*` MUST be replaced with real provider
calls. A provider result MUST carry `provider` set to `"whisper-cpp"`, `"whisper-api"`,
or `"unavailable"` — it MUST NOT report `"stub"` for any successful transcription.

#### Scenario: Audio file yields a real transcript

- GIVEN a valid `interview.mp3` upload and a reachable `whisper.cpp` backend
- WHEN `processFile("interview.mp3", "audio/mpeg")` runs
- THEN the returned `method` is `"text"` (transcript treated as text downstream)
- AND `text` is the actual recognized speech — it MUST NOT contain the strings
  `"Transcription pending"`, `"not yet integrated"`, or `"unsupported"`
- AND `confidence` is greater than `0` when the provider returns a confidence signal

#### Scenario: Video file audio track is transcribed

- GIVEN a valid `meeting.webm` upload (`video/webm`) and a reachable `whisper.cpp`
- WHEN `processFile("meeting.webm", "video/webm")` runs
- THEN the returned `method` is `"text"` and `text` is the recognized speech from the
  audio track (video frames are out of scope and ignored)

#### Scenario: Existing text and image paths are unchanged

- GIVEN the spec is implemented
- WHEN `processFile("sample.txt", "text/plain")` and an image file are processed
- THEN text files still return `method: "text"`, `confidence: 100`, exact content
- AND image files still go through Tesseract OCR returning `method: "ocr"`
- AND the existing `ocr-transcription.test.ts` assertions for text/OCR stay green
  (only the stub-pinning assertions for media are replaced)

### Requirement: Explicit unavailability, never fake content

When no transcription provider can service a request, the system MUST surface an
explicit `provider: "unavailable"` result or a typed error — it MUST NOT return a
placeholder string that looks like content, and MUST NOT return `provider: "stub"`
with `confidence: 0` text masquerading as a transcript.

#### Scenario: whisper.cpp backend unreachable

- GIVEN `TRANSCRIPTION_PROVIDER=whisper-cpp` and the `whisper.cpp` binary/endpoint
  is unreachable
- WHEN a media file is transcribed
- THEN the service returns a typed error (or `provider: "unavailable"` result) that
  the caller can distinguish from a real transcript
- AND the job row transitions to a `failed` status with a reason string, not to
  `completed` with placeholder text

#### Scenario: Unsupported codec is rejected explicitly

- GIVEN an uploaded media file in a codec `whisper.cpp` cannot decode (e.g.
  `audio/x-unknown`)
- WHEN transcription is attempted
- THEN the system reports an explicit codec/decoding error
- AND it MUST NOT silently emit `method: "unsupported"` with a placeholder string

### Requirement: Config-driven provider selection

The active transcription provider MUST be chosen from configuration
(`TRANSCRIPTION_PROVIDER`, default `whisper-cpp`), with `cloud` as a supported
fallback. `createTranscriptionService()` MUST return the configured provider and
MUST NOT hard-code the Ollama-with-stub-fallback path as the production service.

#### Scenario: Default selects whisper.cpp

- GIVEN `TRANSCRIPTION_PROVIDER` is unset
- WHEN `createTranscriptionService()` is called
- THEN the returned service targets the local `whisper.cpp` backend
- AND it does not route through the current `OllamaTranscriptionService → Stub`
  chain for production transcription

#### Scenario: Cloud provider selectable via env

- GIVEN `TRANSCRIPTION_PROVIDER=cloud` and a configured cloud STT API key/endpoint
- WHEN `createTranscriptionService()` is called
- THEN the returned service calls the cloud STT API
- AND `TranscriptionResult.provider` is `"whisper-api"` on success

### Requirement: Async job lifecycle for media uploads

Because transcription can be long-running, media ingestion MUST be asynchronous:
upload enqueues a durable job, the client polls status, and only the completed
transcript text is fed into the existing ingest → inbox → proposal pipeline. A
DB-backed job row MUST record status transitions so jobs survive process reloads.

#### Scenario: Upload enqueues a durable job

- GIVEN an authenticated contributor+ user uploads an `audio/*` or `video/*` file
- WHEN they POST to the media upload route
- THEN a job row is created in the database with status `queued` (or `processing`)
  scoped to the user's `companyId`
- AND the response returns a `jobId` and a pollable status URL — not a blocking
  transcript
- AND the uploaded bytes are persisted to the uploads area for the worker to read

#### Scenario: Polling reflects status transitions

- GIVEN a queued job
- WHEN the client polls the job status endpoint
- THEN the response reports one of `queued | processing | completed | failed` and
  a persisted `updatedAt`
- AND once `completed`, the response includes the transcript text (or a reference
  that resolves to it)

#### Scenario: Completed transcript feeds the existing ingest pipeline

- GIVEN a job reaches `completed` with a non-empty transcript
- WHEN the transcript is handed to the ingest flow
- THEN it is processed by the same `ingestText` → `savePending` path used for text
  paste (proposals generated, stored as `PENDING` for review, scoped to
  `companyId`)
- AND no separate media-only proposal flow is introduced

#### Scenario: Jobs survive a process reload

- GIVEN a `processing` job exists in the DB and the server restarts
- WHEN the server comes back up
- THEN the job row is still retrievable with its prior status and `companyId`
- AND a worker MAY resume or re-enqueue it (no silent loss of the upload)

### Requirement: Empty / unintelligible audio degrades gracefully

When the provider returns an empty or near-empty transcript (silent or
unintelligible audio), the system MUST treat it as "nothing extracted" and reuse
the existing empty-ingest inbox behavior — it MUST NOT create fake proposals or
report a misleading `completed` with content.

#### Scenario: Silent audio yields an explicit empty result

- GIVEN a valid but silent `.mp3` and a reachable `whisper.cpp`
- WHEN transcription completes
- THEN the transcript text is empty (or whitespace-only)
- AND the job is marked `completed` with an explicit `empty`/`no-speech` marker
- AND ingest produces no new proposals (consistent with empty text paste)

### Requirement: Upload size and duration limits enforced before work

The upload route MUST reject media that exceeds the v1 limits (100 MB file size or
120 minutes duration) before any transcription work or job enqueue, returning an
explicit HTTP error. Limits MUST be configurable via env so operators can tune them.

#### Scenario: Oversize file is rejected at the route

- GIVEN an `audio/mpeg` upload of 150 MB
- WHEN the client POSTs to the media upload route
- THEN the route responds `413 Payload Too Large` (or equivalent explicit `400`)
  with a reason mentioning the size limit
- AND no job row is created and no transcription work starts

#### Scenario: Over-duration file is rejected

- GIVEN a media file whose probed duration exceeds 120 minutes
- WHEN the route validates it before enqueue
- THEN the route responds `400` with a duration-limit reason
- AND no job row is created

### Requirement: Backend absence does not break text/CSV capture

The app MUST stay fully usable for text and CSV capture when the transcription
backend is absent or unconfigured. Media ingestion degrades with an explicit
unavailable signal; non-media paths are unaffected.

#### Scenario: Text/CSV ingest works with no whisper backend

- GIVEN `whisper.cpp` is not installed and `TRANSCRIPTION_PROVIDER` unset
- WHEN a user POSTs text or CSV to `/api/ingest`
- THEN text and CSV ingestion proceed exactly as today (proposals generated, saved
  as `PENDING`)
- AND only media ingestion surfaces the unavailable signal

### Requirement: Existing stub-pinning tests are updated, not deleted silently

The current `ocr-transcription.test.ts` assertions pin the stub contract (the
`"Transcription pending for …"` and `"Whisper not yet integrated"` strings, and the
`provider: "stub"` fallback). These tests MUST be replaced with assertions that
pin the new real-provider and explicit-unavailability contracts. The replaced
tests MUST NOT be silently dropped — the new tests MUST cover the same edge
(unsupported media, unavailable backend) under the new behavior.

#### Scenario: Stub-pinning tests become real-provider tests

- GIVEN the spec is implemented
- WHEN `npm --prefix web run test` runs the transcription suite
- THEN no assertion expects `"Transcription pending"` / `"not yet integrated"` /
  `provider: "stub"` as the happy path
- AND there is at least one test asserting real transcript content on a media happy
  path and at least one asserting explicit unavailability on backend-down

## Non-goals

- Speaker diarization / multi-speaker labels (single-channel transcript only).
- Real-time or streaming transcription.
- Video frame analysis / multimodal vision.
- Replacing Tesseract OCR for images/PDFs.
- A job-queue infrastructure replacement (DB-backed job row is sufficient for v1).
- Cloud provider auto-failover orchestration (operator selects one provider via
  config).

## Acceptance criteria (numbered, each maps to a test)

1. **AC-1 — Real transcript on audio happy path.**
   `processFile("interview.mp3", "audio/mpeg")` with a reachable `whisper.cpp`
   (service mocked at the provider boundary in unit tests) returns `method: "text"`,
   non-placeholder `text`, `confidence > 0`, and `provider` ∈
   `{"whisper-cpp","whisper-api"}` — never `"stub"`.

2. **AC-2 — Video audio track transcribed.**
   `processFile("meeting.webm", "video/webm")` returns `method: "text"` with the
   recognized speech; video frames are not decoded.

3. **AC-3 — Explicit unavailability, no fake content.**
   When the configured backend is unreachable, the service returns a typed error or
   `provider: "unavailable"`; it MUST NOT return `provider: "stub"` text that looks
   like a transcript, and the job row goes to `failed` (not `completed`).

4. **AC-4 — Config-driven provider selection.**
   `createTranscriptionService()` returns the `whisper-cpp` service by default and
   the cloud service when `TRANSCRIPTION_PROVIDER=cloud`; the production path no
   longer chains through `OllamaTranscriptionService → Stub`.

5. **AC-5 — Async job lifecycle.**
   Media upload creates a DB job row (`queued`/`processing`) scoped to
   `companyId`, returns a `jobId` + pollable status URL; polling reports
   `queued | processing | completed | failed`; a `completed` job's transcript feeds
   `ingestText` → `savePending` (PENDING proposals, same path as text paste).

6. **AC-6 — Jobs survive reload.**
   A `processing` job row is still retrievable with its `companyId` and prior
   status after a simulated server restart (DB row persists; no in-memory-only
   state on the production path).

7. **AC-7 — Empty/unintelligible audio degrades gracefully.**
   A silent `.mp3` produces an empty transcript, job marked `completed` with an
   explicit `empty`/`no-speech` marker, and ingest yields zero new proposals.

8. **AC-8 — Size/duration limits enforced before work.**
   A >100 MB upload is rejected with `413`/`400` (size reason); a >120 min media
   file is rejected with `400` (duration reason); no job row is created in either
   case. Limits are env-configurable.

9. **AC-9 — Text/CSV capture unaffected by backend absence.**
   With no `whisper.cpp` installed, `/api/ingest` text and CSV paths still produce
   PENDING proposals exactly as today; only media ingestion surfaces the
   unavailable signal.

10. **AC-10 — Stub-pinning tests updated, not dropped.**
    `ocr-transcription.test.ts` (and any new transcription test files) contain no
    happy-path assertion expecting `"Transcription pending"`, `"not yet
    integrated"`, or `provider: "stub"`; they include a real-transcript happy path
    test AND an explicit-unavailability test covering the same edge.

11. **AC-11 — Unsupported codec is explicit.**
    A media file in a codec the provider cannot decode produces an explicit
    decoding error and a `failed` job — not a silent `method: "unsupported"`
    placeholder.

## Test plan (one or more tests per criterion)

| AC | File | RED assertion (current code) | GREEN behavior (after impl) |
|----|------|-------------------------------|------------------------------|
| 1 | `web/src/ai/ocr-transcription.test.ts` (updated) | `method === "unsupported"`, `text` contains `"Transcription pending"` | `method === "text"`, non-placeholder `text`, `provider ∈ {whisper-cpp, whisper-api}`, `confidence > 0` |
| 2 | `web/src/ai/ocr-transcription.test.ts` (updated) | `video/webm` → `method === "unsupported"` | `method === "text"`, recognized speech returned |
| 3 | `web/src/ai/transcription.test.ts` (new/updated) | unreachable backend → `provider: "stub"`, placeholder text | typed error or `provider: "unavailable"`; no `stub` content |
| 4 | `web/src/ai/transcription.test.ts` | `createTranscriptionService()` returns Ollama→Stub chain | returns configured provider; default `whisper-cpp`, `cloud` when env set |
| 5 | `web/test/app/media-upload.test.ts` (new) + `web/test/app/job-status.test.ts` (new) | no upload route reaches `processFile` for media; no job row | upload → `jobId` + status URL; DB job row `queued`/`processing`; poll → status transitions; `completed` → `ingestText`/`savePending` PENDING proposals |
| 6 | `web/test/server/transcription-job.test.ts` (new) | in-memory-only state lost on reload | DB row persists across simulated restart with `companyId` and status intact |
| 7 | `web/src/ai/ocr-transcription.test.ts` (updated) | silent audio → placeholder text + fake success | empty transcript, `completed` + `empty`/`no-speech` marker, zero new proposals |
| 8 | `web/test/app/media-upload.test.ts` (new) | no limits enforced | >100 MB → `413`/`400` size reason; >120 min → `400` duration reason; no job row |
| 9 | `web/test/app/ingest.test.ts` (extended) | n/a (already green for text/CSV) | text/CSV ingest still produces PENDING proposals with no `whisper.cpp` installed |
| 10 | `web/src/ai/ocr-transcription.test.ts` (updated) | tests pin `"Transcription pending"` / `"not yet integrated"` / `provider: "stub"` | no happy-path assertion expects stub strings; real-transcript + explicit-unavailability tests present |
| 11 | `web/src/ai/transcription.test.ts` (new/updated) | unknown codec → `method: "unsupported"` placeholder | explicit decoding error → `failed` job |

Runner: `npm --prefix web run test` (Vitest). Every AC goes RED on current code,
GREEN after implementation, and stays green after triangulation. Provider calls
MUST be mocked at the provider boundary (HTTP/CLI to `whisper.cpp`) so tests do
not require a real Whisper runtime.

## Risks

- **whisper.cpp binary in CI**: Tests must mock the provider boundary; a real
  `whisper.cpp` cannot be a CI prerequisite. The apply phase must keep the provider
  seam injectable.
- **Duration probing**: Probing duration before enqueue may itself require a
  media-inspection step (ffprobe or similar) — adds a dependency. If probing is too
  heavy for v1, the apply phase may defer duration enforcement to the worker and
  fail the job with a `400`-equivalent reason; this must be flagged as a deviation.
- **Cloud provider credentials**: The cloud path is config-driven; tests should
  not require live credentials. Leaving it unconfigured must degrade to explicit
  unavailability, not a crash.
- **Job table migration**: A new Drizzle table is an additive schema migration; the
  apply phase must ensure migrations run cleanly in the existing Postgres stack.
- **Flat spec shape**: This change uses the legacy flat `spec.md` (per task
  instruction and consistent with sibling in-flight changes). Archive must handle
  this shape; a future refactor should move it to `specs/transcription/spec.md`.
