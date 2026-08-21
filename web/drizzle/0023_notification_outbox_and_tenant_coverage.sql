-- Close the remaining tenant-owned storage gaps and replace the in-memory
-- notification stub with a durable delivery outbox.
ALTER TABLE "users" ADD CONSTRAINT "users_id_company_unique" UNIQUE ("id", "company_id");
--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "validation_scopes" ADD CONSTRAINT "validation_scopes_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint

ALTER TABLE "node_embeddings" ADD COLUMN "company_id" text;
--> statement-breakpoint
UPDATE "node_embeddings" ne
SET "company_id" = n."company_id"
FROM "nodes" n
WHERE n."id" = ne."node_id";
--> statement-breakpoint
ALTER TABLE "node_embeddings" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "node_embeddings" ADD CONSTRAINT "node_embeddings_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "node_embeddings" ADD CONSTRAINT "node_embeddings_node_company_fk" FOREIGN KEY ("node_id", "company_id") REFERENCES "nodes"("id", "company_id") NOT VALID;
--> statement-breakpoint
CREATE INDEX "node_embeddings_company_idx" ON "node_embeddings" ("company_id");
--> statement-breakpoint

CREATE TABLE "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "recipient_id" text NOT NULL,
  "channel" text NOT NULL,
  "destination" text,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "action_url" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_error" text,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  CONSTRAINT "notifications_status_check" CHECK ("status" IN ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
  CONSTRAINT "notifications_channel_check" CHECK ("channel" IN ('email', 'in_app')),
  CONSTRAINT "notifications_company_idempotency_unique" UNIQUE ("company_id", "idempotency_key"),
  CONSTRAINT "notifications_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id"),
  CONSTRAINT "notifications_recipient_company_fk" FOREIGN KEY ("recipient_id", "company_id") REFERENCES "users"("id", "company_id")
);
--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" ("company_id", "recipient_id");
--> statement-breakpoint
CREATE INDEX "notifications_delivery_idx" ON "notifications" ("company_id", "status", "next_attempt_at");
--> statement-breakpoint
UPDATE "assertions"
SET "approved_by" = 'system:migration-0023-legacy-approval',
    "metadata" = "metadata" || '{"legacyApprovalBackfill":true}'::jsonb
WHERE "status" = 'approved' AND "approved_by" IS NULL;
--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_approved_by_check"
  CHECK (status <> 'approved' OR approved_by IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_valid_window_check"
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until > valid_from);
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" ADD CONSTRAINT "mission_transfer_review_check"
  CHECK (
    (status = 'proposed' AND reviewer_id IS NULL AND reviewed_at IS NULL)
    OR (status = 'approved' AND reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (status = 'rejected' AND reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL)
  );
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_destination_check"
  CHECK (channel <> 'email' OR destination IS NOT NULL);
--> statement-breakpoint

-- `NOT VALID` allowed the earlier online migration to install constraints
-- without a long table lock. Release readiness requires proving every legacy
-- row now satisfies them; migration stops for explicit repair if it does not.
ALTER TABLE "nodes" VALIDATE CONSTRAINT "nodes_company_fk";
--> statement-breakpoint
ALTER TABLE "edges" VALIDATE CONSTRAINT "edges_company_fk";
--> statement-breakpoint
ALTER TABLE "edges" VALIDATE CONSTRAINT "edges_from_node_company_fk";
--> statement-breakpoint
ALTER TABLE "edges" VALIDATE CONSTRAINT "edges_to_node_company_fk";
--> statement-breakpoint
ALTER TABLE "event_log" VALIDATE CONSTRAINT "event_log_company_fk";
--> statement-breakpoint
ALTER TABLE "node_layout" VALIDATE CONSTRAINT "node_layout_company_fk";
--> statement-breakpoint
ALTER TABLE "node_layout" VALIDATE CONSTRAINT "node_layout_node_company_fk";
--> statement-breakpoint
ALTER TABLE "missions" VALIDATE CONSTRAINT "missions_company_fk";
--> statement-breakpoint
ALTER TABLE "mission_submissions" VALIDATE CONSTRAINT "mission_submissions_company_fk";
--> statement-breakpoint
ALTER TABLE "mission_submissions" VALIDATE CONSTRAINT "mission_submissions_mission_company_fk";
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" VALIDATE CONSTRAINT "mission_transfer_company_fk";
--> statement-breakpoint
ALTER TABLE "mission_transfer_verifications" VALIDATE CONSTRAINT "mission_transfer_mission_company_fk";
--> statement-breakpoint
ALTER TABLE "ingestion_items" VALIDATE CONSTRAINT "ingestion_items_company_fk";
--> statement-breakpoint
ALTER TABLE "evidence_items" VALIDATE CONSTRAINT "evidence_items_source_org_fk";
--> statement-breakpoint
ALTER TABLE "assertion_evidence" VALIDATE CONSTRAINT "assertion_evidence_assertion_org_fk";
--> statement-breakpoint
ALTER TABLE "assertion_evidence" VALIDATE CONSTRAINT "assertion_evidence_item_org_fk";
--> statement-breakpoint
ALTER TABLE "transcription_jobs" VALIDATE CONSTRAINT "transcription_jobs_company_fk";
--> statement-breakpoint
ALTER TABLE "memberships" VALIDATE CONSTRAINT "memberships_company_fk";
--> statement-breakpoint
ALTER TABLE "validation_scopes" VALIDATE CONSTRAINT "validation_scopes_company_fk";
--> statement-breakpoint
ALTER TABLE "node_embeddings" VALIDATE CONSTRAINT "node_embeddings_company_fk";
--> statement-breakpoint
ALTER TABLE "node_embeddings" VALIDATE CONSTRAINT "node_embeddings_node_company_fk";
--> statement-breakpoint

ALTER TABLE "transcription_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "transcription_jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "transcription_jobs_tenant_isolation" ON "transcription_jobs"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "node_embeddings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "node_embeddings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "node_embeddings_tenant_isolation" ON "node_embeddings"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "memberships_tenant_isolation" ON "memberships"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "validation_scopes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "validation_scopes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "validation_scopes_tenant_isolation" ON "validation_scopes"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notifications_tenant_isolation" ON "notifications"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
