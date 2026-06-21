import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limiter";

describe("rate-limiter", () => {
	it("evicts the oldest bucket when the internal bucket cap is reached", () => {
		resetRateLimits();
		const capacity = 1;

		const first = checkRateLimit("ip-0", 60, capacity);
		const drained = checkRateLimit("ip-0", 60, capacity);
		for (let i = 1; i <= 10_000; i += 1) {
			checkRateLimit(`ip-${i}`, 60, capacity);
		}
		const afterEviction = checkRateLimit("ip-0", 60, capacity);

		expect(first.allowed).toBe(true);
		expect(drained.allowed).toBe(false);
		expect(afterEviction.allowed).toBe(true);
	});

	it("resetRateLimits clears drained buckets", () => {
		resetRateLimits();
		const capacity = 1;
		checkRateLimit("a", 60, capacity);
		expect(checkRateLimit("a", 60, capacity).allowed).toBe(false);

		resetRateLimits();

		expect(checkRateLimit("a", 60, capacity).allowed).toBe(true);
	});
});
