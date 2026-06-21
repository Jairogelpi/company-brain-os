import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the embed + db + pgvector-store dependencies before importing retrieve.
const embedMock = vi.fn(async (text: string): Promise<number[]> => {
	// Deterministic 768-dim stub keyed on text length.
	const v = new Array<number>(768);
	for (let i = 0; i < 768; i++) v[i] = ((text.length + i) % 23) / 29;
	return v;
});

const searchMock = vi.fn(
	async (_qv: number[], _topK: number, _companyId?: string) => [
		{
			id: "n-filler",
			score: 0.91,
			metadata: { nodeName: "Filler", nodeType: "Knowledge" },
		},
		{
			id: "n-pedro",
			score: 0.74,
			metadata: { nodeName: "Pedro", nodeType: "Person" },
		},
	],
);

vi.mock("@/ai/embeddings", () => ({ embed: embedMock }));
vi.mock("@/db", () => ({
	createDb: vi.fn(() => undefined),
}));
vi.mock("@/ai/pgvector-store", () => ({
	createPgVectorStore: vi.fn(() => ({
		search: searchMock,
	})),
	DEFAULT_TOP_K: 5,
}));

// nodes lookup mock: returns companyA for n-filler, companyB for n-pedro
const nodesSelectMock = vi.fn(async (ids: string[]) => {
	const rows: Array<{
		id: string;
		name: string;
		type: string;
		company_id: string;
	}> = [];
	for (const id of ids) {
		if (id === "n-filler")
			rows.push({
				id,
				name: "Filler",
				type: "Knowledge",
				company_id: "companyA",
			});
		else if (id === "n-pedro")
			rows.push({ id, name: "Pedro", type: "Person", company_id: "companyB" });
	}
	return rows;
});

// We import retrieve after mocks are in place.
const { retrieveContexts, enrichAndFilter } = await import("./retrieve");
const { buildNodeContent } = await import("@/ai/node-content");

describe("retrieveContexts", () => {
	beforeEach(() => {
		searchMock.mockClear();
		embedMock.mockClear();
		nodesSelectMock.mockClear();
	});

	it("calls embed then store.search with companyId, then enriches via nodes lookup", async () => {
		// Monkey-patch the internal nodes lookup by spying on enrichAndFilter's
		// db path. We assert the pipeline shape: embed -> search -> enrich.
		const ctxs = await retrieveContexts("companyA", "who knows the filler?", {
			lookupNodes: nodesSelectMock,
		});

		expect(embedMock).toHaveBeenCalledWith("who knows the filler?");
		expect(searchMock).toHaveBeenCalled();
		// Only companyA nodes survive the tenant filter
		expect(ctxs).toHaveLength(1);
		expect(ctxs[0].nodeId).toBe("n-filler");
		expect(ctxs[0].nodeName).toBe("Filler");
		expect(ctxs[0].nodeType).toBe("Knowledge");
		expect(ctxs[0].relevance).toBeCloseTo(0.91, 5);
		expect(typeof ctxs[0].content).toBe("string");
		expect(ctxs[0].content.length).toBeGreaterThan(0);
	});

	it("drops cross-tenant results (companyB nodeId filtered out for companyA caller)", async () => {
		const ctxs = await retrieveContexts("companyA", "question", {
			lookupNodes: nodesSelectMock,
		});
		const ids = ctxs.map((c) => c.nodeId);
		expect(ids).not.toContain("n-pedro");
		expect(ids).toContain("n-filler");
	});

	it("returns empty array when search yields no results", async () => {
		searchMock.mockResolvedValueOnce([]);
		const ctxs = await retrieveContexts("companyA", "q", {
			lookupNodes: nodesSelectMock,
		});
		expect(ctxs).toEqual([]);
	});
});

describe("enrichAndFilter", () => {
	it("attaches nodeName/nodeType and drops results whose company_id mismatches", async () => {
		const results = [
			{ id: "n-filler", score: 0.9, metadata: {} },
			{ id: "n-pedro", score: 0.7, metadata: {} },
		];
		const out = await enrichAndFilter(results, "companyA", {
			lookupNodes: nodesSelectMock,
			allNodes: [],
			allEdges: [],
		});
		expect(out).toHaveLength(1);
		expect(out[0].nodeId).toBe("n-filler");
		expect(out[0].nodeName).toBe("Filler");
	});
});
