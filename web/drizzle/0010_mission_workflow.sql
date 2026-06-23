-- 0010_mission_workflow.sql
-- Mission assignment + employee submissions + boss review (approve/reject).

ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "instructions" text;
--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "assignee_id" text;
--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mission_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"mission_id" text NOT NULL,
	"author_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text,
	"storage_url" text,
	"file_name" text,
	"mime_type" text,
	"media_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_id" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mission_submissions_company_idx" ON "mission_submissions" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mission_submissions_mission_idx" ON "mission_submissions" USING btree ("mission_id");
