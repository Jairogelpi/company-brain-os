# Adaptive interview

The interview asks one question at a time, deepens when an answer indicates continuity fragility and widens when the area is adequately covered. Optional AI can draft the next question and extract structured proposals; deterministic prompts and extraction remain available when the provider is absent.

The security boundary is fixed: interview output is untrusted proposal data. It enters the durable Inbox, requires an explicit human decision and only then becomes approved assertions through the canonical writer. The interview and AI never write the graph projection directly.

Primary implementation: `src/domain/interview.ts`, `src/ai/extraction.ts`, `src/app/api/interview`, `src/app/api/inbox`.
