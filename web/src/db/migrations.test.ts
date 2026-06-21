import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const drizzleDir = join(process.cwd(), "drizzle");

describe("drizzle migration metadata", () => {
	it("registers the signup slug uniqueness migration in the journal", () => {
		const journal = JSON.parse(
			readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf8"),
		) as { entries: Array<{ idx: number; tag: string }> };

		expect(journal.entries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ idx: 6, tag: "0006_keen_white_tiger" }),
			]),
		);
		expect(existsSync(join(drizzleDir, "meta", "0006_snapshot.json"))).toBe(
			true,
		);
	});

	it("migration 0006 adds the company slug unique constraint", () => {
		const sql = readFileSync(
			join(drizzleDir, "0006_keen_white_tiger.sql"),
			"utf8",
		);

		expect(sql).toContain('CONSTRAINT "companies_slug_unique" UNIQUE');
		expect(sql).toContain('CREATE INDEX "companies_slug_idx"');
	});
});
