# Passive Capture

## ADDED Requirements

### Requirement: Auto-map from existing structured data (zero manual entry)
The system SHALL generate a first-draft graph from a structured source the
company already has (e.g. an employee list / org chart as CSV or Excel) without
any manual data entry, producing proposals for review.

#### Scenario: Uploading an employee list yields a draft map
- **WHEN** an owner uploads an employee list (name, role, team, manager)
- **THEN** the system proposes Person nodes and reporting/team edges
- **AND** the owner sees a draft risk map without typing any knowledge by hand
- **AND** nothing is written to the graph until the owner approves

#### Scenario: Re-running refreshes without manual maintenance
- **WHEN** an updated employee list is uploaded later
- **THEN** the system proposes additions/changes as new reviewable items
- **AND** previously approved data is not duplicated

### Requirement: Ingest unstructured text into proposals
The system SHALL accept unstructured text (pasted or uploaded) and produce graph
operation proposals using the extraction and interview engines, without writing
to the graph.

#### Scenario: A transcript yields reviewable proposals
- **WHEN** an authenticated user submits a meeting transcript mentioning a person and a critical task
- **THEN** the system returns proposals (e.g. create Person, create Knowledge, create MASTERS edge)
- **AND** no graph nodes/edges are created until a human approves

#### Scenario: Empty or irrelevant text yields no proposals
- **WHEN** the submitted text contains no extractable entities
- **THEN** the system returns an empty proposal set and a clear "nothing found" result

### Requirement: Source provenance on every proposal
The system SHALL attach the originating source to each ingested proposal.

#### Scenario: Proposal shows where it came from
- **WHEN** proposals are generated from a file named "employees.xlsx"
- **THEN** each proposal carries that source label
- **AND** the label is visible in the review inbox

### Requirement: Review inbox with approve / edit / reject
The system SHALL present pending proposals for human decision and SHALL persist
only approved proposals via the existing proposals write-path.

#### Scenario: Approving an item updates the graph
- **WHEN** a reviewer approves a pending proposal
- **THEN** it is persisted through `POST /api/graph/proposals`
- **AND** it disappears from the inbox
- **AND** rejecting an item discards it without touching the graph

#### Scenario: Permission and tenancy
- **WHEN** a viewer (read-only role) opens the inbox
- **THEN** they cannot approve proposals
- **AND** a reviewer only sees proposals for their own `companyId`

### Requirement: Extensible source connectors
The system SHALL model ingestion behind a source abstraction so new connectors
(email/chat metadata, CRM ownership, Git authorship) can be added without
changing the review flow.

#### Scenario: New connector reuses the inbox
- **WHEN** a future connector produces data for ingestion
- **THEN** it flows through the same extraction → proposal → inbox path as manual upload
