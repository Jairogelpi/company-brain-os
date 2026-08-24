# Security due-diligence brief

Use this as a factual pre-read, not as a certification questionnaire or legal representation.

## Architecture answers

- Tenant business data is organization-scoped and protected by forced PostgreSQL RLS.
- Runtime uses a non-owner database role; migrations use the owner separately.
- Composite tenant foreign keys reject cross-organization relationships.
- AI output is proposal-only and requires explicit human approval.
- Uploads use allow-lists, magic bytes, tenant object keys, hashes, ClamAV and signed short-lived download URLs.
- Authentication uses Auth.js credentials, bcrypt hashes, 24-hour JWT sessions and distributed sign-in/signup limits.
- Async transcription and email delivery run in a separate worker with durable PostgreSQL state.
- Production does not seed sample organizations or credentials.

## Customer-specific fields to complete before signature

| Field | Decision |
| --- | --- |
| Hosting region/provider |  |
| Object storage/encryption configuration |  |
| AI providers and data-use terms |  |
| Subprocessor list |  |
| Retention/deletion schedule |  |
| Backup RPO/RTO and restore evidence date |  |
| Support/security contacts |  |
| Incident notification commitment |  |
| Data export/deletion process |  |
| DPA/order-form counsel approval |  |

Detailed controls and operator requirements are in the [SaaS security model](../security/SAAS_SECURITY.md), [deployment guide](../../DEPLOY.md) and [production runbook](../operations/PRODUCTION_RUNBOOK.md).
