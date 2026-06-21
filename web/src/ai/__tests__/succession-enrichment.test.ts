import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphEdge, GraphNode, KnowledgeNode } from "@/domain/graph";
import { generatePlaybook } from "@/domain/succession";

const chatCompletionMock = vi.fn();
const getLlmConfigMock = vi.fn();

vi.mock("@/ai/client", () => ({
	chatCompletion: chatCompletionMock,
	getLlmConfig: getLlmConfigMock,
}));

const { enrichPlaybookWithLLM } = await import("../succession-enrichment");

const pedro: GraphNode = { id: "person-pedro", type: "Person", name: "Pedro" };
const ada: GraphNode = { id: "person-ada", type: "Person", name: "Ada" };

function knowledge(id: string, name: string): KnowledgeNode {
	return {
		id,
		type: "Knowledge",
		name,
		criticality: "high",
		documented: false,
		knowledgeType: "technical",
		validationState: "proposed",
		confidence: 30,
	};
}

function masters(person: string, k: string, level = 5): GraphEdge {
	return {
		id: `e-${person}-${k}`,
		type: "MASTERS",
		fromNodeId: person,
		toNodeId: k,
		attributes: { level },
	};
}

function graph(extraNodes: GraphNode[] = [], extraEdges: GraphEdge[] = []) {
	const kCrit = knowledge("k-crit", "Filler setup");
	const kSafety = knowledge("k-safety", "Safety checklist");
	return {
		nodes: [pedro, ada, kCrit, kSafety, ...extraNodes],
		edges: [
			masters("person-pedro", "k-crit"),
			masters("person-pedro", "k-safety"),
			masters("person-ada", "k-crit", 3),
			...extraEdges,
		],
	};
}

function playbook(g = graph()) {
	return generatePlaybook("person-pedro", g);
}

function response(actions: unknown[]): string {
	return JSON.stringify({ actions });
}

