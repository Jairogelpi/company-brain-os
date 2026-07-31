-- R0: canonical ontology additions. Legacy enum values remain readable for
-- historical rows; application validation prevents creating them going forward.
ALTER TYPE "node_type" ADD VALUE IF NOT EXISTS 'OrganizationalUnit';
--> statement-breakpoint
ALTER TYPE "node_type" ADD VALUE IF NOT EXISTS 'ExternalParty';
--> statement-breakpoint

-- Tenant context must always be supplied by application services or workers.
ALTER TABLE "nodes" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "edges" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "node_layout" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "event_log" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "missions" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "mission_submissions" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "ingestion_items" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "transcription_jobs" ALTER COLUMN "company_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "validation_scopes" ALTER COLUMN "company_id" DROP DEFAULT;
