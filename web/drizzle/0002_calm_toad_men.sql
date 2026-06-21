CREATE TABLE "memberships" (
	"user_id" text NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_scopes" (
	"user_id" text NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"domain" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_company_idx" ON "memberships" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "validation_scopes_user_idx" ON "validation_scopes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "validation_scopes_company_idx" ON "validation_scopes" USING btree ("company_id");