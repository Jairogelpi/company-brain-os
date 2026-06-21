# Explore — add-whisper-transcription

## Idea

Make audio/video ingestion real. Today `transcribeWithWhisper()` and `OllamaTranscriptionService` are stubs returning placeholders, and `processFile()` routes audio/video to `method: "unsupported"`. Wire a real speech-to-text backend so meeting recordings and interviews become first-class capture sources alongside CSV and text.

## Current state (evidence)

- `web/src/ai/ocr-pipeline.ts`:
  - `processFile()` returns `{ method: "unsupported", confidence: 0 }` for `audio/*` and `video/*`.
  - `transcribeWithWhisper()` returns `"[Transcription via Whisper not yet integrated...]"` — explicit stub.
- `web/src/ai/transcription.ts`:
  - `TranscriptionService` interface exists (`transcribe(filePath, mimeType)`, `transcribeBuffer(buffer, mimeType)`).
  - `OllamaTranscriptionService` checks Ollama reachability but falls back to `StubTranscriptionService` because "Ollama doesn't have native audio input via API yet."
  - `createTranscriptionService()` factory returns the Ollama service (which degrades to stub).
- `web/src/ai/ocr-transcription.test.ts`: asserts the stub text and fallback behavior — these tests pin the current stub contract and will need updating.
- Capture surface: `/api/ingest` and the inbox accept CSV/text only; there is no upload path that reaches `processFile()` for media today (uploads dir + `processFile` exist but are not wired to ingest).

## Why now

The product pitch is "map tacit knowledge from people." Interviews and meetings are the richest source and they are audio. The stub makes the whole media-ingest story non-functional. pgvector + AGE infrastructure is already in place for the downstream graph extraction, so transcription is the missing upstream step.

## Non-goals

- Real-time streaming transcription.
- Speaker diarization (multi-speaker labels) in v1 — single channel transcript is enough to feed the existing extractor.
- Video frame analysis / multimodal vision.
- Replacing Tesseract OCR for images/PDFs.

## Open questions for proposal

1. Backend choice: local `whisper.cpp` (free, CPU/GPU, no API key) vs cloud STT API (OpenAI Whisper, Deepgram, AssemblyAI) vs Ollama audio when it lands. Tradeoff: cost, latency, privacy, deployment complexity.
2. File size / duration limits and where to enforce them (route vs service).
3. Sync vs async: transcribe-on-request (blocking) vs job queue + poll. For v1 a simple async job with status polling fits the existing inbox model.
4. Where the transcript feeds: reuse `analyzeTextWithLLM` / the interview extractor on the transcript text, or a dedicated media-ingest proposal flow?

## Assumptions to validate

- The existing `TranscriptionResult` shape (`text`, `language`, `confidence`, `provider`) is sufficient for v1.
- Transcripts should flow through the same ingest → inbox → graph-proposal pipeline as text paste.
