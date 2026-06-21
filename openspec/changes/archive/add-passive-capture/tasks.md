# Tasks — Passive Capture (Zero-Effort Auto-Map) · BUILD #1

## 1. Ingestion pipeline
- [x] 1.1 Source boundary (`EmployeeRow` structured rows) + `src/domain/ingest.ts`
- [x] 1.2 Structured mapper: employee rows → Person + Unit + BELONGS_TO (manager as attribute; no invalid reporting edge)
- [x] 1.3 Text mapper (`ingestText`): reuse interview engine → proposals (3 TDD tests)
- [x] 1.4 Attach `source` provenance; dedupe against existing node ids
- [x] 1.5 `POST /api/ingest` (auth: contributor+) → returns proposals (no writes)
- [x] 1.6 Unit tests: employee list → person/edge proposals; empty → none; re-run dedupes; CSV parse (8 tests, TDD)

## 2. Sources (v1, no integration setup)
- [x] 2.1 Employee list upload (CSV) — the "llega hecho" first run
- [x] 2.2 Paste text + txt/md upload (read client-side → /api/ingest text)

## 3. Review inbox
- [x] 3.1 `(app)/inbox/page.tsx` — proposals grouped by source with provenance
- [x] 3.2 Approve selected → `POST /api/graph/proposals`; reject = deselect (discard)
- [x] 3.3 Role/tenant guards (viewer cannot approve; scoped by companyId)
- [x] 3.4 `ingestion_items` table — durable queue + provenance/audit (status: pending/approved/rejected); `/api/inbox` GET list + POST approve/reject
- [x] 3.5 "Inbox" in sidebar nav + pending count badge

## 4. Verify
- [x] 4.1 `npm run typecheck` + `npm test` (277 passing)
- [x] 4.2 Live: CSV → draft map proposals (zero typing) → approve → Marta/Javier on /people, tenant-scoped

## Bonus (found during verify)
- [x] Fixed a production bug: `persistent-graph-service` emitted per-instance
      event ids (`evt-1`…) → `event_log` PK collisions across requests, breaking
      ALL writes once events existed. Now `evt-${crypto.randomUUID()}` + a test.
