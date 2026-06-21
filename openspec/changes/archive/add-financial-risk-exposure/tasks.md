# Tasks — Financial Risk Exposure

## 1. Cost model
- [x] 1.1 `CostModel` read from `nodes.attributes` (downtimeCostPerDay, recoveryDays, replacementCost)
- [x] 1.2 Global defaults + `EUR` currency (per-company override = future; ponytail)
- [x] 1.3 No migration — uses existing `attributes` jsonb

## 2. Exposure engine
- [x] 2.1 `src/domain/financial-exposure.ts`
- [x] 2.2 `computeRiskExposure(risk, nodes)` → `{ exposure, currency, estimated, … }`
- [x] 2.3 `computeTotalExposure(risks, nodes)` with de-dup by at-risk node; `exposureByNode` for the playbook; `formatMoney`
- [x] 2.4 Unit tests: 18000 example; defaults flagged estimated; de-dup (4 TDD tests)

## 3. Capture UI
- [ ] 3.1 Cost fields on the node/knowledge edit surface (owner/validator) — deferred; defaults work today
- [x] 3.2 Estimated handled (defaults flagged; UI can read `estimated`)

## 4. Surface euros
- [x] 4.1 Dashboard headline stat "Exposure at risk" (de-duplicated total)
- [x] 4.2 Euro figure on the "most pressing risk" panel
- [x] 4.3 Person detail: "If they leave: €X exposure"
- [x] 4.4 Wired into succession playbook prioritization (exposureByNode → generatePlaybook)

## 5. Verify
- [x] 5.1 `npm run typecheck` + `npm test` (290)
- [x] 5.2 Live: dashboard €20,000 exposure, top risk €10,000, Pedro "if they leave €10,000"

## Notes
- Default formula: downtimeCostPerDay × recoveryDays + replacementCost. Defaults
  1000 €/day, 5 days, 5000 € → €10,000 per critical SPOF until real costs entered.
- Editable cost inputs (3.1) + per-company currency/defaults are the next refinement.
