-- Add race-safe company slug uniqueness for self-serve signup.
-- Rollout pre-check:
-- SELECT slug, count(*) FROM companies GROUP BY slug HAVING count(*) > 1;
-- The query above must return zero rows before this migration runs.
CREATE INDEX "companies_slug_idx" ON "companies" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_slug_unique" UNIQUE("slug");