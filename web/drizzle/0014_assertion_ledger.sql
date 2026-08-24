CREATE TYPE "public"."assertion_status" AS ENUM('draft', 'proposed', 'approved', 'disputed', 'rejected', 'superseded', 'expired', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."confidence_class" AS ENUM('unverified', 'weak', 'supported', 'verified', 'contested');
--> statement-breakpoint
CREATE TABLE "evidence_sources" ("id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL REFERENCES "companies"("id"), "type" text NOT NULL, "created_by" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE TABLE "evidence_items" ("id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL REFERENCES "companies"("id"), "source_id" text NOT NULL REFERENCES "evidence_sources"("id"), "content_hash" text, "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE TABLE "assertions" ("id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL REFERENCES "companies"("id"), "subject_entity_id" text NOT NULL, "predicate" text NOT NULL, "object_entity_id" text, "scalar_value" jsonb, "status" "assertion_status" NOT NULL, "proposed_by" text NOT NULL, "approved_by" text, "valid_from" timestamp with time zone, "valid_until" timestamp with time zone, "recorded_at" timestamp with time zone DEFAULT now() NOT NULL, "superseded_by" text, "confidence_class" "confidence_class" NOT NULL, "review_due_at" timestamp with time zone, "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL);
--> statement-breakpoint
CREATE TABLE "assertion_evidence" ("id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL REFERENCES "companies"("id"), "assertion_id" text NOT NULL REFERENCES "assertions"("id"), "evidence_item_id" text NOT NULL REFERENCES "evidence_items"("id"), "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "assertion_evidence_unique" UNIQUE("assertion_id", "evidence_item_id"));
--> statement-breakpoint
CREATE INDEX "evidence_sources_org_idx" ON "evidence_sources" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "evidence_items_org_idx" ON "evidence_items" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "evidence_items_source_idx" ON "evidence_items" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX "assertions_org_idx" ON "assertions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "assertions_subject_idx" ON "assertions" USING btree ("subject_entity_id");
--> statement-breakpoint
CREATE INDEX "assertions_status_idx" ON "assertions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "assertion_evidence_org_idx" ON "assertion_evidence" USING btree ("organization_id");
