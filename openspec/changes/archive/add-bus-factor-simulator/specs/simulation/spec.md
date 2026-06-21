# Simulation

## ADDED Requirements

### Requirement: Simulate a single person leaving
The system SHALL compute, read-only, the impact of removing one person from the
company graph: halted processes, orphaned knowledge, and shifted dependencies.

#### Scenario: Removing the sole expert halts a process
- **WHEN** a user simulates the departure of the only expert of critical Process X
- **THEN** Process X appears in `haltedProcesses`
- **AND** the knowledge they solely mastered appears in `orphanedKnowledge`
- **AND** the underlying graph is not modified

#### Scenario: Person with a backup does not orphan knowledge
- **WHEN** a user simulates the departure of a person whose knowledge has another expert at level ≥ 3
- **THEN** that knowledge does NOT appear in `orphanedKnowledge`

### Requirement: Multi-person and cascade simulation
The system SHALL support simulating multiple simultaneous departures and SHALL
report second-order (cascade) breakage.

#### Scenario: Two departures cascade
- **WHEN** a user simulates two people leaving whose combined absence breaks a downstream process that depends on an orphaned process
- **THEN** the downstream process is reported as cascade impact
- **AND** the report distinguishes direct impact from cascade impact

### Requirement: Euro impact of a simulation
The system SHALL attach a monetary impact to a simulation when a cost model is
available, and SHALL degrade gracefully otherwise.

#### Scenario: Simulation shows total euro impact
- **WHEN** halted processes have a cost model
- **THEN** the simulation report includes a total `€ impact` summing halted-process exposure
- **AND** WHEN no cost model exists, the report still returns structural impact with euro fields omitted

### Requirement: Interactive simulator page
The system SHALL provide an authenticated `/simulator` page scoped to the user's
company.

#### Scenario: Owner runs a what-if from the UI
- **WHEN** an authenticated user selects a person and runs the simulation
- **THEN** the page shows halted processes, orphaned knowledge, the cascade, and the euro impact
- **AND** no graph data is written as a result
