# Explore — add-user-signup

## Current auth state (what exists, what's missing)

- Auth.js Credentials provider wired in `web/src/auth/nextauth.ts:18-49` — email+password, bcrypt `compare` against `users.passwordHash`. JWT sessions (`web/src/auth/config.ts:9-12`, 24h). **No registration endpoint/provider exists.**
- Edge middleware `web/src/middleware.ts:5` gates routes via `authorized` (`config.ts:34-46`). Public set: `/login`, `/api/*`, `/_next`, `/favicon.ico`. A new `/register` page must be added to the public allowlist.
- Login UI: `web/src/app/login/page.tsx:1-7` (Suspense wrapper) + `web/src/components/auth/LoginPage.tsx` (client form, `signIn("credentials", …)`). No "Create account" link today. `AuthProvider.tsx:1-19` is `SessionProvider`; `useAuth()` at `AuthProvider.tsx:22-43` derives `AuthUser`.
- App gate: `web/src/app/(app)/layout.tsx:6-39` is a client layout assuming `user` exists; actual gate is middleware + `authorized`. No server `auth()` redirect in the layout.
- Roles: `web/src/auth/permissions.ts:9-15` — `owner|validator|contributor|viewer` with numeric hierarchy. `user.invite` is owner-only (`permissions.ts:43,54`). No `user.create`/`user.register` op.
- API guard: `web/src/auth/api-guard.ts:9-37` — `requireApiUser(operation?, companyId?)`. Signup route is public, so it won't use this guard.

## Schema gaps (migrations needed, new columns/tables)

- `users.password_hash` **ALREADY EXISTS** — `web/src/db/schema.ts:171` (text NOT NULL), created by `web/drizzle/0003_auth_users_companies.sql:12`. **No migration 0006 needed for password storage.** bcrypt `hash(plain, 10)` proven in `web/src/db/seed.ts:67`.
- `users.email` is UNIQUE (`0003…sql:19`). Signup can rely on DB conflict for unique-email; should also pre-check.
- `companies.slug` exists (`schema.ts:154`) but has **NO unique constraint** (`0003…sql:1-7`). Signup that creates a company MUST enforce unique slug in app code OR add migration 0006 with `UNIQUE(slug)` + index.
- `memberships` table exists (`schema.ts:131-145`, migration 0002) but is **UNUSED** by the auth flow — `users.companyId`/`users.role` are the live fields. Spec (`COMPANY_BRAIN_OS_SPEC.md:336`) defines `memberships(user_id, company_id, role)` as the F13 multi-tenant model. Signup MVP can keep using `users.companyId`/`users.role` and defer memberships migration.
- No `invitations`/`tokens` table exists. If invite-flow is in scope, migration 0006 must add `invitations(id, companyId, email, token, role, expiresAt, acceptedAt)`.
- `web/src/domain/company-service.ts:18-42` is an **in-memory `Map` divergent from the DB** `companies` table — signup must write to DB, not this service.

## Role + company assignment model (first user vs subsequent)

- New users default `role: "viewer"` (`schema.ts:172`) and `companyId: "demo-corp"` (`schema.ts:170`). There is **NO "first user becomes owner" logic anywhere today.**
- Seed pattern (`seed.ts:51-66`) explicitly assigns `role: "owner"` + `validationDomains: ["*"]` to the first user. Signup must replicate: when creating the first user for a brand-new company, set `role: "owner"`.
- Spec intent: spec mentions multi-tenant + delegable validator (F13) and `memberships`, but does **NOT** specify a signup/invitation flow. Two viable models:
  - **(A) Self-serve company creation**: any visitor registers, creates a new company (unique slug), becomes its owner. Simplest MVP; matches "empresario dedicaría 20h" framing (spec line 9 — single-tenant pilot per company).
  - **(B) Invite-only join**: existing owner invites via token; signup requires invite token and joins an existing company at a chosen role. Closer to F13 multi-tenant intent; needs invitations table + token flow.

## Open questions for proposal

1. **Invite flow?** Self-serve company creation (A) vs invite-token join (B) vs both (A now, B later)? Spec is silent; F13 implies B is the eventual target. **Recommend A for this change, B as a follow-up.**
2. **Company slug uniqueness**: enforce in app (race-prone) or via migration 0006 `UNIQUE(slug)`? **Recommend migration.**
3. **Password policy**: minimum length only (e.g. ≥8) or full strength rules? bcrypt cost — reuse seed's `10` (`seed.ts:67`).
4. **Email verification**: out of scope for pilot? (no SMTP wired today.)
5. **Signup UI location**: separate `/register` page (mirrors `/login` split-screen layout in `LoginPage.tsx`) vs tab on login vs modal. **Recommend separate `/register` page** for clarity; update `authConfig.pages` (`config.ts:3-5`) — note Auth.js `pages` has no `signUp` key, so `/register` is just a public app route, not a next-auth page.
6. **First-user detection**: query `users` where `companyId = newCompanyId` count == 0 → assign owner; else reject (model A) or require invite (model B).
7. **`memberships` parity**: write a `memberships` row on signup to align with F13, or skip until multi-company lands?

## Out of scope

- Email verification / SMTP.
- Password reset / forgot-password flow.
- OAuth providers (Google, etc.) — only Credentials exists.
- Migrating existing `users.companyId`/`role` to the `memberships` table (F13 refactor).
- Role management UI for owners (separate change).
- Audit logging of signup events into `event_log` (could be a quick add but not required).

## Key file:line references

- `web/src/auth/config.ts:3-5,9-12,34-46` — pages, JWT, authorized callback
- `web/src/auth/nextauth.ts:18-49` — Credentials authorize (bcrypt compare)
- `web/src/auth/permissions.ts:9-15,43,54` — roles, `user.invite` owner-only
- `web/src/db/schema.ts:131-145` (memberships), `148-156` (companies), `159-179` (users)
- `web/src/db/seed.ts:51-66,67,84` — owner assignment + bcrypt hash(10)
- `web/drizzle/0003_auth_users_companies.sql:1-21` — users/companies DDL
- `web/src/middleware.ts:5` — edge auth gate
- `web/src/components/auth/LoginPage.tsx` — login UI to mirror for /register
- `web/src/domain/company-service.ts:18-42` — in-memory, DO NOT use for signup