describe("enrichPlaybookWithLLM", () => {
	beforeEach(() => {
		chatCompletionMock.mockReset();
		getLlmConfigMock.mockReset().mockReturnValue({ apiKey: "x", model: "stub" });
	});

	it("enriches actions while preserving deterministic heuristic fields", async () => {
		const g = graph();
		const pb = playbook(g);
		chatCompletionMock.mockResolvedValue(
			response([
				{
					knowledgeId: "k-crit",
					detailedSteps: ["step A", "step B"],
					suggestedTrainerName: "Ada",
					rationale: "critical and undocumented",
					riskNote: "single expert risk",
				},
			]),
		);

		const enriched = await enrichPlaybookWithLLM(pb, g);
		const action = enriched.actions.find((a) => a.knowledgeId === "k-crit")!;

		expect(action.detailedSteps).toEqual(["step A", "step B"]);
		expect(action.suggestedTrainerId).toBe("person-ada");
		expect(action.suggestedTrainerName).toBe("Ada");
		expect(action.rationale).toContain("critical");
		expect(action.riskNote).toContain("risk");
		expect(action.priorityScore).toBe(pb.actions.find((a) => a.knowledgeId === "k-crit")!.priorityScore);
		expect(action.action).toBe(pb.actions.find((a) => a.knowledgeId === "k-crit")!.action);
		expect(action.targetDate).toBe(pb.actions.find((a) => a.knowledgeId === "k-crit")!.targetDate);
	});

	it("returns the input unchanged when no LLM is configured", async () => {
		getLlmConfigMock.mockReturnValue(null);
		const pb = playbook();

		const enriched = await enrichPlaybookWithLLM(pb, graph());

		expect(enriched).toEqual(pb);
		expect(chatCompletionMock).not.toHaveBeenCalled();
	});

	it("falls back unchanged when the LLM rejects or returns malformed JSON", async () => {
		const pb = playbook();
		chatCompletionMock.mockRejectedValueOnce(new Error("network"));
		await expect(enrichPlaybookWithLLM(pb, graph(), { llm: { apiKey: "x" } })).resolves.toEqual(pb);

		chatCompletionMock.mockResolvedValueOnce("Sorry, no JSON here");
		await expect(enrichPlaybookWithLLM(pb, graph(), { llm: { apiKey: "x" } })).resolves.toEqual(pb);
	});

	it("keeps valid partial entries and skips malformed or missing actions", async () => {
		const g = graph();
		const pb = playbook(g);
		chatCompletionMock.mockResolvedValue(
			response([
				{ knowledgeId: "k-crit", detailedSteps: ["s1"], rationale: "r1" },
				{
					knowledgeId: "k-safety",
					detailedSteps: ["s2"],
					rationale: "r2",
					suggestedTrainerName: "Ada",
				},
				{ knowledgeId: "k-missing", detailedSteps: "bad", rationale: "bad" },
			]),
		);

		const enriched = await enrichPlaybookWithLLM(pb, g, { llm: { apiKey: "x" } });

		expect(enriched.actions.map((a) => a.knowledgeId)).toEqual(pb.actions.map((a) => a.knowledgeId));
		expect(enriched.actions.find((a) => a.knowledgeId === "k-crit")?.detailedSteps).toEqual(["s1"]);
		expect(enriched.actions.find((a) => a.knowledgeId === "k-safety")?.detailedSteps).toEqual(["s2"]);
	});

	it("drops ungrounded trainer names but keeps other enrichment", async () => {
		const g = graph();
		const pb = playbook(g);
		chatCompletionMock.mockResolvedValue(
			response([
				{
					knowledgeId: "k-crit",
					detailedSteps: ["s"],
					suggestedTrainerName: "Ghost McNotreal",
					rationale: "r",
					riskNote: "risk",
				},
			]),
		);

		const action = (await enrichPlaybookWithLLM(pb, g, { llm: { apiKey: "x" } })).actions.find(
			(a) => a.knowledgeId === "k-crit",
		)!;

		expect(action.suggestedTrainerId).toBeUndefined();
		expect(action.suggestedTrainerName).toBeUndefined();
		expect(action.detailedSteps).toEqual(["s"]);
		expect(action.riskNote).toBe("risk");
	});

	it("builds a bounded prompt containing only relevant knowledge and trainers", async () => {
		const unrelated = Array.from({ length: 50 }, (_, i): GraphNode => ({
			id: `person-unrelated-${i}`,
			type: "Person",
			name: `Unrelated ${i}`,
		}));
		const g = graph(unrelated);
		chatCompletionMock.mockResolvedValue(response([]));

		await enrichPlaybookWithLLM(playbook(g), g, { llm: { apiKey: "x" } });

		const userPrompt = chatCompletionMock.mock.calls[0][0][1].content as string;
		expect(userPrompt).toContain("Pedro");
		expect(userPrompt).toContain("Filler setup");
		expect(userPrompt).toContain("Ada");
		expect(userPrompt).not.toContain("Unrelated 49");
		expect(userPrompt.split("\n").length).toBeLessThan(20);
	});

	it("is deterministic and ignores LLM response ordering", async () => {
		const g = graph();
		const pb = playbook(g);
		const reversed = response([
			{ knowledgeId: "k-safety", detailedSteps: ["b"], rationale: "rb" },
			{ knowledgeId: "k-crit", detailedSteps: ["a"], rationale: "ra" },
		]);
		chatCompletionMock.mockResolvedValue(reversed);

		const first = await enrichPlaybookWithLLM(pb, g, { llm: { apiKey: "x" } });
		const second = await enrichPlaybookWithLLM(pb, g, { llm: { apiKey: "x" } });

		expect(first).toEqual(second);
		expect(first.actions.map((a) => a.knowledgeId)).toEqual(pb.actions.map((a) => a.knowledgeId));
	});
});
