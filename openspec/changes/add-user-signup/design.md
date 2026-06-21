# Design — add-user-signup

## Architecture (endpoint, page, migration, first-user-owner logic)

Self-serve registration introduces four new artifacts and two edits, all under `web/`:

1. **`web/src/app/api/auth/register/route.ts`** — public `POST` handler (Node runtime). No session, no `requireApiUser`. Calls a pure `validateSignup(body)` helper, then `db.transaction(async (tx) => …)` that inserts `companies` then `users`, mapping any `23505` unique violation to a `409` with the correct `field`.
2. **`web/src/app/api/auth/register/route.spec.ts`** — vitest unit tests (mocked `createDb`/transaction), written first (strict_tdd).
3. **`web/src/app/register/page.tsx`** + **`web/src/components/auth/RegisterPage.tsx`** — client form mirroring `LoginPage.tsx`'s split-screen. On `201`, calls `signIn("credentials", { email, password, redirect: false })`, then `router.push("/")`. Cross-links to `/login`.
4. **`web/drizzle/0006_companies_slug_unique.sql`** — `ALTER TABLE companies ADD CONSTRAINT companies_slug_unique UNIQUE (slug);` + b-tree index. Hand-written; Drizzle `schema.ts` updated with `unique("companies_slug_unique")` on `slug` so `db:generate` stays in sync.

**Edits:**

- `web/src/auth/config.ts:34-46` — add `pathname === "/register"` to `isPublic`.
- `web/src/components/auth/LoginPage.tsx` — add `<Link href="/register">Create account</Link>` under the form.

**First-user-owner logic** lives inside the transaction (see Data model). The company is brand-new, so the user count for the new `companyId` is structurally 0; we still run a defensive `SELECT count(*)` against `users` for that `companyId` inside the tx and assert `=== 0` before assigning `owner`. If a future caller ever reuses this handler for an existing company, that guard turns the impossible case into an explicit `409 { field: "slug" }` rather than silently producing a second owner.

## Data model (migration 0006, transaction boundaries)

`schema.ts` already has `users.passwordHash` (UNIQUE email). No password column migration. The only schema change is adding a UNIQUE constraint + index on `companies.slug`.

**`web/src/db/schema.ts` edit:**

```ts
export const companies = pgTable("companies", {
  // …unchanged columns
}, (table) => [
  unique("companies_slug_unique").on(table.slug),
  index("companies_slug_idx").on(table.slug),
]);
```

**`0006_companies_slug_unique.sql`:**

```sql
ALTER TABLE "companies" ADD CONSTRAINT "companies_slug_unique" UNIQUE ("slug");
--> statement-breakpoint
CREATE INDEX "companies_slug_idx" ON "companies" USING btree ("slug");
```

Pre-migration: `SELECT slug, count(*) FROM companies GROUP BY slug HAVING count(*) > 1;` must return zero rows; document in the migration header. Rollback drops the constraint + index.

**Transaction call sequence (`route.ts`):**

```ts
const created = await db.transaction(async (tx) => {
  const companyId = slug; // text IDs ( Ponytail convention — slug is unique, stable, human-readable)
  await tx.insert(companies).values({ id: companyId, name: companyName, slug });
  const occupants = await tx
    .select({ count: sql`count(*)` })
    .from(users)
    .where(eq(users.companyId, companyId));
  if (Number(occupants[0].count) > 0) {
    throw new UniqueConflictError("slug"); // pre-existing company — defensive
  }
  const passwordHash = await hash(password, 10); // bcrypt cost 10, same as seed.ts:67
  const [u] = await tx
    .insert(users)
    .values({
      id: `user-${crypto.randomUUID()}`,
      email: email.toLowerCase(),
      name: email.split("@")[0],
      passwordHash,
      companyId,
      role: "owner",
      validationDomains: ["*"],
    })
    .returning();
  return u;
});
return NextResponse.json(trim(created), { status: 201 });
```

