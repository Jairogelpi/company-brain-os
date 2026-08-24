CREATE TABLE "rate_limit_buckets" (
  "key_hash" text PRIMARY KEY NOT NULL,
  "tokens" double precision NOT NULL,
  "last_refill" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_idx" ON "rate_limit_buckets" ("expires_at");
