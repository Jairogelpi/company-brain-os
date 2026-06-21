# Succession (LLM-Enriched Playbooks) Specification

> Domain: `succession`. This change introduces LLM enrichment while preserving the
> deterministic heuristic backbone. No canonical `openspec/specs/succession/spec.md`
> exists yet, so this is a full new-domain spec for the change; archive will copy it
> into `openspec/specs/succession/spec.md`.

## Purpose

Produce an actionable, dated knowledge-transfer plan for a departing person. The
heuristic remains the deterministic source of prioritization and target dates;
the LLM only adds concrete transfer steps, suggested trainers, rationale, and
risk notes per action. The system MUST degrade gracefully to the current
heuristic-only playbook whenever the LLM is unavailable or returns unusable
output.

## Requirements

### Requirement: Generate a transfer playbook for a departing person

The system SHALL generate an ordered set of knowledge-transfer actions for a
selected person, derived from the knowledge they solely or critically hold.
Prioritization and target dates MUST come solely from the deterministic
heuristic.

#### Scenario: Playbook covers sole-expert knowledge first

- **GIVEN** a person who masters two areas (one critical, one not) and is the sole expert of each
- **WHEN** a playbook is generated for that person
- **THEN** the playbook contains a transfer action for each area
- **AND** the critical area is ordered before the non-critical one

#### Scenario: Prioritization uses exposure and transfer velocity

- **GIVEN** two critical areas with equal criticality but different financial exposure
- **WHEN** a playbook is generated
- **THEN** the higher-exposure area is ordered first
- **AND** when exposure is unavailable, ordering falls back to criticality then bus factor

#### Scenario: Empty plan for a person holding no mapped knowledge

- **GIVEN** a person with no `MASTERS` edges to any knowledge node
- **WHEN** a playbook is generated for that person
- **THEN** the playbook has zero actions
- **AND** the playbook summary explains the empty result

### Requirement: Target dates from a last day

The system SHALL assign suggested target dates to playbook actions when a last
working day is provided, scheduling backwards from that date.

#### Scenario: Actions are scheduled before the last day

- **GIVEN** a last day 30 days away and a playbook with 3 actions
- **WHEN** the playbook is generated with that last day
- **THEN** each action receives a target date on or before the last day
- **AND** higher-priority actions are scheduled earlier
- **AND** LLM enrichment MUST NOT change any action's order or target date

### Requirement: LLM-enriched action detail (per-action enrichment)

The `PlaybookAction` type MUST be extended with optional enrichment fields:
`detailedSteps: string[]`, `suggestedTrainerId?: string`,
`suggestedTrainerName?: string`, `rationale: string`, and `riskNote?: string`.
These fields MUST be filled by an LLM enrichment pass when the LLM is
available; they MUST be absent (or empty) otherwise. The heuristic's
`priorityScore`, `action`, and `targetDate` MUST remain unchanged by
enrichment.

#### Scenario: Enrichment fills concrete steps, trainer, rationale, and risk note

- **GIVEN** a heuristic playbook for a person whose critical undocumented area has another `MASTERS` expert in the graph
- **WHEN** `enrichPlaybookWithLLM(playbook, graph, config)` runs with a configured LLM
- **THEN** each action's `detailedSteps` is a non-empty array of concrete transfer steps
- **AND** each action's `rationale` references that action's criticality and/or documentation state
- **AND** each action's `suggestedTrainerId` corresponds to an existing graph node of type `Person` (not invented)
- **AND** `priorityScore`, `action`, and `targetDate` are byte-for-byte identical to the heuristic input

#### Scenario: Suggested trainer must be grounded in the graph

- **GIVEN** an LLM response that names a trainer who is not a real `Person` node
- **WHEN** the enrichment parses that response
- **THEN** the ungrounded `suggestedTrainerId`/`suggestedTrainerName` MUST be discarded
- **AND** the action keeps its heuristic `action` and `detailedSteps` MAY be dropped

#### Scenario: Subgraph with no candidate trainers

