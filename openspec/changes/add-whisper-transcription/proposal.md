# Proposal — add-whisper-transcription

## Problem

Audio and video are the richest sources of tacit organizational knowledge (interviews, meetings, handover recordings), but ingestion is non-functional: `transcribeWithWhisper()` is a stub and `processFile()` marks all media as `unsupported`. The capture pipeline only works for CSV and pasted text, so the product cannot actually ingest the conversations it is designed to map.

## Outcome

Users can upload an audio/video file (meeting recording or interview) through the existing capture flow and receive a transcript that feeds the same graph-proposal inbox as text paste — no manual transcription step, no third-party tool.

## Target users and situations

- Operators capturing a departing expert's handover recording.
- Interviewers recording an in-person knowledge interview.
- Anyone with existing meeting recordings who wants to extract the knowledge graph from them.

## Current-state gap

- `transcription.ts` has the right interface but no real provider.
- `ocr-pipeline.ts` stubs Whisper and routes media to `unsupported`.
- No upload route reaches `processFile()` for media today; `/api/ingest` accepts `text`/`csv` only.

## Implications and impact

- Unblocks the entire audio/video capture story.
- Introduces a new external dependency (Whisper runtime) and potentially long-running work → needs async job handling.
- Privacy: audio may contain sensitive content; a local backend (whisper.cpp) keeps data on-prem and aligns with the self-hosted Postgres/AGE/Ollama stack.
- Downstream extractor and inbox are unchanged — transcript is just text once produced.

## Edge cases

- Empty/unintelligible audio → empty transcript → graceful "nothing extracted" (existing inbox behavior).
- Large files (1h+ meeting) → timeout/memory; needs chunking or duration cap.
- Unsupported codec → clear error, not a silent stub.
- Backend unavailable → degrade with an explicit `provider: "unavailable"` error, NOT a placeholder string that looks like content.

## First-slice scope boundaries

In:

- One real transcription provider (whisper.cpp local, recommended) with cloud STT as configurable fallback.
- Async job: upload → enqueue → poll status → transcript text into ingest pipeline.
- Wire transcript through the existing text ingest → inbox → proposals flow.

Out (v1):

- Speaker diarization, streaming, video frames.
- A job-queue infra replacement (use a DB-backed job row or in-memory queue for v1).

## Non-goals

- Replacing OCR (Tesseract) for images/PDFs.
- Multimodal vision.
- Real-time transcription.

## Product constraints

- Must respect `prefers-reduced-motion`? N/A (backend).
- Must degrade gracefully when the backend is absent (the app stays usable for text/CSV capture).
- Self-hostable: local whisper.cpp is the default to match the existing Ollama/Postgres self-hosted posture.

## Decision gaps to resolve in spec

- Exact backend: `whisper.cpp` local vs cloud API vs both behind a config flag.
- Job persistence: DB table vs in-memory map (DB needed for durability across reloads).
- Max file size / duration for v1.

## Business tradeoffs

- Local whisper.cpp = zero marginal cost, on-prem privacy, but heavier ops (model download, CPU/GPU). Cloud = faster setup, per-minute cost, data egress.
- Async jobs add complexity but are unavoidable for media; the inbox model already handles async proposals.
