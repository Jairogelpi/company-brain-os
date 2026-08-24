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
--> statement-breakpoint

-- Ledger rows are invisible until a service explicitly establishes the tenant
-- inside the current transaction with set_config('app.organization_id', ...).
ALTER TABLE "assertions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "assertions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assertions_tenant_isolation" ON "assertions"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "evidence_sources" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "evidence_sources" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "evidence_sources_tenant_isolation" ON "evidence_sources"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "evidence_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "evidence_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "evidence_items_tenant_isolation" ON "evidence_items"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "assertion_evidence" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "assertion_evidence" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assertion_evidence_tenant_isolation" ON "assertion_evidence"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