- **GIVEN** an action whose knowledge has no other `MASTERS` expert in the graph
- **WHEN** enrichment runs
- **THEN** the action's `riskNote` MUST mention there is no internal candidate
- **AND** the rationale SHOULD recommend documentation plus external hire or reassignment

### Requirement: Graceful fallback to heuristic behavior

The system MUST return a heuristic-only playbook (current behavior) whenever the
LLM is unavailable, misconfigured, network-errored, or returns output that
cannot be parsed into the required per-action shape. Fallback MUST preserve the
order, dates, and `action` strings of the heuristic playbook.

#### Scenario: No LLM configured

- **GIVEN** a heuristic playbook and `getLlmConfig()` returning `null`
- **WHEN** `enrichPlaybookWithLLM` is called
- **THEN** the returned playbook is identical to the heuristic input (same actions, order, dates, no enrichment fields)

#### Scenario: LLM network error

- **GIVEN** a configured LLM that throws on `chatCompletion`
- **WHEN** enrichment is called
- **THEN** enrichment catches the error and returns the heuristic-only playbook unchanged

#### Scenario: LLM returns malformed JSON

- **GIVEN** a configured LLM whose response is not parseable to the per-action enrichment shape
- **WHEN** enrichment is called
- **THEN** the system drops the malformed enrichment and returns the heuristic-only playbook with heuristic `action` strings preserved

#### Scenario: Partially malformed response keeps valid actions intact

- **GIVEN** an LLM response that enriches 2 of 3 actions validly but is malformed for the third
- **WHEN** enrichment is applied
- **THEN** the 2 valid actions keep their enrichment fields
- **AND** the third action keeps its heuristic `action` with no enrichment fields
- **AND** order, `priorityScore`, and `targetDate` across all three actions are unchanged

### Requirement: `enrichPlaybookWithLLM` lives in the AI layer

The `enrichPlaybookWithLLM(playbook, graph, config?)` function MUST reside in
`web/src/ai/` (not `web/src/domain/succession.ts`) to keep the domain module
LLM-free and pure. `web/src/domain/succession.ts` MUST NOT import from
`web/src/ai/`.

#### Scenario: Domain purity

- **WHEN** the module graph is inspected
- **THEN** `web/src/domain/succession.ts` has no imports from `web/src/ai/`
- **AND** `enrichPlaybookWithLLM` is exported from an `web/src/ai/` module

#### Scenario: Heuristic remains the backbone

- **GIVEN** an existing call site that only uses `generatePlaybook` (e.g. a non-LLM test)
- **WHEN** that call runs
- **THEN** the result is the heuristic-only playbook with no enrichment fields present

### Requirement: Subgraph context (not full graph) for the LLM prompt

To bound cost and keep the prompt focused, the LLM prompt MUST be built from the
departing person's subgraph (the person, the knowledge they master, other
experts for each of those knowledge areas, and adjacent dependencies) — NOT the
whole graph. The full graph MUST NOT be serialized to the prompt.

#### Scenario: Cost is bounded per departed person

- **GIVEN** a graph with 500 people and a departing person mastering 3 knowledge areas
- **WHEN** enrichment runs for that person
- **THEN** only nodes relevant to those 3 knowledge areas (their other experts and dependencies) appear in the prompt payload
- **AND** the prompt does not enumerate unrelated people or knowledge

### Requirement: Wire enrichment into the succession page with fallback

The succession page generate flow MUST attempt LLM enrichment after
`generatePlaybook` and MUST fall back to the heuristic-only playbook on any
enrichment failure. The UI MUST render the enriched fields when present and
MUST render the heuristic `action` when they are absent.

#### Scenario: Page uses enrichment when available

- **GIVEN** an owner opens the succession page, selects a departing person and a last day, and an LLM is configured
- **WHEN** they generate the playbook
- **THEN** the page shows `detailedSteps`, `suggestedTrainerName`, `rationale`, and `riskNote` (when present) per action
- **AND** the page preserves the heuristic order and dates

