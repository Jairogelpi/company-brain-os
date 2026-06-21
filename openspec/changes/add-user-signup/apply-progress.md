# Apply Progress — add-user-signup

## Status

Completed with TDD evidence.

## RED evidence

Validation RED:

```text
npx vitest run src/auth/signup-validation.test.ts --config vitest.config.ts
```

Initial failure: missing `signup-validation` module.

Route RED:

```text
npx vitest run src/auth/signup-validation.test.ts src/app/api/auth/register/route.test.ts --config vitest.config.ts
```

Initial route failure: missing `app/api/auth/register/route.ts`.

UI RED:

```text
npx vitest run src/auth/signup-ui.test.ts --config vitest.config.ts
```

Initial UI failure: `/register` not public, no login link, no register route, no RegisterPage.

## GREEN implementation

- Added `web/src/auth/signup-validation.ts` with shared `validateSignup()` and `normalizeSignupBody()`.
- Added `web/src/auth/signup-validation.test.ts` covering email, password, companyName, slug validation.
- Added Drizzle-generated migration `web/drizzle/0006_keen_white_tiger.sql` plus `meta/0006_snapshot.json` and `_journal.json` entry with `companies_slug_unique` constraint and `companies_slug_idx` index.
- Updated `web/src/db/schema.ts` to declare `unique("companies_slug_unique").on(table.slug)` and `index("companies_slug_idx")`.
- Added `web/src/app/api/auth/register/route.ts` public Node route:
  - validates body;
  - pre-checks duplicate email and company slug;
  - inserts company + owner user in a DB transaction;
  - hashes password with bcrypt cost 10;
  - maps known Postgres `23505` unique violations to `409 { field }` and rethrows unknown unique violations instead of masking them.
- Added `web/src/app/api/auth/register/route.test.ts` with mocked DB/bcrypt coverage for happy path, validation, duplicate email/slug, and unique-violation mapping.
- Added `/register` page and `RegisterPage` client form.
- Added `/register` to `authConfig` public routes.
- Added login → register and register → login links.
- Added `signup-ui.test.ts` static wiring tests.

## Verification

Focused signup suite:

```text
npx vitest run src/auth/signup-validation.test.ts src/app/api/auth/register/route.test.ts src/auth/signup-ui.test.ts --config vitest.config.ts
```

Result: 3 files passed, 23 tests passed. Migration metadata regression test also passed: 1 file, 2 tests.

Full verification:

```text
npm run typecheck
npm run test
```

Result: typecheck passed. Full suite passed after migration metadata fix: 34 passed files, 1 skipped file, 330 passed tests, 3 skipped tests.

## Notes

- UI remains on the current pre-redesign visual system. The later `redesign-ui-refero` change will restyle login/register and add the graph hero animation.
- This change intentionally implements self-serve company creation only. Invite-token join, email verification, password reset, OAuth, and memberships migration remain out of scope.
