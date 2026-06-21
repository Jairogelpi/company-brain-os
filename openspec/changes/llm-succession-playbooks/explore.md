# Explore — llm-succession-playbooks

## Idea

Upgrade the succession playbook from a heuristic list (`criticality × bus factor × exposure`) to an LLM-generated, narrative knowledge-transfer plan: concrete transfer steps, suggested trainers, timeline rationale, and risk callouts derived from the graph — while keeping the heuristic as the deterministic fallback and the source of prioritization.

## Current state (evidence)

- `web/src/domain/succession.ts`:
  - `generatePlaybook(personId, graph, options)` is pure/heuristic: builds `PlaybookAction[]` ordered by `priorityScore = criticalityWeight × (busFactor+1) × exposureWeight`, sets `targetDate` from `lastDay`.
  - No LLM, no narrative, no transfer-step detail beyond a generic `action` string.
- `web/src/ai/consultant.ts`:
  - Already does LLM recommendations (`ConsultantRecommendation` with `type`, `priority`, `targetNode`, `message`, `rationale`, `roiHint`) with heuristic fallback.
  - Established `chatCompletion` + `getLlmConfig` + `configureLlm` pattern.
- `web/src/app/(app)/succession/page.tsx`: UI calls `generatePlaybook` and renders actions; saves missions via `/api/missions`.
- `web/src/domain/financial-exposure.ts`: `exposureByNode` feeds € exposure into playbook prioritization already.

## Why now

The heuristic playbook is useful but generic ("Transfer knowledge of X"). An LLM can read the graph (who else knows parts of this, documented state, dependencies) and produce a specific, dated transfer plan: "Pair Laura with Pedro for 2 weeks on filler configuration; document SOP by week 3 because it's undocumented and critical." This is the highest-leverage AI value for the succession story.

## Non-goals

- Replacing the heuristic prioritization (it stays as the deterministic backbone + fallback).
- Auto-assigning trainers without human confirmation.
- Calendar/HRIS integration for scheduling.
- Replacing the mission persistence model.

## Open questions for proposal

1. LLM input: full graph context (nodes/edges/metrics) vs only the departing person's subgraph. Subgraph is cheaper and more focused.
2. Output shape: enrich existing `PlaybookAction` with LLM fields (`detailedSteps`, `suggestedTrainer`, `riskNote`) vs a separate `NarrativePlan`. Enriching existing keeps the UI/mission model stable.
3. Determinism: heuristic still sets order + dates; LLM only enriches each action's detail.
4. Fallback: when LLM unavailable, keep current `action` string.

## Assumptions to validate

- The LLM can produce structured per-action enrichment reliably (the consultant already does structured recommendations).
- Subgraph context (person + their knowledge + experts + dependencies) fits in one prompt.
