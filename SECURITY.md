# Security policy

## Report a vulnerability

Do not open a public issue. Contact the repository owner privately through GitHub and include the affected version/commit, impact, minimal reproduction and any suggested containment. Do not access data you do not own or retain sensitive proof-of-concept data.

The owner should acknowledge a valid report, agree on a disclosure timeline and credit the reporter if requested. No bounty is promised unless agreed in writing.

## Architecture guarantees

- Assertion/evidence ledger is canonical; AI cannot approve truth.
- Protected business tables use PostgreSQL RLS and composite tenant foreign keys.
- Production runs with a non-owner database role.
- RBAC is deny-by-default for writes, validation, mission closure and user administration.
- Transfer evidence requires independent review.
- Uploads are tenant-partitioned, signature-checked, hashed and malware-scanned before storage.
- Production does not seed demo tenants or credentials.

The detailed threat and control model is [docs/security/SAAS_SECURITY.md](docs/security/SAAS_SECURITY.md).

## Supported versions

Security fixes are applied to:

- the default `master` branch; and
- the latest formal pilot release, currently `v1.0.0-pilot`, once published by the repository release workflow.

Older commits and superseded pilot tags are not supported unless an explicit written support commitment says otherwise.

## Automated security gates

Repository-controlled security evidence includes:

- PostgreSQL tenant-isolation integration tests under a non-superuser role;
- production dependency audit with high/critical findings blocking release;
- GitHub CodeQL analysis for JavaScript/TypeScript on pull requests, `master` and a weekly schedule;
- production build, strict TypeScript, repository lint and browser E2E before merge;
- GHCR image build with SBOM and provenance in CD.

Automated analysis is not a substitute for an independent penetration test. External security validation remains a separate evidence gate in `docs/RELEASE_SCORECARD.md`.

## Development rules

- Never commit `.env`, credentials, database dumps, uploads or real company content.
- Do not log captured knowledge, upload bytes, passwords, tokens or sensitive HR fields.
- Treat AI input as untrusted data and keep it outside privileged instructions.
- Review dependency, migration, workflow and authorization changes before merge.
- Do not bypass type safety with `@ts-ignore`/`@ts-nocheck`, leave `debugger` statements, or merge unresolved executable-code TODO/FIXME/HACK markers.
- Run the full quality, browser and tenant-isolation gates before release.
