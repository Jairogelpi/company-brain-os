-- Defense in depth for every tenant-owned table used by the canonical graph,
-- mission workflow, and ingestion inbox. Application queries set the tenant
-- with set_config inside the exact transaction that executes the query.
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_id_company_unique" UNIQUE ("id", "company_id");
--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_id_company_unique" UNIQUE ("id", "company_id");
--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_id_org_unique" UNIQUE ("id", "organization_id");
--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_id_org_unique" UNIQUE ("id", "organization_id");
--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_id_org_unique" UNIQUE ("id", "organization_id");
--> statement-breakpoint

ALTER TABLE "nodes" ADD CONSTRAINT "nodes_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_from_node_company_fk" FOREIGN KEY ("from_node_id", "company_id") REFERENCES "nodes"("id", "company_id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_to_node_company_fk" FOREIGN KEY ("to_node_id", "company_id") REFERENCES "nodes"("id", "company_id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "node_layout" ADD CONSTRAINT "node_layout_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "node_layout" ADD CONSTRAINT "node_layout_node_company_fk" FOREIGN KEY ("node_id", "company_id") REFERENCES "nodes"("id", "company_id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "mission_submissions" ADD CONSTRAINT "mission_submissions_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "mission_submissions" ADD CONSTRAINT "mission_submissions_mission_company_fk" FOREIGN KEY ("mission_id", "company_id") REFERENCES "missions"("id", "company_id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" ADD CONSTRAINT "mission_transfer_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" ADD CONSTRAINT "mission_transfer_mission_company_fk" FOREIGN KEY ("mission_id", "company_id") REFERENCES "missions"("id", "company_id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "ingestion_items" ADD CONSTRAINT "ingestion_items_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_source_org_fk" FOREIGN KEY ("source_id", "organization_id") REFERENCES "evidence_sources"("id", "organization_id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "assertion_evidence" ADD CONSTRAINT "assertion_evidence_assertion_org_fk" FOREIGN KEY ("assertion_id", "organization_id") REFERENCES "assertions"("id", "organization_id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "assertion_evidence" ADD CONSTRAINT "assertion_evidence_item_org_fk" FOREIGN KEY ("evidence_item_id", "organization_id") REFERENCES "evidence_items"("id", "organization_id") NOT VALID;
--> statement-breakpoint

ALTER TABLE "nodes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "nodes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "nodes_tenant_isolation" ON "nodes"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "edges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "edges" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "edges_tenant_isolation" ON "edges"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "event_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "event_log_tenant_isolation" ON "event_log"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "node_layout" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "node_layout" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "node_layout_tenant_isolation" ON "node_layout"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "missions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "missions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "missions_tenant_isolation" ON "missions"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "mission_submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mission_submissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mission_submissions_tenant_isolation" ON "mission_submissions"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mission_transfer_verifications_tenant_isolation" ON "mission_transfer_verifications"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "ingestion_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ingestion_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ingestion_items_tenant_isolation" ON "ingestion_items"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
