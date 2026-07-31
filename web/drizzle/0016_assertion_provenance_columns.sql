ALTER TABLE "assertions" ADD COLUMN "source_type" text;
--> statement-breakpoint
ALTER TABLE "assertions" ADD COLUMN "source_id" text;
--> statement-breakpoint
UPDATE "assertions"
SET "source_type" = COALESCE(metadata->>'sourceType', 'legacy'),
    "source_id" = COALESCE(metadata->>'sourceId', id)
WHERE "source_type" IS NULL OR "source_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "assertions" ALTER COLUMN "source_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "assertions" ALTER COLUMN "source_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "assertions_source_idx" ON "assertions" USING btree ("source_type", "source_id");
