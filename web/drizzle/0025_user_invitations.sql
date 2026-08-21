ALTER TABLE "notifications" ALTER COLUMN "recipient_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_in_app_recipient_check"
  CHECK (channel <> 'in_app' OR recipient_id IS NOT NULL);
--> statement-breakpoint

CREATE TABLE "user_invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL REFERENCES "companies"("id"),
  "email" text NOT NULL,
  "role" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "invited_by" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_at" timestamp with time zone,
  CONSTRAINT "user_invitations_role_check" CHECK (role IN ('validator', 'contributor', 'viewer')),
  CONSTRAINT "user_invitations_status_check" CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  CONSTRAINT "user_invitations_inviter_company_fk" FOREIGN KEY ("invited_by", "company_id") REFERENCES "users"("id", "company_id"),
  CONSTRAINT "user_invitations_acceptor_company_fk" FOREIGN KEY ("accepted_by", "company_id") REFERENCES "users"("id", "company_id"),
  CONSTRAINT "user_invitations_acceptance_check" CHECK (
    (status = 'accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
    OR status <> 'accepted'
  )
);
--> statement-breakpoint
CREATE INDEX "user_invitations_company_idx" ON "user_invitations" ("company_id");
--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "user_invitations" ("company_id", "email");
--> statement-breakpoint
CREATE INDEX "user_invitations_status_idx" ON "user_invitations" ("company_id", "status");
--> statement-breakpoint
ALTER TABLE "user_invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_invitations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "user_invitations_tenant_isolation" ON "user_invitations"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
