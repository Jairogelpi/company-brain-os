import { afterAll, beforeAll, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
	describeIntegration,
	startIntegrationDb,
	type IntegrationDb,
} from "./setup";

describeIntegration("database extensions integration", () => {
	let ctx: IntegrationDb | null = null;
	let unavailableReason: string | null = null;

	beforeAll(async () => {
		try {
			ctx = await startIntegrationDb();
		} catch (error) {
			unavailableReason = `Integration DB unavailable: ${(error as Error).message}`;
		}
	});

	afterAll(async () => {
		await ctx?.stop();
	});

	it("loads pgvector and supports vector distance queries", async () => {
		if (!ctx) {
			console.warn(unavailableReason);
			return;
		}

		const result = await ctx.db.execute(sql`
			SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector AS distance
		`);

		expect(Number(result.rows[0]?.distance)).toBeGreaterThan(0);
	});

	it("either loads Apache AGE or reports a non-blocking skip reason", async () => {
		if (!ctx) {
			console.warn(unavailableReason);
			return;
		}

		if (!ctx.ageAvailable) {
			expect(ctx.ageSkipReason).toContain("AGE unavailable");
			return;
		}

		const result = await ctx.db.execute(sql`
			SELECT extname FROM pg_extension WHERE extname = 'age'
		`);
		expect(result.rows).toHaveLength(1);
	});

	it("applies schema tables needed by repository tests", async () => {
		if (!ctx) {
			console.warn(unavailableReason);
			return;
		}

		const result = await ctx.db.execute(sql`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name IN ('companies', 'nodes', 'edges', 'node_embeddings')
			ORDER BY table_name
		`);
		type TableRow = { table_name: string };
		expect((result.rows as TableRow[]).map((row) => row.table_name)).toEqual([
			"companies",
			"edges",
			"node_embeddings",
			"nodes",
		]);
	});
});
