CREATE TABLE IF NOT EXISTS "transcription_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"transcript" text,
	"no_speech" boolean DEFAULT false NOT NULL,
	"fail_reason" text,
	"provider" text,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transcription_jobs_company_idx" ON "transcription_jobs" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transcription_jobs_status_idx" ON "transcription_jobs" USING btree ("status");
