# Graph services

There are three deliberately separate responsibilities:

| Component | Responsibility |
| --- | --- |
| Assertion repository | Canonical claims, evidence, validity and lifecycle |
| Canonical graph writer | Human-authorized assertion writes and projection rebuild |
| Graph repository/service | Tenant-scoped read projection and event persistence |

The synchronous in-memory `GraphService` remains a deterministic test/domain adapter. It is not production truth and must not be wired as an application write authority.

See [canonical ledger architecture](../../docs/architecture/CANONICAL_LEDGER.md).
