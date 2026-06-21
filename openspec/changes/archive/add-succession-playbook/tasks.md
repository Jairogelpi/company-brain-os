# Tasks — Succession & Offboarding Playbook

## 1. Persistence
- [x] 1.1 `missions` table in `src/db/schema.ts` (companyId, personId, objective, targetNode, priority, status, dueDate, assigneeIds, createdBy)
- [x] 1.2 Migration 0005; `src/server/missions.ts` scoped by companyId
- [x] 1.3 `/api/missions` (GET list, POST batch from playbook, PATCH transition) with auth guards (mission.create)

## 2. Playbook generator
- [x] 2.1 `src/domain/succession.ts` — `generatePlaybook(personId, graph, { lastDay?, exposure? })`
- [x] 2.2 Priority sort: criticality × exposure × urgency(busFactor); fallback criticality→busFactor (exposure pluggable for #4)
- [x] 2.3 Backward date scheduling from lastDay
- [x] 2.4 Unit tests for ordering + scheduling scenarios (6 TDD tests)

## 3. UI
- [x] 3.1 `(app)/succession/page.tsx` — pick person + last day → generated plan (client-side)
- [x] 3.2 Save plan → persists missions; reload shows them
- [x] 3.3 Mission status transitions in UI (valid next-states from VALID_TRANSITIONS)
- [x] 3.4 Export to Markdown (clipboard); print via browser. [ ] dedicated print stylesheet (uses default print)
- [x] 3.5 "Succession" in sidebar nav

## 4. Verify
- [x] 4.1 `npm run typecheck` + `npm test` (286) + migration applies
- [x] 4.2 Live: generated playbook for Pedro, saved, reloaded, transitioned (open→in_progress); invalid transition rejected (400); tenant-scoped

## Notes
- Exposure (€) ordering depends on [add-financial-risk-exposure] (#4); generator
  accepts an optional `exposure` map and falls back to criticality→busFactor today.
- transferVelocity factor deferred (needs historical level data); busFactor used
  as the urgency proxy.
