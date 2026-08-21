CREATE TABLE "mission_transfer_verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "mission_id" text NOT NULL REFERENCES "missions"("id") ON DELETE CASCADE,
  "target_node_id" text NOT NULL,
  "backup_person_id" text NOT NULL,
  "assessor_id" text NOT NULL,
  "competency_level" integer NOT NULL,
  "access_verified" boolean DEFAULT false NOT NULL,
  "evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'proposed' NOT NULL,
  "reviewer_id" text,
  "rejection_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  CONSTRAINT "mission_transfer_competency_check" CHECK ("competency_level" BETWEEN 0 AND 5),
  CONSTRAINT "mission_transfer_status_check" CHECK ("status" IN ('proposed', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX "mission_transfer_verifications_company_idx" ON "mission_transfer_verifications" ("company_id");
--> statement-breakpoint
CREATE INDEX "mission_transfer_verifications_mission_idx" ON "mission_transfer_verifications" ("mission_id");
--> statement-breakpoint
CREATE INDEX "mission_transfer_verifications_status_idx" ON "mission_transfer_verifications" ("status");
