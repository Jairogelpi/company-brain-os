# Add Succession & Offboarding Playbook — THE ENTRY WEDGE

## Why

The PYME Chaos Reality review showed prevention doesn't sell: SMEs don't buy
low-frequency insurance proactively. But the **moment of pain — a resignation —
is exactly when the owner will pay**, because the cost of a bad handover is
immediate and tangible.

So the succession playbook is not a feature; it is the **product you sell**. The
pitch: *"The day someone resigns, you get a prioritized 24-hour knowledge-transfer
plan."* That is real day-one value at the precise moment the buyer feels the pain.

The engines exist: `createMissionsFromReport` turns risks into actions,
`computeTransferVelocity` estimates how fast each piece can move.

## What Changes

- A **playbook generator**: given a departing person (+ last working day), produce
  an ordered transfer plan:
  - what to document, who to train, in what sequence,
  - prioritized by criticality × financial exposure × (inverse) transfer velocity,
  - with target dates scheduled backward from the last day.
- Persist missions to the database (new `missions` table) so the plan is durable,
  assignable, and trackable — today missions are in-memory only.
- Export to Markdown / print (PDF via browser) to hand to HR.
- A **"someone is leaving" entry flow** as the primary call to action.

## Impact

- Affected specs: `succession` (new) — sell-order **#1 wedge**, build-order after
  [add-passive-capture] (needs a populated graph) and [add-financial-risk-exposure]
  (for the € prioritization; falls back to criticality-only).
- Affected code: surface `src/domain/missions.ts` + `computeTransferVelocity`;
  new `missions` table + repository + `/api/missions`; new `(app)/succession` page.

## PYME Reality Check

- **Chaos CEO:** ✅ accepts — it arrives at the exact moment of pain and produces a
  concrete result (the plan) with near-zero work from him.
- **Excel Defender:** a spreadsheet can list what Pedro knows, but it can't
  auto-prioritize by exposure × transfer velocity nor schedule backward from a
  last day. Marginal but real win — strongest when the graph already exists
  (thanks to #1).
- **Day-one value:** a finished, dated, assignable transfer plan in minutes.
