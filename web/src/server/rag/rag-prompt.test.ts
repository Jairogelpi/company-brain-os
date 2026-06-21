import { describe, expect, it } from "vitest";
import { buildRagPrompt, type RetrievedContext } from "./rag-prompt";

const contexts: RetrievedContext[] = [
	{
		nodeId: "k-filler",
		nodeName: "configurar llenadora",
		nodeType: "Knowledge",
		relevance: 0.91,
		content: "configurar llenadora. Knowledge. bus factor 1. no documentado",
	},
	{
		nodeId: "pedro",
		nodeName: "Pedro",
		nodeType: "Person",
		relevance: 0.74,
		content: "Pedro. Person. MASTERS configurar llenadora",
	},
	{
		nodeId: "k-safety",
		nodeName: "protocolo de seguridad",
		nodeType: "Knowledge",
		relevance: 0.42,
		content: "protocolo de seguridad. Knowledge. documentado",
	},
];

describe("buildRagPrompt", () => {
	it("returns a system + user message pair (length 2)", () => {
		const msgs = buildRagPrompt("Who knows the filler config?", contexts);
		expect(msgs).toHaveLength(2);
		expect(msgs[0].role).toBe("system");
		expect(msgs[1].role).toBe("user");
	});

	it("injects each context's nodeName, nodeType, relevance, and content into the user message", () => {
		const msgs = buildRagPrompt("Who knows the filler config?", contexts);
		const user = msgs[1].content;
		for (const c of contexts) {
			expect(user).toContain(c.nodeName);
			expect(user).toContain(c.nodeType);
			expect(user).toContain(c.content);
		}
		// relevance rendered as rounded percent
		expect(user).toContain("91%");
		expect(user).toContain("74%");
		expect(user).toContain("42%");
	});

	it("system message contains the grounding-only instruction", () => {
		const msgs = buildRagPrompt("Who knows the filler config?", contexts);
		const sys = msgs[0].content;
		expect(sys.toLowerCase()).toContain("answer only");
		expect(sys.toLowerCase()).toContain("do not invent");
		expect(sys.toLowerCase()).toContain("source");
		expect(sys.toLowerCase()).toContain("i don't have enough context");
	});

	it("without lowConfidence, the system message does not mention low confidence", () => {
		const msgs = buildRagPrompt("Who knows the filler config?", contexts);
		expect(msgs[0].content.toLowerCase()).not.toContain("low confidence");
	});

	it("with lowConfidence=true, the system message instructs low confidence", () => {
		const msgs = buildRagPrompt("???", contexts, { lowConfidence: true });
		expect(msgs[0].content.toLowerCase()).toContain("low confidence");
	});

	it("is pure: calling twice with the same fixtures yields deep-equal outputs", () => {
		const a = buildRagPrompt("Q", contexts);
		const b = buildRagPrompt("Q", contexts);
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	it("does not throw and returns messages with no side effects (no fetch/console/Date)", () => {
		const originalFetch = globalThis.fetch;
		const originalWarn = console.warn;
		globalThis.fetch = () => {
			throw new Error("fetch should not be called");
		};
		console.warn = () => {
			throw new Error("console.warn should not be called");
		};
		try {
			const msgs = buildRagPrompt("Q", contexts);
			expect(msgs).toHaveLength(2);
		} finally {
			globalThis.fetch = originalFetch;
			console.warn = originalWarn;
		}
	});
});