#### Scenario: Page falls back gracefully

- **GIVEN** the same page with no LLM configured
- **WHEN** they generate the playbook
- **THEN** the page shows the heuristic `action` strings and target dates with no enrichment fields
- **AND** no error surfaces to the user

### Requirement: Determinism and idempotent enrichment

Enrichment MUST NOT alter deterministic outputs. Calling
`enrichPlaybookWithLLM` on the same `(playbook, graph)` pair with the same LLM
configuration MUST be deterministic given a deterministic LLM response (the
heuristic portion is fully reproducible regardless).

#### Scenario: Heuristic outputs are stable across enrichment runs

- **GIVEN** the same `playbook` and `graph`
- **WHEN** `enrichPlaybookWithLLM` is called twice with the same LLM configuration and identical LLM responses
- **THEN** the two results are deeply equal

#### Scenario: LLM may reorder internally but never reorders output

- **GIVEN** an LLM response that lists enrichment in a different order from the heuristic
- **WHEN** enrichment is applied
- **THEN** emitted actions stay in heuristic `priorityScore` order
- **AND** target dates stay in the heuristic-assigned order

### Requirement: Durable, assignable missions (unchanged)

The system SHALL persist playbook actions as missions in the database, scoped
to the company, with status transitions. LLM enrichment fields MUST round-trip
through the mission persistence model so a saved-and-reloaded mission still
carries `detailedSteps`, `suggestedTrainerName`, `rationale`, and `riskNote`.

#### Scenario: Enrichment survives save and reload

- **WHEN** an owner generates and saves an enriched playbook
- **THEN** the reloaded mission retains the `detailedSteps`, `suggestedTrainerName`, `rationale`, and `riskNote` fields
- **AND** missions without enrichment (heuristic-only) save and reload without those fields

#### Scenario: Tenant isolation

- **WHEN** a user requests missions
- **THEN** only missions for their `companyId` are returned

### Requirement: Exportable playbook (unchanged)

The system SHALL render the playbook in a print/Markdown-friendly format for
sharing. When enrichment is present, the export MUST include `detailedSteps`,
`suggestedTrainerName`, `rationale`, and `riskNote` per action.

#### Scenario: Owner exports an enriched plan

- **WHEN** an owner opens a generated enriched playbook
- **THEN** they can export it as Markdown or print to PDF including steps, suggested trainer, rationale, and risk note per action

## Acceptance Criteria

This change is accepted when ALL of the following are true:

1. **AC-1 — Heuristic backbone preserved.** `generatePlaybook` output (order,
   `priorityScore`, `action`, `targetDate`) is byte-for-byte identical to the
   pre-change behavior across the existing vitest suite for succession.
2. **AC-2 — Enrichment fields typed.** `PlaybookAction` exposes optional
   `detailedSteps`, `suggestedTrainerId`, `suggestedTrainerName`, `rationale`,
   and `riskNote`; TypeScript typechecks (`npm --prefix web run typecheck`).
3. **AC-3 — Enrichment function in AI layer.** `enrichPlaybookWithLLM` is
   exported from `web/src/ai/` and `web/src/domain/succession.ts` imports
   nothing from `web/src/ai/`.
4. **AC-4 — Fallback verified.** New vitest cases cover: no LLM configured, LLM
   network error, malformed JSON response, and partially malformed response;
   each returns the heuristic-only playbook with order/dates unchanged.
5. **AC-5 — Trainer grounding.** A vitest case asserts an ungrounded trainer
   name in the LLM response is discarded and the action keeps its heuristic
   `action`.
6. **AC-6 — Per-action enrichment shape.** A vitest case with a stubbed LLM
   asserts each action receives non-empty `detailedSteps` and `rationale`, a
   graph-grounded `suggestedTrainerId`, and that `priorityScore`/`action`/
   `targetDate` are unchanged by enrichment.
7. **AC-7 — Subgraph context.** A vitest case asserts the prompt payload
   contains only the departing person's subgraph (no unrelated people or
   knowledge) for a graph with many unrelated nodes.
