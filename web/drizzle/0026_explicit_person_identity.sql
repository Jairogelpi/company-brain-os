-- Bind authenticated identities to canonical Person nodes so transfer
-- independence is checked by stable IDs, never by display-name heuristics.
ALTER TABLE "user_profiles" ADD COLUMN "person_node_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_company_person_unique"
  ON "user_profiles" ("company_id", "person_node_id")
  WHERE "person_node_id" IS NOT NULL;
--> statement-breakpoint

-- Conservative legacy backfill: only exact normalized names with a unique
-- user and a unique active Person in the same tenant are linked automatically.
WITH candidates AS (
  SELECT
    u."id" AS user_id,
    u."company_id",
    n."id" AS person_node_id,
    count(*) OVER (PARTITION BY u."id", u."company_id") AS people_for_user,
    count(*) OVER (PARTITION BY n."id", n."company_id") AS users_for_person
  FROM "users" u
  JOIN "nodes" n
    ON n."company_id" = u."company_id"
   AND n."type"::text = 'Person'
   AND n."archived" = false
   AND lower(trim(n."name")) = lower(trim(u."name"))
), unique_matches AS (
  SELECT user_id, company_id, person_node_id
  FROM candidates
  WHERE people_for_user = 1 AND users_for_person = 1
)
INSERT INTO "user_profiles" ("user_id", "company_id", "person_node_id")
SELECT user_id, company_id, person_node_id FROM unique_matches
ON CONFLICT ("user_id") DO UPDATE
SET "person_node_id" = EXCLUDED."person_node_id", "updated_at" = now()
WHERE "user_profiles"."person_node_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "mission_transfer_verifications" ADD COLUMN "assessor_person_id" text;
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" ADD COLUMN "reviewer_person_id" text;
--> statement-breakpoint
UPDATE "mission_transfer_verifications" verification
SET "assessor_person_id" = profile."person_node_id"
FROM "user_profiles" profile
WHERE profile."company_id" = verification."company_id"
  AND profile."user_id" = verification."assessor_id"
  AND profile."person_node_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "mission_transfer_verifications" verification
SET "reviewer_person_id" = profile."person_node_id"
FROM "user_profiles" profile
WHERE profile."company_id" = verification."company_id"
  AND profile."user_id" = verification."reviewer_id"
  AND profile."person_node_id" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "mission_transfer_verifications" DROP CONSTRAINT "mission_transfer_review_check";
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" ADD CONSTRAINT "mission_transfer_review_check"
  CHECK (
    (status = 'proposed' AND reviewer_id IS NULL AND reviewer_person_id IS NULL AND reviewed_at IS NULL)
    OR (status = 'approved' AND assessor_person_id IS NOT NULL AND reviewer_id IS NOT NULL AND reviewer_person_id IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (status = 'rejected' AND reviewer_id IS NOT NULL AND reviewer_person_id IS NOT NULL AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL)
  );
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" ADD CONSTRAINT "mission_transfer_independent_people_check"
  CHECK (
    assessor_person_id IS NULL
    OR assessor_person_id <> backup_person_id
  );
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" ADD CONSTRAINT "mission_transfer_independent_reviewer_check"
  CHECK (
    (reviewer_id IS NULL AND reviewer_person_id IS NULL)
    OR (
      reviewer_id IS DISTINCT FROM assessor_id
      AND reviewer_person_id <> backup_person_id
      AND reviewer_person_id IS DISTINCT FROM assessor_person_id
    )
  );
