/**
 * Rate limiter — token bucket algorithm.
 * Limits requests per IP/endpoint to prevent abuse.
 */

interface TokenBucket {
	tokens: number;
	lastRefill: number;
}

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "@/db";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number };

const buckets = new Map<string, TokenBucket>();

const MAX_RATE_LIMIT_BUCKETS = 10_000;
const DEFAULT_RATE = 60; // requests per minute
const DEFAULT_CAPACITY = 100;

export function checkRateLimit(
	key: string,
	rate: number = DEFAULT_RATE,
	capacity: number = DEFAULT_CAPACITY,
): { allowed: boolean; remaining: number; retryAfter: number } {
	const now = Date.now();
	let bucket = buckets.get(key);

	if (!bucket) {
		if (buckets.size >= MAX_RATE_LIMIT_BUCKETS) {
			const oldestKey = buckets.keys().next().value as string | undefined;
			if (oldestKey) buckets.delete(oldestKey);
		}
		bucket = { tokens: capacity, lastRefill: now };
		buckets.set(key, bucket);
	}

	// Refill tokens
	const elapsed = (now - bucket.lastRefill) / 1000;
	bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * (rate / 60));
	bucket.lastRefill = now;

	if (bucket.tokens >= 1) {
		bucket.tokens -= 1;
		return {
			allowed: true,
			remaining: Math.floor(bucket.tokens),
			retryAfter: 0,
		};
	}

	const retryAfter = Math.ceil((1 - bucket.tokens) / (rate / 60));
	return { allowed: false, remaining: 0, retryAfter };
}

/** Multi-instance-safe token bucket backed by a row lock in PostgreSQL. */
export async function checkDistributedRateLimit(
	key: string,
	rate: number = DEFAULT_RATE,
	capacity: number = DEFAULT_CAPACITY,
	db: Db = createDb(),
): Promise<RateLimitResult> {
	if (!key || rate <= 0 || capacity <= 0) throw new Error("Invalid rate limit configuration");
	const keyHash = createHash("sha256").update(key).digest("hex");
	return db.transaction(async (tx) => {
		const result = await tx.execute(sql<{
			allowed: boolean;
			remaining: number;
			retry_after: number;
		}>`
			WITH current_bucket AS (
				INSERT INTO rate_limit_buckets (key_hash, tokens, last_refill, expires_at)
				VALUES (${keyHash}, ${capacity}, clock_timestamp(), clock_timestamp() + interval '1 day')
				ON CONFLICT (key_hash) DO UPDATE SET key_hash = EXCLUDED.key_hash
				RETURNING tokens, last_refill
			), refill AS (
				SELECT LEAST(
					${capacity}::double precision,
					tokens + EXTRACT(EPOCH FROM (clock_timestamp() - last_refill)) * (${rate}::double precision / 60.0)
				) AS available
				FROM current_bucket
			), updated AS (
				UPDATE rate_limit_buckets
				SET tokens = GREATEST(refill.available - 1.0, 0.0),
					last_refill = clock_timestamp(),
					expires_at = clock_timestamp() + interval '1 day'
				FROM refill
				WHERE key_hash = ${keyHash}
				RETURNING refill.available
			)
			SELECT
				(available >= 1.0) AS allowed,
				FLOOR(GREATEST(available - 1.0, 0.0))::int AS remaining,
				CASE WHEN available >= 1.0 THEN 0
				ELSE CEIL((1.0 - available) / (${rate}::double precision / 60.0))::int END AS retry_after
			FROM updated
		`);
		await tx.execute(sql`
			DELETE FROM rate_limit_buckets
			WHERE key_hash IN (
				SELECT key_hash FROM rate_limit_buckets
				WHERE expires_at < clock_timestamp()
				LIMIT 100
			)
		`);
		const row = result.rows[0] as {
			allowed: boolean;
			remaining: number;
			retry_after: number;
		} | undefined;
		if (!row) throw new Error("Rate limiter did not return a result");
		return {
			allowed: row.allowed,
			remaining: row.remaining,
			retryAfter: row.retry_after,
		};
	});
}

/**
 * Reset all rate limit buckets (for testing).
 */
export function resetRateLimits(): void {
	buckets.clear();
}
