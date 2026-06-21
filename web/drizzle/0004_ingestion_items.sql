CREATE TABLE "ingestion_items" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "ingestion_items_company_idx" ON "ingestion_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ingestion_items_status_idx" ON "ingestion_items" USING btree ("status");