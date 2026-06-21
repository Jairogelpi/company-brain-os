# Proposal — llm-succession-playbooks

## Problem

The succession playbook generator (`generatePlaybook`) is heuristic: it prioritizes correctly but produces generic actions ("Transfer knowledge of {X}"). The plan lacks concrete transfer steps, suggested trainers, timeline rationale, and risk callouts that a human owner needs to actually execute an offboarding. The AI consultant already proves structured LLM recommendations work in this codebase; the playbook just doesn't use them.

## Outcome

A departing person's playbook is an LLM-enriched, dated, specific knowledge-transfer plan: each action carries concrete steps, a suggested trainer (from the graph), rationale tied to documented/critical state, and a risk note — while the deterministic heuristic keeps prioritization and dating stable and remains the fallback when the LLM is unavailable.

## Target users and situations

- Owner/validator preparing an offboarding plan when someone resigns.
- Reviewer checking that a high-criticality, undocumented area has a real transfer plan, not a one-liner.

## Current-state gap

- `PlaybookAction` has only `action` (generic), `priorityScore`, `targetDate`, `busFactor`, `criticality`, `documented`.
- No LLM enrichment; no trainer suggestion; no per-step detail; no risk narrative.
- `consultant.ts` patterns (structured recommendations + fallback) are not reused here.

## Implications and impact

- Richer, actionable playbooks → higher product value for the succession story.
- LLM cost per playbook generation (bounded: one call per departing person, subgraph context).
- Must preserve heuristic fallback and deterministic ordering (no non-determinism in priority/dates).

## Edge cases

- LLM unavailable → return heuristic-only playbook (current behavior).
- Person holds no mapped knowledge → empty plan with explanation (existing behavior).
- Subgraph with no candidate trainers → LLM notes "no internal candidate; document + external hire."
- LLM returns malformed enrichment → keep heuristic `action`, drop enrichment fields.

## First-slice scope boundaries

In:

- Extend `PlaybookAction` with optional LLM fields: `detailedSteps: string[]`, `suggestedTrainerId?: string`, `suggestedTrainerName?: string`, `rationale: string`, `riskNote?: string`.
- New `enrichPlaybookWithLLM(playbook, graph, config?)` that keeps order/dates and fills enrichment per action.
- Heuristic stays the source of `priorityScore` and `targetDate`.
- Wire into `succession/page.tsx` generate flow with graceful fallback.

Out (v1):

- Auto-assigning trainers to missions without confirmation.
- Calendar/HRIS scheduling.
- Multi-turn plan refinement chat.

## Non-goals

- Replacing the heuristic prioritization.
- Changing the mission persistence model.

## Product constraints

- Deterministic priority + dates (LLM never reorders or reschedules).
- Graceful fallback to current behavior when LLM absent.
- Citations/grounding: suggested trainer must be an existing graph node (not invented).

## Decision gaps to resolve in spec

- Context window: full graph vs person subgraph (subgraph recommended).
- Enrichment granularity: per-action vs whole-plan narrative (per-action keeps structure).
- Whether `enrichPlaybookWithLLM` is in `domain/succession.ts` or `ai/` (ai/ keeps domain pure).

## Business tradeoffs

- LLM enrichment meaningfully improves actionability vs the generic heuristic — worth one bounded call per plan.
- Keeping the heuristic as backbone preserves determinism and trust; LLM only adds detail.
- Per-action enrichment is cheaper and more reviewable than a free-form narrative.
