CREATE TABLE "missions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"person_id" text,
	"objective" text NOT NULL,
	"target_node_id" text NOT NULL,
	"target_node_name" text NOT NULL,
	"assignee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "missions_company_idx" ON "missions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "missions_status_idx" ON "missions" USING btree ("status");