8. **AC-8 — Page integration.** The succession page renders enrichment when the
   LLM is available and falls back to heuristic display when it is not; a unit
   test asserts both branches render without errors.
9. **AC-9 — Mission round-trip.** A persistence test asserts enrichment fields
   survive save and reload and heuristic-only missions save without them.
10. **AC-10 — Suite green.** `npm --prefix web run test` passes with the new
    tests added; no pre-existing succession tests regress.

## Test Plan

Vitest (strict TDD). Add tests under `web/src/ai/__tests__/` (enrichment) and
`web/src/domain/__tests__/` (determinism), plus updates to succession page
tests.

### Unit tests (must land before/with code)

1. `enrichPlaybookWithLLM` — happy path with a stubbed `chatCompletion`:
   asserts per-action `detailedSteps`/`rationale` non-empty,
   `suggestedTrainerId` resolved to a real `Person` node, and
   `priorityScore`/`action`/`targetDate` untouched.
2. `enrichPlaybookWithLLM` — `getLlmConfig()` returns `null`: returns input
   playbook unchanged, no enrichment fields.
3. `enrichPlaybookWithLLM` — `chatCompletion` rejects (network error): catches
   and returns heuristic-only playbook.
4. `enrichPlaybookWithLLM` — LLM returns non-JSON: returns heuristic-only
   playbook.
5. `enrichPlaybookWithLLM` — LLM returns partial JSON (2 of 3 valid): the two
   valid actions keep enrichment; the malformed one keeps heuristic `action`
   only; order unchanged.
6. `enrichPlaybookWithLLM` — LLM names a trainer not in the graph: that
   enrichment field is dropped for the action; heuristic `action` preserved.
7. Subgraph builder — prompt payload contains only the departing person's
   knowledge, other experts, and adjacent dependencies for a graph with
   unrelated people/knowledge.
8. Determinism — two enrichment calls on the same input with the same stubbed
   LLM produce deeply equal results; heuristic order/dates preserved when LLM
   returns actions in a different order.
9. Domain purity — a static import scan test (or a documentation test) confirms
   `web/src/domain/succession.ts` does not import `web/src/ai/`.
10. `generatePlaybook` regression — the existing succession heuristic tests
    still pass unchanged (no priority/dating drift).

### Page/UI tests

1. Succession page — with LLM configured (mocked): generated playbook displays
    `detailedSteps`, `suggestedTrainerName`, `rationale`, `riskNote` per action.
2. Succession page — without LLM: generated playbook displays heuristic
    `action` strings and dates; no enrichment UI surfaces; no error shown.

### Persistence/round-trip tests

1. Missions save/reload — enriched mission retains `detailedSteps`,
    `suggestedTrainerName`, `rationale`, `riskNote`; heuristic-only mission
    saves without those fields; `companyId` scoping preserved (existing tenant
    isolation test still passes).

### Commands to run

- `npm --prefix web run typecheck` — confirms `PlaybookAction` extension and
  the new `ai/` export typecheck.
- `npm --prefix web run test` — runs the full vitest suite; new tests above
  must pass and existing succession tests must not regress.

## Out of Scope (v1)

- Auto-assigning trainers to missions without human confirmation.
- Calendar/HRIS scheduling.
- Multi-turn plan refinement chat.
- Replacing heuristic prioritization or changing the mission persistence model.

## Notes / Assumptions

- Reuses the established `chatCompletion` + `getLlmConfig` + `configureLlm`
  pattern from `web/src/ai/consultant.ts`; one bounded LLM call per playbook.
- Subgraph context is recommended (decision: subgraph, not full graph) to bound
  cost and focus the prompt.
- Enrichment granularity is per-action (decision: per-action, not whole-plan
  narrative) to keep structure reviewable and the UI/mission model stable.
- Resolved gap: `enrichPlaybookWithLLM` lives in `web/src/ai/` to keep the
  domain pure.
