/**
 * Rate limiter — token bucket algorithm.
 * Limits requests per IP/endpoint to prevent abuse.
 */

interface TokenBucket {
	tokens: number;
	lastRefill: number;
}

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

/**
 * Reset all rate limit buckets (for testing).
 */
export function resetRateLimits(): void {
	buckets.clear();
}
