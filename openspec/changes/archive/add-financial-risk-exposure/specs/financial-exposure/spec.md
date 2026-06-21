# Financial Exposure

## ADDED Requirements

### Requirement: Cost model on critical nodes
The system SHALL allow a cost model to be attached to `Process`, `Knowledge`,
and `Person` nodes, and SHALL apply documented defaults when values are absent.

#### Scenario: Owner enters downtime cost for a critical process
- **WHEN** an owner sets `downtimeCostPerDay = 6000` and `recoveryDays = 3` on a critical Process
- **THEN** the node persists those values in its attributes
- **AND** the process exposure is computed as `6000 × 3 = €18,000`

#### Scenario: Missing cost values fall back to defaults
- **WHEN** a critical node has no cost model
- **THEN** the system applies the tenant default (e.g. `downtimeCostPerDay` default, `recoveryDays = 5`)
- **AND** the exposure is flagged as `estimated: true` so the UI can mark it as an estimate

### Requirement: Per-risk financial exposure
The system SHALL compute a monetary exposure for every `DetectedRisk` produced
by the risk engine.

#### Scenario: Single point of failure gets a euro figure
- **WHEN** a risk is "Pedro is the sole expert for the critical Process X"
- **THEN** the exposure equals `process.downtimeCostPerDay × process.recoveryDays + person.replacementCost`
- **AND** the risk record carries `exposure` (number) and `currency`

#### Scenario: Risks are sortable by money at stake
- **WHEN** the dashboard lists risks
- **THEN** risks can be ordered by `exposure` descending so the costliest risk appears first

### Requirement: Aggregate organizational exposure
The system SHALL compute a total exposure across all open risks for the
authenticated user's company, without double-counting the same node.

#### Scenario: Dashboard shows total exposure at risk
- **WHEN** the dashboard loads for a company with 3 open risks
- **THEN** a headline stat "Exposure at risk" shows the de-duplicated euro sum
- **AND** the value is scoped to the user's `companyId`
