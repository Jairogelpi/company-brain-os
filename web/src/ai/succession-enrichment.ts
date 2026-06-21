import type { LlmConfig } from "./client";
import { chatCompletion, getLlmConfig } from "./client";
import type { GraphEdge, GraphNode } from "@/domain/graph";
import type { Playbook, PlaybookAction } from "@/domain/succession";

export interface EnrichmentConfig {
	llm?: LlmConfig;
	signal?: AbortSignal;
}

type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

type ParsedAction = {
	knowledgeId: string;
	detailedSteps: string[];
	rationale: string;
	riskNote?: string;
	suggestedTrainerName?: string;
};

type Candidate = { id: string; name: string; knowledgeId: string };

const SYSTEM_PROMPT = `You enrich deterministic succession playbooks. Return raw JSON only: {"actions":[{"knowledgeId":"...","detailedSteps":["..."],"suggestedTrainerName":"...","rationale":"...","riskNote":"..."}]}. Never reorder actions. Never invent ids.`;

function candidateTrainers(graph: Graph, personId: string): Candidate[] {
	return graph.edges
		.filter(
			(e) =>
				e.type === "MASTERS" &&
				e.fromNodeId !== personId &&
				Number(e.attributes?.level ?? 0) >= 3,
		)
		.map((e) => {
			const person = graph.nodes.find(
				(n) => n.id === e.fromNodeId && n.type === "Person",
			);
			if (!person) return null;
			return { id: person.id, name: person.name, knowledgeId: e.toNodeId };
		})
		.filter((c): c is Candidate => c !== null);
}

function buildPrompt(playbook: Playbook, graph: Graph): string {
	const person = graph.nodes.find((n) => n.id === playbook.personId);
	const knowledgeIds = new Set(playbook.actions.map((a) => a.knowledgeId));
	const candidates = candidateTrainers(graph, playbook.personId).filter((c) =>
		knowledgeIds.has(c.knowledgeId),
	);
	const actionLines = playbook.actions
		.map((a) => {
			const trainers = candidates
				.filter((c) => c.knowledgeId === a.knowledgeId)
				.map((c) => c.name)
				.join(", ");
			return `- ${a.knowledgeId}: ${a.knowledgeName}; action=${a.action}; criticality=${a.criticality}; busFactor=${a.busFactor}; documented=${a.documented}; candidateTrainers=${trainers || "none"}`;
		})
		.join("\n");
	return `Departing person: ${person?.name ?? playbook.personName} (${playbook.personId})\nActions:\n${actionLines}`;
}

function extractJson(content: string): unknown | null {
	const match = content.match(/\{[\s\S]*"actions"[\s\S]*\}/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]);
	} catch {
		return null;
	}
}

function parseActions(content: string): Map<string, ParsedAction> | null {
	const parsed = extractJson(content) as { actions?: unknown } | null;
	if (!parsed || !Array.isArray(parsed.actions)) return null;
	const out = new Map<string, ParsedAction>();
	for (const raw of parsed.actions) {
		const item = raw as Record<string, unknown>;
		const knowledgeId = item.knowledgeId;
		const detailedSteps = item.detailedSteps;
		const rationale = item.rationale;
		if (
			typeof knowledgeId !== "string" ||
			!Array.isArray(detailedSteps) ||
			!detailedSteps.every((s) => typeof s === "string") ||
			typeof rationale !== "string" ||
			rationale.trim() === ""
		) {
			continue;
		}
		out.set(knowledgeId, {
			knowledgeId,
			detailedSteps: detailedSteps.filter((s) => s.trim().length > 0),
			rationale,
			riskNote:
				typeof item.riskNote === "string" && item.riskNote.trim()
					? item.riskNote
					: undefined,
			suggestedTrainerName:
				typeof item.suggestedTrainerName === "string" &&
				item.suggestedTrainerName.trim()
					? item.suggestedTrainerName.trim()
					: undefined,
		});
	}
	return out;
}

function groundTrainer(
	knowledgeId: string,
	name: string | undefined,
	candidates: Candidate[],
): Candidate | null {
	if (!name) return null;
	const lower = name.toLowerCase();
	const matches = candidates.filter(
		(c) => c.knowledgeId === knowledgeId && c.name.toLowerCase() === lower,
	);
	return matches.length === 1 ? matches[0] : null;
}

function mergeEnrichment(
	playbook: Playbook,
	parsed: Map<string, ParsedAction>,
	graph: Graph,
): Playbook {
	const candidates = candidateTrainers(graph, playbook.personId);
	const actions: PlaybookAction[] = playbook.actions.map((action) => {
		const enrichment = parsed.get(action.knowledgeId);
		if (!enrichment) return { ...action };
		const trainer = groundTrainer(
			action.knowledgeId,
			enrichment.suggestedTrainerName,
			candidates,
		);
		return {
			...action,
			detailedSteps: enrichment.detailedSteps,
			rationale: enrichment.rationale,
			...(enrichment.riskNote ? { riskNote: enrichment.riskNote } : {}),
			...(trainer
				? {
						suggestedTrainerId: trainer.id,
						suggestedTrainerName: trainer.name,
					}
				: {}),
		};
	});
	return { ...playbook, actions };
}

export async function enrichPlaybookWithLLM(
	playbook: Playbook,
	graph: Graph,
	config: EnrichmentConfig = {},
): Promise<Playbook> {
	const cfg = config.llm ?? getLlmConfig();
	if (!cfg || playbook.actions.length === 0) return playbook;

	try {
		const content = await chatCompletion(
			[
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: buildPrompt(playbook, graph) },
			],
			cfg,
		);
		const parsed = parseActions(content);
		if (!parsed) return playbook;
		return mergeEnrichment(playbook, parsed, graph);
	} catch {
		return playbook;
	}
}
