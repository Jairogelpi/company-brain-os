# Add Financial Risk Exposure

## Why

"Bus factor = 1" is a metric an engineer understands; it is **not** something a
business owner pays to fix. Owners pay to avoid losing money. Today the app
detects key-person risk but never translates it into euros, so the value is
invisible to the buyer.

No competitor (Notion, Confluence, Guru, Tettra, succession-planning HR tools)
expresses knowledge risk as a **quantified financial exposure**. This is the
single sharpest sales wedge: turn every detected risk into a number a CFO reacts
to.

> "If Pedro leaves: production halted ~3 days · €18,000 estimated loss · 6 weeks
> to replace."

## What Changes

- Capture a lightweight **cost model** as node attributes:
  - `Process` / `Knowledge`: `downtimeCostPerDay` (€), `recoveryDays`.
  - `Person`: `replacementCost` (€), `replacementWeeks`.
- New pure module `financial-exposure.ts` that maps each `DetectedRisk` to a
  monetary exposure and aggregates total organizational exposure.
- Surface euros on risk cards, the person detail page, and a new dashboard
  headline stat **"Exposure at risk"**.
- Sensible defaults + per-tenant currency so the product works before the owner
  fills in any number.

## Impact

- Affected specs: `financial-exposure` (new), extends `risk-engine` consumption.
- Affected code: `src/domain/risk-engine.ts` (read-only consumer), new
  `src/domain/financial-exposure.ts`, `src/db/schema.ts` (node attributes —
  already `jsonb`, no migration), dashboard + people pages.
- Prerequisite for [add-bus-factor-simulator] (simulator reuses the cost model).

## Positioning (post-pivot)

The € figure is the **number that powers the audit and the sale** — it is what a
CFO reacts to in the simulator (#3) and what prioritizes the playbook (#2). It is
not a metric the SME tends daily; it is computed on demand from the cost model.

## PYME Reality Check

- **Chaos CEO:** the formula is transparent and the assumptions are editable, so
  when he says "that number is made up", you show (and let him change) the inputs.
  Defaults mean he sees a euro figure with zero setup.
- **Excel Defender:** an owner *could* multiply downtime × days in a cell — but
  not auto-attach it to every detected risk and de-duplicate across the graph.
  Real but modest win; its value is as fuel for #2 and #3, not standalone.