`db.transaction` rolls back on any throw — company and user stay atomic (spec AC 9). The bcrypt `hash` runs **inside** the tx (async) so a throw during hashing also rolls back the company insert. Hashing is cheap enough not to matter for tx duration.

## API design (POST /api/auth/register)

**Request** — `Content-Type: application/json`:

```ts
{ email: string; password: string; companyName: string; slug: string }
```

**Response `201`** — trimmed user payload (no `passwordHash`, no plaintext):

```ts
{ id: string; email: string; role: "owner"; companyId: string }
```

**Error codes:**

| Status | `{ field }` | Trigger |
|---|---|---|
| `422` | `email` | bad email format |
| `422` | `password` | length < 8 |
| `422` | `slug` | fails `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$` |
| `422` | `companyName` | empty after trim |
| `409` | `email` | pre-check hit OR DB `23505` on `users_email_unique` |
| `409` | `slug` | pre-check hit OR DB `23505` on `companies_slug_unique` |
| `500` | — | any other throw (never on unique violations) |

**Unique-violation mapping.** The driver is `pg` ^8.22 via `drizzle-orm/node-postgres`. Postgres surfaces unique violations as `DatabaseError` with `code === "23505"` and a `constraint` property (`users_email_unique` / `companies_slug_unique`). Drizzle rethrows the underlying pg error, so the catch block inspects `(err as { code?: string; constraint?: string })`:

```ts
catch (err) {
  const e = err as { code?: string; constraint?: string };
  if (e.code === "23505") {
    const field = e.constraint === "users_email_unique" ? "email"
      : e.constraint === "companies_slug_unique" ? "slug" : "slug";
    return NextResponse.json({ error: "Conflict", field }, { status: 409 });
  }
  throw err; // → 500
}
```

Pre-checks (`SELECT … WHERE email` / `WHERE slug`) are advisory; the DB constraint is authoritative (race-safe, spec AC 12).

**Validation layer.** A single pure function `validateSignup(body): { field?: string } | null` lives in `web/src/app/api/auth/register/validate.ts` (separate module — unit-testable without DB, imported by both the route and the UI for shared rules). Slug regex: `/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/` (matches spec exactly — 3–40 chars, lowercase, no leading/trailing hyphen). Email: simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Password: `password.length >= 8`.

## UI design (/register page, mirroring LoginPage split-screen, cross-links)

`web/src/components/auth/RegisterPage.tsx` ("use client") mirrors `LoginPage.tsx`:

- Same `grid min-h-screen lg:grid-cols-2` + brand panel, changed headline ("Start your company brain" / "Create your account").
- Right form: `Field` components for `email`, `password`, `companyName`, `slug` (slug input with `autoComplete="off"`, hint "lowercase, 3–40 chars, e.g. acme-co").
- Client-side `validateSignup` runs on submit before the fetch (instant `422`-equivalent inline errors).
- `POST /api/auth/register` → on `201`, call `signIn("credentials", { email, password, redirect: false })`; on success `router.push("/"); router.refresh()`. **Auto sign-in after register** (no redirect to `/login`) — the user just typed their password, re-prompting is friction.
- On non-`201`, surface `body.field` next to the matching input.
- Footer link: "Already have an account? Log in" → `/login`.
- `web/src/app/register/page.tsx` = `<Suspense><RegisterPage/></Suspense>` (matches `login/page.tsx`).

`LoginPage.tsx` edit: add `<Link className="…mt-4 text-sm" href="/register">Create account →</Link>` below the submit button.

## Tradeoffs

- **Auto sign-in vs redirect-to-/login**: chose auto sign-in — lower friction, user already entered credentials. Cost: a `signIn` failure after a successful `201` (e.g. edge-case timing) would strand the user; mitigated by falling back to a "Account created — log in" link on `signIn` error.
- **bcrypt inside the transaction**: slight tx-duration cost vs. cleaner rollback semantics. Chose inside-tx.
- **`companyId = slug`**: reuses the Ponytail text-ID convention (seed uses `demo-corp`); avoids a separate ID-generation step. Slug UNIQUE now guarantees `companyId` UNIQUE for new companies.
- **Pure `validateSignup` shared by UI + route**: one source of truth for regex/length, no drift.

