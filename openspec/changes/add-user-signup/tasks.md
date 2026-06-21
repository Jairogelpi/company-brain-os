# Tasks — add-user-signup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~520–680 (route.ts ~120, validate.ts ~45, route.spec.ts ~280, RegisterPage.tsx ~120, register/page.tsx ~10, schema.ts ~8, 0006.sql ~6, config.ts ~2, LoginPage.tsx ~4) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (schema+migration+validate) → PR 2 (endpoint RED+GREEN) → PR 3 (UI+allowlist+verify) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

## Phase 1: Schema + migration (0006 UNIQUE slug)

- [ ] 1.1 Edit `web/src/db/schema.ts` — add `unique("companies_slug_unique").on(table.slug)` + `index("companies_slug_idx").on(table.slug)` to `companies` table config.
- [ ] 1.2 Write `web/drizzle/0006_companies_slug_unique.sql` — header comment + pre-migration `SELECT slug, count(*) … HAVING count(*) > 1` note + `ALTER TABLE companies ADD CONSTRAINT companies_slug_unique UNIQUE (slug);` + `--> statement-breakpoint` + `CREATE INDEX companies_slug_idx ON companies USING btree (slug);`.
- [ ] 1.3 Verify `npm --prefix web run typecheck` still passes after schema.ts edit.

## Phase 2: Validation module (validateSignup shared)

- [ ] 2.1 Create `web/src/app/api/auth/register/validate.ts` — export pure `validateSignup(body): { field: string } | null` covering email, password ≥8, companyName non-empty after trim, slug regex `/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/`.
- [ ] 2.2 Create `web/src/app/api/auth/register/validate.spec.ts` — RED: assert `validateSignup` returns `{ field: "email"|"password"|"slug"|"companyName" }` for each invalid case and `null` for a valid body.
- [ ] 2.3 Run `npm --prefix web run test -- validate.spec` → GREEN for the validation module.

## Phase 3: RED tests (endpoint, validation, transaction, unique-violation mapping)

- [ ] 3.1 Create `web/src/app/api/auth/register/route.spec.ts` — RED happy-path test: valid body → `201`, payload `{ id, email, role: "owner", companyId }`, no `passwordHash`.
- [ ] 3.2 RED test: duplicate email pre-check hit → `409 { field: "email" }`, no inserts.
- [ ] 3.3 RED test: duplicate slug pre-check hit → `409 { field: "slug" }`, no inserts.
- [ ] 3.4 RED test: short password (`<8`) → `422 { field: "password" }`, no DB write.
- [ ] 3.5 RED test: invalid email `"not-an-email"` → `422 { field: "email" }`.
- [ ] 3.6 RED test: malformed slug (`"Acme Co!"`, `"-acme"`, `"a"`) → `422 { field: "slug" }`.
- [ ] 3.7 RED test: empty `companyName` → `422 { field: "companyName" }`.
- [ ] 3.8 RED test: first-user-owner asserts inserted user `role === "owner"` and `validationDomains` deep-equals `["*"]`.
- [ ] 3.9 RED test: bcrypt spy — `bcrypt.hash` called with cost `10`; stored `passwordHash` starts with `$2` and ≠ plaintext.
- [ ] 3.10 RED test: transactional rollback — user insert throws inside tx → company insert rolled back (no `companies` row committed).
- [ ] 3.11 RED test: DB unique-violation `code:"23505"` with `constraint:"companies_slug_unique"` → `409 { field: "slug" }`, never `500`.
- [ ] 3.12 RED test: DB unique-violation `code:"23505"` with `constraint:"users_email_unique"` → `409 { field: "email" }`, never `500`.
- [ ] 3.13 Run `npm --prefix web run test -- route.spec` → all RED tests fail (no route yet).

## Phase 4: GREEN endpoint (POST /api/auth/register)

- [ ] 4.1 Create `web/src/app/api/auth/register/route.ts` — `export async function POST(req: Request)` Node runtime; call `validateSignup(body)` → return `422 { field }` on non-null.
- [ ] 4.2 Implement `db.transaction(async (tx) => …)` inserting `companies` (id=slug) then `users` (bcrypt `hash(password, 10)` inside tx, `role: "owner"`, `validationDomains: ["*"]`, `id: user-${crypto.randomUUID()}`).
- [ ] 4.3 Add defensive `SELECT count(*) FROM users WHERE companyId = slug` inside tx → throw `UniqueConflictError("slug")` if >0.
- [ ] 4.4 Add pre-check `SELECT` for `users.email` and `companies.slug` before tx → `409` with matching field on hit (advisory).
- [ ] 4.5 Add `catch` mapping `err.code === "23505"` by `err.constraint` → `409 { field }`; rethrow other errors → `500`.
- [ ] 4.6 Return `NextResponse.json({ id, email, role, companyId }, { status: 201 })` (trimmed, no `passwordHash`).
- [ ] 4.7 Add header comment documenting owner-inflation assumption + auto-sign-in intent.
- [ ] 4.8 Run `npm --prefix web run test -- route.spec` → all RED tests GREEN (triangulate edge cases if gaps).

## Phase 5: /register page + LoginPage cross-link + middleware allowlist

- [ ] 5.1 Edit `web/src/auth/config.ts` `isPublic` — add `pathname === "/register"` (near existing `/login` branch).
- [ ] 5.2 Create `web/src/components/auth/RegisterPage.tsx` ("use client") mirroring `LoginPage.tsx` split-screen with email/password/companyName/slug fields; import shared `validateSignup` for client-side checks.
- [ ] 5.3 In `RegisterPage.tsx`: on submit, POST `/api/auth/register`; on `201` call `signIn("credentials", { email, password, redirect: false })` then `router.push("/")` + `router.refresh()`; on `signIn` error show "Account created — log in" link to `/login`.
- [ ] 5.4 In `RegisterPage.tsx`: surface `body.field` inline next to matching input on non-`201`; footer link "Already have an account? Log in" → `/login`.
- [ ] 5.5 Create `web/src/app/register/page.tsx` — `<Suspense><RegisterPage/></Suspense>` mirroring `login/page.tsx`.
- [ ] 5.6 Edit `web/src/components/auth/LoginPage.tsx` — add `<Link className="…mt-4 text-sm" href="/register">Create account →</Link>` below submit button.
- [ ] 5.7 Add UI test asserting `/login` links to `/register` and `/register` links to `/login`.

## Phase 6: Verify (typecheck, test, typecheck after migration)

- [ ] 6.1 Run `npm --prefix web run typecheck` → passes with new route + page files.
- [ ] 6.2 Run `npm --prefix web run test` → all suites pass (validate, route, UI cross-link).
- [ ] 6.3 Re-run `npm --prefix web run typecheck` after schema.ts migration edit → confirms Drizzle types regenerated/consistent.
- [ ] 6.4 Confirm no plaintext password in any response, log, or test assertion snapshot (manual grep `password:` in `route.ts`/`RegisterPage.tsx`).
