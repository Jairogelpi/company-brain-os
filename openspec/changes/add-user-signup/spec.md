# Spec — add-user-signup

## Requirements

### Requirement: Public registration endpoint

The system MUST expose `POST /api/auth/register` as a public route (no session required) that accepts a JSON body `{ email, password, companyName, slug }` and creates a new company plus its first user in a single transaction.

#### Scenario: Happy path signup

- GIVEN no existing user or company with the submitted email/slug
- WHEN a visitor POSTs `{ email, password, companyName, slug }` with all fields valid
- THEN the system creates a `companies` row and a `users` row in one DB transaction, returns `201` with a trimmed user payload (`id`, `email`, `role`, `companyId`), and the plaintext password is never persisted or returned

### Requirement: Email uniqueness

The system MUST reject a registration whose email already exists in `users` with HTTP `409` and a message identifying the email conflict. The pre-check is advisory; the existing `users.email` UNIQUE constraint is the authoritative guard.

#### Scenario: Duplicate email

- GIVEN a `users` row already exists with email `a@b.co`
- WHEN a visitor POSTs a registration with `email: "a@b.co"`
- THEN the system returns `409` with `{ field: "email" }` and does not insert a company or user

### Requirement: Slug uniqueness and format

The system MUST enforce `companies.slug` uniqueness at the DB level (migration `0006_companies_slug_unique.sql`: UNIQUE constraint + b-tree index) and in app code. Duplicate slug returns `409`. Slug format MUST match `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$` (lowercase, alphanumeric, hyphens, 3–40 chars, no leading/trailing hyphen).

#### Scenario: Duplicate slug

- GIVEN a `companies` row exists with slug `acme`
- WHEN a visitor POSTs a registration with `slug: "acme"`
- THEN the system returns `409` with `{ field: "slug" }`

#### Scenario: Malformed slug

- WHEN a visitor POSTs `slug: "Acme Co!"` or `"-acme"` or `"a"`
- THEN the system returns `422` with `{ field: "slug" }` and no DB write occurs

### Requirement: Password hashing and policy

The system MUST hash the password with `bcrypt.hash(plain, 10)` before persistence and MUST reject passwords shorter than 8 characters with `422`. Plaintext MUST NOT appear in logs or responses.

#### Scenario: Short password

- WHEN a visitor POSTs a password shorter than 8 characters (e.g. a 7-character string)
- THEN the system returns `422` with `{ field: "password" }` and no DB write occurs

#### Scenario: Hashed storage

- GIVEN a successful registration
- THEN `users.password_hash` starts with `$2` and differs from the submitted plaintext

### Requirement: First-user-owner

The system MUST assign `role: "owner"` and `validationDomains: ["*"]` to the first user of a newly created company within the same transaction that inserts the company.

#### Scenario: First registrant is owner

- GIVEN a brand-new company created by this registration
- WHEN the transaction commits
- THEN the inserted user has `role = "owner"` and `validationDomains = ["*"]`

### Requirement: Email format validation

The system MUST reject malformed emails with `422` and `{ field: "email" }` before any DB write.

#### Scenario: Invalid email

- WHEN a visitor POSTs `email: "not-an-email"`
- THEN the system returns `422` with `{ field: "email" }`

### Requirement: Transactional insert

The system MUST insert `companies` and `users` in a single transaction; if either write fails, the other MUST roll back so no orphan company or user remains.

#### Scenario: User insert fails after company insert

- GIVEN the company insert succeeds and the user insert throws (e.g. DB unique violation on email)
- THEN the transaction rolls back and no `companies` row is committed

### Requirement: Reachable /register page

The system MUST serve a `/register` page reachable without authentication and MUST list `/register` in the middleware public allowlist so it is not redirected to `/login`.

#### Scenario: Anonymous visitor opens /register

- GIVEN no active session
- WHEN a visitor navigates to `/register`
- THEN the page renders the registration form without a redirect to `/login`

### Requirement: Cross-links login/register

The `/login` page MUST link to `/register` ("Create account") and `/register` MUST link to `/login` ("Already have an account? Log in").

#### Scenario: Login page link

- GIVEN the `/login` page rendered
- THEN it contains an anchor to `/register`

### Requirement: Unique-violation to 409 mapping

When the DB raises a unique-constraint violation on `users.email` or `companies.slug`, the endpoint MUST map it to `409` with the matching `field`, never `500`.

#### Scenario: Race yields DB unique error

- GIVEN concurrent registrations with the same slug pass the pre-check
- WHEN the second transaction hits the UNIQUE constraint
- THEN the endpoint returns `409 { field: "slug" }`

## Acceptance criteria

1. `POST /api/auth/register` with valid `{ email, password, companyName, slug }` returns `201` and creates exactly one `companies` row and one `users` row.
2. Duplicate email returns `409` with `{ field: "email" }`; no company or user is inserted.
3. Duplicate slug returns `409` with `{ field: "slug" }`; no company or user is inserted.
4. Password with length < 8 returns `422` with `{ field: "password" }`; no DB write.
5. Password is stored as a bcrypt hash with cost `10` (prefix `$2b$10$`); plaintext never persisted or logged.
6. First user of the new company has `role = "owner"` and `validationDomains = ["*"]`.
7. Invalid email format returns `422` with `{ field: "email" }`.
8. Malformed slug returns `422` with `{ field: "slug" }`.
9. Company + user are inserted in a single transaction; a failure in either rolls back both.
10. `/register` is reachable without auth and is in the middleware public allowlist (no redirect to `/login`).
11. `/login` links to `/register` and `/register` links to `/login`.
12. DB unique-violation on `users.email` or `companies.slug` is mapped to `409`, never `500`.
13. Migration `0006_companies_slug_unique.sql` adds `UNIQUE(slug)` + b-tree index on `companies.slug`.
14. `npm --prefix web run test` and `npm --prefix web run typecheck` pass.

## Non-goals

- Invite-token join flow (existing company, assigned role).
- Email verification / SMTP.
- Password reset / forgot-password.
- OAuth providers (Google, etc.).
- `memberships` table migration — keep using `users.companyId` / `users.role`.
- Role management UI for owners.
- Audit logging into `event_log`.
- Password strength rules beyond min length 8.
- Subsequent-user joins to an existing company.

## Test plan

- **Unit (vitest, `web/src/app/api/auth/register/route.spec.ts`):**
  - Happy path: valid body → `201`, user payload shape, one company + one user inserted, owner role + `validationDomains: ["*"]`.
  - Duplicate email → `409 { field: "email" }` (mock DB pre-check and UNIQUE violation paths).
  - Duplicate slug → `409 { field: "slug" }` (mock pre-check and DB unique-violation paths).
  - Short password → `422 { field: "password" }`.
  - Invalid email → `422 { field: "email" }`.
  - Malformed slug → `422 { field: "slug" }` (covers `Acme Co!`, `-acme`, `a`).
  - Transactional rollback: user insert fails → company insert rolled back.
  - bcrypt cost 10: spy on `bcrypt.hash` with cost `10`; assert `password_hash` is non-plaintext.
- **Integration (vitest, real test DB if available):**
  - Concurrent same-slug registrations: exactly one succeeds, the other gets `409 { field: "slug" }`.
- **Route/middleware:**
  - `/register` is in the public allowlist; unauthenticated GET renders the page without redirect.
- **UI (vitest + testing-library):**
  - `/login` renders a link to `/register`; `/register` renders a link to `/login`.
- **Commands:** `npm --prefix web run test`, `npm --prefix web run typecheck`.
