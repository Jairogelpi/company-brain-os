# Proposal — add-user-signup

## Problem statement

Company Brain OS has Auth.js Credentials login wired against `users.passwordHash`, but **no way for a new visitor to create an account or a company**. The seed script is the only path that produces an owner (`web/src/db/seed.ts:51-66`). `companies.slug` has no UNIQUE constraint (`web/drizzle/0003_auth_users_companies.sql:1-7`), so duplicate slugs are silently possible. The in-memory `company-service.ts` diverges from the DB `companies` table and must not be used for persistence. Without self-serve signup, every pilot onboarding requires a manual seed run, blocking the "empresario dedicaría 20h" single-tenant-per-company framing in the spec.

## Proposed solution (self-serve signup flow)

Add a public self-serve registration path:

1. **`POST /api/auth/register`** — accepts `{ email, password, companyName, slug }`. Validates email format, password ≥ 8 chars, slug format. Pre-checks `users.email` uniqueness and `companies.slug` uniqueness, then inserts a new `companies` row and the first `users` row in one transaction, setting `role: "owner"` and `validationDomains: ["*"]` (replicating `seed.ts:51-66`). Password hashed with `bcrypt.hash(plain, 10)` (reuse seed pattern). Returns a trimmed user payload; the caller signs in via the existing Credentials flow.
2. **Migration `0006_companies_slug_unique.sql`** — `ALTER TABLE companies ADD CONSTRAINT companies_slug_unique UNIQUE (slug)` plus a b-tree index on `slug`. DB is the source of truth for uniqueness (race-safe), app pre-check is advisory only.
3. **`/register` page** — mirrors the `/login` split-screen (`web/src/components/auth/LoginPage.tsx`), posts to the new endpoint, then calls `signIn("credentials", …)` on success. Added to the middleware public allowlist in `web/src/auth/config.ts:34-46`. A "Already have an account? Log in" link is added to `/login` and vice-versa.
4. **First-user-becomes-owner** — inside the register transaction, after inserting the company, query `users` count for the new `companyId`; if 0 (always true here since the company is brand-new), assign `owner` + `validationDomains: ["*"]`. Subsequent joins are explicitly out of scope (invite flow).

Persistence targets Drizzle/DB (`web/src/db/schema.ts`), **not** `web/src/domain/company-service.ts`.

## Scope

**In:**

- `POST /api/auth/register` endpoint + request/response types.
- Migration `0006_companies_slug_unique.sql` (UNIQUE + index on `companies.slug`).
- `/register` page + client form mirroring `LoginPage.tsx`.
- Middleware public allowlist update for `/register`.
- Cross-links between `/login` and `/register`.
- First-user-owner assignment (`role: "owner"`, `validationDomains: ["*"]`) on the brand-new company.
- bcrypt cost 10, min password length 8.

**Out (explicitly deferred):**

- Invite-token join flow (model B from explore).
- Email verification / SMTP.
- Password reset / forgot-password.
- OAuth providers (Google, etc.).
- `memberships` table migration — keep using `users.companyId` / `users.role`.
- Role management UI for owners.
- Audit logging into `event_log`.
- Strength rules beyond min length 8.

## Success criteria

- A visitor can register email + password + company name + slug and end up logged in as the OWNER of a new company.
- Duplicate email returns 409 (relies on existing `users.email` UNIQUE + pre-check).
- Duplicate slug returns 409 (relies on migration 0006 UNIQUE + pre-check).
- Password is stored only as a bcrypt hash (cost 10); plaintext never persisted or logged.
- First user of a new company has `role: "owner"` and `validationDomains: ["*"]`.
- `/register` is reachable without auth; middleware does not redirect it to `/login`.
- TDD: vitest covers the endpoint (happy path, unique email, unique slug, first-user-owner, password hashing, role assignment) before/alongside implementation.
- `npm --prefix web run test` and `npm --prefix web run typecheck` pass.

## Risks

- **Slug races**: pre-check + UNIQUE constraint handle it, but the endpoint must map the DB unique-violation to a clean 409, not a 500.
- **Owner inflation**: because every signup creates a new company, every registrant is an owner. Acceptable for the pilot self-serve model; becomes wrong once invite-flow lands. Document the assumption in code.
- **No email verification**: accounts are immediately active on any claimed email. Acceptable for pilot; risk if exposed publicly.
- **No password reset**: users who lose a password cannot recover without DB access. Documented limitation.
- **`company-service.ts` divergence**: signup bypasses it; if other code reads companies via the in-memory map, the new DB company will be invisible there. Confirm no read path depends on it for the signup-created company (explore flags it as divergent/unused by auth).
- **Migration rollback**: `0006` adds a constraint; rollback drops it. Existing rows with duplicate slugs (if any) would block the migration — verify via a pre-migration count query.
