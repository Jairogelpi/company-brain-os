import { describe, expect, it } from "vitest";
import { pgTable, text } from "drizzle-orm/pg-core";
import { vector768 } from "./vector-type";

function makeVec768(): number[] {
	const v = new Array<number>(768);
	for (let i = 0; i < 768; i++) v[i] = (i % 17) / 23;
	return v;
}

/** Build a throwaway table so we can instantiate the column and exercise
 *  the driver mapping functions the built-in pgvector type ships. */
const probeTable = pgTable("probe", {
	id: text("id").primaryKey(),
	embedding: vector768("embedding").notNull(),
});

function column() {
	// The table proxy's `.embedding` property IS the PgVector column instance.
	return probeTable.embedding as unknown as {
		getSQLType: () => string;
		mapToDriverValue: (v: unknown) => unknown;
		mapFromDriverValue: (v: string) => unknown;
		dimensions: number;
	};
}

describe("vector768 column type", () => {
	it("declares SQL type vector(768)", () => {
		expect(column().getSQLType()).toBe("vector(768)");
	});

	it("pins dimensions to 768", () => {
		expect(column().dimensions).toBe(768);
	});

	it("mapToDriverValue serializes a number[] to a [v1,v2,...] literal", () => {
		const out = column().mapToDriverValue([1, 2, 3]);
		expect(out).toBe("[1,2,3]");
		expect(String(out).startsWith("[")).toBe(true);
		expect(String(out).endsWith("]")).toBe(true);
	});

	it("mapFromDriverValue parses a pgvector string into number[] of length 768", () => {
		const v = makeVec768();
		const str = `[${v.join(",")}]`;
		const parsed = column().mapFromDriverValue(str) as number[];
		expect(parsed).toHaveLength(768);
		for (let i = 0; i < 768; i++) {
			expect(parsed[i]).toBeCloseTo(v[i], 5);
		}
	});

	it("round-trips mapToDriverValue → mapFromDriverValue for a 768-vector", () => {
		const col = column();
		const v = makeVec768();
		const round = col.mapFromDriverValue(
			col.mapToDriverValue(v) as string,
		) as number[];
		expect(round).toHaveLength(768);
		for (let i = 0; i < 768; i++) {
			expect(round[i]).toBeCloseTo(v[i], 5);
		}
	});
});
