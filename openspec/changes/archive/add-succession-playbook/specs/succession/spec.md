# Succession

## ADDED Requirements

### Requirement: Generate a transfer playbook for a departing person
The system SHALL generate an ordered set of knowledge-transfer actions for a
selected person, derived from the knowledge they solely or critically hold.

#### Scenario: Playbook covers sole-expert knowledge first
- **WHEN** a playbook is generated for a person who is the sole expert of two areas (one critical, one not)
- **THEN** the playbook contains a transfer action for each area
- **AND** the critical area is ordered before the non-critical one

#### Scenario: Prioritization uses exposure and transfer velocity
- **WHEN** two critical areas have equal criticality but different financial exposure
- **THEN** the higher-exposure area is ordered first
- **AND** when exposure is unavailable, ordering falls back to criticality then bus factor

### Requirement: Target dates from a last day
The system SHALL assign suggested target dates to playbook actions when a last
working day is provided, scheduling backwards from that date.

#### Scenario: Actions are scheduled before the last day
- **WHEN** a last day is 30 days away and the playbook has 3 actions
- **THEN** each action receives a target date on or before the last day
- **AND** higher-priority actions are scheduled earlier

### Requirement: Durable, assignable missions
The system SHALL persist playbook actions as missions in the database, scoped to
the company, with status transitions.

#### Scenario: Playbook actions persist and survive reload
- **WHEN** an owner generates and saves a playbook
- **THEN** the missions are stored for the company and retrievable after reload
- **AND** a mission can transition through its allowed states (e.g. open → in_progress → done)

#### Scenario: Tenant isolation
- **WHEN** a user requests missions
- **THEN** only missions for their `companyId` are returned

### Requirement: Exportable playbook
The system SHALL render the playbook in a print/Markdown-friendly format for
sharing.

#### Scenario: Owner exports the plan
- **WHEN** an owner opens a generated playbook
- **THEN** they can export it as Markdown or print to PDF with actions, owners, and dates
