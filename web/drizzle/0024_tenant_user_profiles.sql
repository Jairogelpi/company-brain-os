-- Authentication identities must be discoverable by global unique email before
-- tenant context exists. Sensitive HR/profile fields must not share that table.
CREATE TABLE "user_profiles" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company_id" text NOT NULL REFERENCES "companies"("id"),
  "position" text,
  "department" text,
  "salary" integer,
  "working_hours" integer,
  "contract_type" text,
  "start_date" date,
  "phone" text,
  "bio" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_profiles_user_company_fk" FOREIGN KEY ("user_id", "company_id") REFERENCES "users"("id", "company_id"),
  CONSTRAINT "user_profiles_salary_check" CHECK ("salary" IS NULL OR "salary" >= 0),
  CONSTRAINT "user_profiles_hours_check" CHECK ("working_hours" IS NULL OR "working_hours" BETWEEN 0 AND 168)
);
--> statement-breakpoint
CREATE INDEX "user_profiles_company_idx" ON "user_profiles" ("company_id");
--> statement-breakpoint
INSERT INTO "user_profiles" (
  user_id, company_id, position, department, salary, working_hours,
  contract_type, start_date, phone, bio
)
SELECT
  id, company_id, position, department, salary, working_hours,
  contract_type, start_date, phone, bio
FROM "users"
WHERE position IS NOT NULL OR department IS NOT NULL OR salary IS NOT NULL
   OR working_hours IS NOT NULL OR contract_type IS NOT NULL OR start_date IS NOT NULL
   OR phone IS NOT NULL OR bio IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "position";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "department";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "salary";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "working_hours";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "contract_type";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "start_date";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "bio";
--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "user_profiles_tenant_isolation" ON "user_profiles"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
