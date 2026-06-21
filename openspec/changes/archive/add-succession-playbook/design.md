# Design — Succession & Offboarding Playbook

## Context

`src/domain/missions.ts` already models missions, valid transitions, and
`createMissionsFromReport` / `createMissionFromRisk`. `computeTransferVelocity`
estimates transfer effort. Missions currently live only in memory.

## Decisions & tradeoffs

### Persisting missions
- **Chosen:** add a `missions` table + drizzle repository + `/api/missions`,
  scoped by `companyId` (same pattern as the graph repository).
  - + Plans become durable, assignable, trackable — the actual product value.
  - − New table + migration. Justified: a playbook you lose on refresh is
    demoware, not a feature.
- Reuse the existing `getGraphService`/repository scoping conventions for tenancy.

### Prioritization formula
`priority score = criticality_weight × exposure × (1 / transferVelocity)`
- ponytail: transparent weighted sort, not an optimizer. Falls back to
  `criticality → busFactor` when exposure is absent so it works without
  [add-financial-risk-exposure].
- Tradeoff: a heuristic, not provably optimal; good enough and explainable.

### Date scheduling
Schedule backwards from `lastDay`: higher-priority actions get earlier slots,
spaced evenly. ponytail: even spacing beats a capacity-planning solver for v1;
upgrade path is per-assignee load balancing.

### Export
- **Chosen:** render Markdown + a print stylesheet (browser → PDF). No PDF lib.
  - + Zero dependency, shareable immediately.
  - − Less control over PDF layout; acceptable for an internal HR doc.
