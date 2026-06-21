# Design — Financial Risk Exposure

## Context

The risk engine (`src/domain/risk-engine.ts`) already classifies risks
(single-point-of-failure, bus-factor-zero, undocumented-critical, low-resilience).
We add a pure costing layer on top — no change to detection.

## Decisions & tradeoffs

### Where the cost model lives
- **Chosen:** store cost fields inside the existing `nodes.attributes` jsonb.
  - + No migration, no schema churn, tenant-flexible.
  - − Not queryable as columns; acceptable since exposure is computed in app code.
- Rejected: dedicated `node_costs` table — more rigor, but premature; revisit if
  we need SQL aggregation across millions of nodes.

### Estimate vs. precision
- **Chosen:** always produce a number, mark `estimated: true` when defaults were
  used. Owners get value on day one and refine later.
  - Tradeoff: an estimate can be wrong; we mitigate by labeling it clearly and
    making the assumptions (recoveryDays, defaults) visible/editable.
- Rejected: require full cost input before showing euros — kills activation.

### Exposure formula (v1, deliberately simple)
`exposure = downtimeCostPerDay × recoveryDays + replacementCost`
- ponytail: a transparent, defensible formula beats a black-box model the buyer
  can't trust. Upgrade path: add ramp-up productivity loss, customer-churn risk.

### De-duplication
Aggregate exposure must not count the same critical node twice when it appears
in multiple risks. Group by the primary at-risk node id before summing.

## Currency
Single `currency` per company (default EUR) stored on the company record;
formatting in the UI only. No FX.
