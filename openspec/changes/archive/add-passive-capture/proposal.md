# Add Passive Capture — Zero-Effort Auto-Map (FOUNDATION)

## Why

The PYME Chaos Reality review killed the original premise: the knowledge graph's
input data **does not exist**, and a chaotic SME will never sit down to create it
— worse, the key person is incentivized to sabotage documenting themselves.

So we invert the product. Instead of asking humans to feed the graph, we
**generate a draft map from data the company already has** and ask a human only
to *approve* it. This is the single change that makes everything else viable: it
is the only thing that beats both judges —

- **Chaos CEO** ("no tengo tiempo / llega hecho o no lo quiero") → it arrives done.
- **Excel Defender** ("¿por qué no una hoja?") → a person can't auto-generate the
  map from their org's exhaust; this can.

## What Changes

- An **auto-mapping pipeline** that ingests existing artifacts and proposes a
  first-draft graph with **zero manual data entry**:
  - v1 sources (no integration setup): an uploaded org chart / employee list
    (CSV/Excel), and pasted/uploaded text (transcripts, docs).
  - v2 connectors (same pipeline, later): email/chat **metadata** (who talks to
    whom about what), CRM record ownership, Git commit authorship for tech teams.
- A **review inbox**: every auto-generated item is a *proposal* with provenance
  ("from: employees.xlsx" / "from: Ops sync transcript"), approvable / editable /
  rejectable. Nothing is written to the graph without a human click.
- Re-runnable: ingesting again refreshes proposals so the map doesn't rot —
  without anyone maintaining it by hand.

## Impact

- Affected specs: `passive-capture` (new) — this is now change **#1**.
- Affected code: reuse `src/ai/extraction.ts`, `src/domain/interview.ts`,
  `POST /api/graph/proposals`; new `/api/ingest` + `(app)/inbox` page; optional
  `ingestion_sources` table for provenance/audit. The secure upload route +
  policy already exist.
- Unblocks #2 (playbook) and #3 (simulator): they need a populated graph, and
  this is how it gets populated without client effort.

## PYME Reality Check

- **Day-one value:** the owner uploads an employee list and *immediately* sees a
  draft risk map — no interviews, no typing. That is the "llega hecho".
- **Chaos resistance:** survives scenarios C/D/E (owner does everything / nobody
  updates / bad data) because generation is automatic and re-runnable; humans
  only curate.
- **Excel test:** Excel cannot read your org's email metadata or transcripts and
  build the graph for you. This is where the product earns the right to exist.