## Risks & mitigations

- **Slug races**: pre-check + UNIQUE + `23505` → `409 { field: "slug" }`. Mapped explicitly, never `500`.
- **Owner inflation**: every signup creates a new company, so every registrant is an owner. Correct for self-serve pilot; documented in `route.ts` header. Becomes wrong only when invite-flow lands (out of scope).
- **No email verification**: accounts active on any claimed email. Acceptable for pilot; flagged in proposal.
- **Pre-migration duplicate slugs**: blocking check documented in the migration header; rollout gate (AC 13).
- **`company-service.ts` divergence**: signup writes to DB only; confirmed in explore that no auth read path depends on the in-memory map. Not edited here.
- **`signIn` import parity**: `nextauth.ts` exports server `signIn`; the client form must use `next-auth/react`'s `signIn` (same as `LoginPage.tsx:3`) — verified pattern, no new dependency.

## Out of scope

Invite-token join, email verification/SMTP, password reset, OAuth providers, `memberships` table migration (keep `users.companyId`/`role`), role management UI, audit-log writes to `event_log`, password strength rules beyond min 8, subsequent-user joins to an existing company.

---

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Design covers exactly the proposal scope: POST /api/auth/register, migration 0006 (UNIQUE slug + index), /register page mirroring LoginPage, middleware allowlist edit, cross-links, first-user-owner via tx-internal count guard. All 14 spec ACs mapped to design decisions; no out-of-scope items (invite flow, email verify, memberships) introduced."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "design.md written with explicit file paths, transaction call sequence, error-code table, 23505 mapping code, slug regex, and AC-to-decision traceability. changedFiles/tests/commands listed below."
    }
  ],
  "changedFiles": [
    "openspec/changes/add-user-signup/design.md (created)",
    "progress.md (updated)"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "read explore.md/proposal.md/spec.md + 8 source files",
      "result": "passed",
      "summary": "Verified schema (users.passwordHash exists, companies.slug no UNIQUE), pg ^8.22 + drizzle 0.45 driver, seed bcrypt cost 10, middleware isPublic, LoginPage split-screen, migration 0005 is latest → 0006 is free."
    },
    {
      "command": "grep web/drizzle/*.sql + web/package.json",
      "result": "passed",
      "summary": "Confirmed migration 0006 slot is free; pg exposes DatabaseError.code='23505' + .constraint for unique-violation mapping."
    }
  ],
  "validationOutput": [
    "Design references verified file:line anchors (config.ts:34-46, seed.ts:67, schema.ts:148-179, 0003…sql:17).",
    "Slug regex ^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$ confirmed verbatim in spec.md.",
    "bcrypt cost 10 + $2b$10$ prefix requirement matches seed.ts:67 pattern.",
    "Transaction rollback semantics confirmed against drizzle-orm 0.45 db.transaction API."
  ],
  "residualRisks": [
    "Pre-migration duplicate-slug count check is documented but not yet executed against the real DB — must run before applying 0006.",
    "Auto sign-in after register relies on next-auth/react signIn matching the Credentials authorize path that reads the just-inserted row; integration test recommended in apply phase.",
    "crypto.randomUUID for user IDs assumes Node 19+ runtime; verify Next.js Node runtime version in apply phase (fallback: nanoid)."
  ],
  "noStagedFiles": true,
  "notes": "Design is implementation-ready: hand to sdd-apply to create route.ts + route.spec.ts (TDD), validate.ts, RegisterPage.tsx, register/page.tsx, edit config.ts + LoginPage.tsx + schema.ts, write 0006 SQL. Engram persistence pending: will mem_save with topic_key sdd/add-user-signup/design, project company_brain_os after this report."
}
```
