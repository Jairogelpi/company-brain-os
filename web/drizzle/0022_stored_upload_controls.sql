CREATE TABLE "stored_uploads" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL REFERENCES "companies"("id"),
  "filename" text NOT NULL,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "content_sha256" text,
  "uploaded_by" text NOT NULL,
  "scan_provider" text NOT NULL,
  "status" text DEFAULT 'available' NOT NULL,
  "retention_until" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stored_uploads_status_check" CHECK ("status" IN ('available', 'rejected', 'expired')),
  CONSTRAINT "stored_uploads_size_check" CHECK ("size_bytes" >= 0),
  CONSTRAINT "stored_uploads_company_filename_unique" UNIQUE ("company_id", "filename")
);
--> statement-breakpoint
CREATE INDEX "stored_uploads_company_idx" ON "stored_uploads" ("company_id");
--> statement-breakpoint
CREATE INDEX "stored_uploads_retention_idx" ON "stored_uploads" ("retention_until");
--> statement-breakpoint
ALTER TABLE "stored_uploads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stored_uploads" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "stored_uploads_tenant_isolation" ON "stored_uploads"
  USING (company_id = current_setting('app.organization_id', true))
  WITH CHECK (company_id = current_setting('app.organization_id', true));
--> statement-breakpoint

-- Preserve access metadata for previously uploaded mission files. Their hash
-- and scan provider remain explicitly unknown and should be revalidated.
INSERT INTO "stored_uploads" (
  id, company_id, filename, original_name, mime_type, size_bytes,
  content_sha256, uploaded_by, scan_provider, status, retention_until, created_at
)
SELECT
  'legacy-upload:' || ms.id,
  ms.company_id,
  substring(ms.storage_url from '/api/upload/([a-fA-F0-9-]{36}\.[a-zA-Z0-9]+)'),
  COALESCE(ms.file_name, 'legacy-upload'),
  COALESCE(ms.mime_type, 'application/octet-stream'),
  0,
  NULL,
  ms.author_id,
  'legacy-unverified',
  'available',
  now() + interval '90 days',
  ms.created_at
FROM "mission_submissions" ms
WHERE ms.kind = 'file'
  AND ms.storage_url ~ '/api/upload/[a-fA-F0-9-]{36}\.[a-zA-Z0-9]+'
ON CONFLICT (company_id, filename) DO NOTHING;
