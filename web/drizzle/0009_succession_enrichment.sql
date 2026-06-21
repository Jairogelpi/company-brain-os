ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "detailed_steps" jsonb;
--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "suggested_trainer_id" text;
--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "suggested_trainer_name" text;
--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "rationale" text;
--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "risk_note" text;
