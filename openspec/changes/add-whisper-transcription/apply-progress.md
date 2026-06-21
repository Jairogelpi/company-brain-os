# Apply Progress — add-whisper-transcription

## Status

Complete. Applied in 9 reviewable commits after the initial subagent was blocked by a 429 usage limit.

## Commits

- `6432a9f feat(transcription): PR1a provider factory and whisper backends`
- `5c54835 feat(transcription): PR1b wire media files through provider seam`
- `77d7e86 test(transcription): PR1c cover whisper provider factory`
- `a0f8ad0 feat(transcription): PR2a add transcription_jobs schema`
- `7af8005 feat(transcription): PR2b add transcription job store`
- `a5bd57c feat(transcription): PR2c add worker and ingest wiring`
- `02710e6 feat(transcription): PR3a add media upload size limits`
- `5800480 feat(transcription): PR3b add transcribe job routes`
- `0c50049 feat(transcription): PR3c start transcription worker on server boot`

## Resolved apply decisions

- `ffprobe`: no hard binary dependency. Route enforces size; duration pre-probe is skipped unless future ffprobe support is added.
- `transcribeWithWhisper`: removed from production path.
- Migration number: `0008_transcription_jobs.sql` because RAG used `0007`.
- AC-6 test shape: strict row re-enqueue/sweep behavior covered by worker tests.

## Validation

- `npm --prefix web run typecheck` — pass.
- `npm --prefix web run test -- --run` — pass, 473 passed / 3 skipped after all three changes.
- Prohibited stub strings only remain in negative assertions/type guards, not production happy paths.
