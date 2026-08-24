# Data strategy

This document supersedes the historical F0 relational-graph plan.

- PostgreSQL is the system of record.
- Approved assertions and linked evidence are canonical.
- `nodes` and `edges` are a deterministic read projection rebuilt from approved, currently valid assertions.
- `node_layout` contains display coordinates only.
- pgvector embeddings are tenant-owned derived data, protected by RLS.
- Tenant business tables use explicit organization columns, RLS and composite tenant foreign keys.
- Apache AGE is optional and is not required by the product contract.

See the repository [canonical ledger architecture](../../docs/architecture/CANONICAL_LEDGER.md) and [SaaS security model](../../docs/security/SAAS_SECURITY.md).
