import type { GraphNode, GraphEdge, KnowledgeNode } from "@/domain/graph";
import {
	computeBusFactors,
	computeConfidences,
	computeCoverage,
	computeDependencies,
	computeResilience,
	computeAllMetrics,
} from "@/domain/metrics";
import { detectAllRisks, type RiskReport } from "@/domain/risk-engine";
import {
	chatCompletion,
	getLlmConfig,
	configureLlm,
	type LlmConfig,
} from "./client";

// --- Consultant types ---

export type RecommendationType =
	| "document"
	| "train"
	| "hire"
	| "validate"
	| "monitor";

export interface ConsultantRecommendation {
	id: string;
	type: RecommendationType;
	priority: "critical" | "high" | "medium" | "low";
	targetNodeId: string;
	targetNodeName: string;
	message: string;
	rationale: string;
	roiHint: string;
}

export interface ConsultantReport {
	recommendations: ConsultantRecommendation[];
	summary: string;
	generatedAt: string;
	modelUsed: string;
}

// --- Heuristic recommender (fallback when LLM unavailable) ---

function generateHeuristicRecommendations(
	nodes: GraphNode[],
	edges: GraphEdge[],
	risks: RiskReport,
): ConsultantRecommendation[] {
	const busFactors = computeBusFactors(nodes, edges);
	const dependencies = computeDependencies(nodes, edges);
	const knowledgeNodes = nodes.filter(
		(n) => n.type === "Knowledge",
	) as KnowledgeNode[];
	const recommendations: ConsultantRecommendation[] = [];
	let nextId = 1;

	// 1. Document: critical knowledge, bus factor 1, undocumented
	for (const bf of busFactors) {
		if (
			bf.busFactor === 1 &&
			bf.criticality === "high" &&
			bf.documented === false
		) {
			recommendations.push({
				id: `rec-${nextId++}`,
				type: "document",
				priority: "critical",
				targetNodeId: bf.knowledgeId,
				targetNodeName: bf.knowledgeName,
				message: `Document "${bf.knowledgeName}" immediately — 1 expert, no written reference.`,
				rationale: `Bus factor 1, undocumented, critical. Single point of failure.`,
				roiHint: `Prevents operational halt if ${bf.expertIds.map((id) => nodes.find((n) => n.id === id)?.name).join(", ")} is unavailable.`,
			});
		}
	}

	// 2. Train: knowledge with a LEARNS edge close to level 3
	const learnsEdges = edges.filter((e) => e.type === "LEARNS");
	for (const le of learnsEdges) {
		const level = (le.attributes?.level as number) ?? 0;
		if (level >= 2 && level < 3) {
			const knowledge = knowledgeNodes.find((k) => k.id === le.toNodeId);
			const person = nodes.find((n) => n.id === le.fromNodeId);
			if (knowledge && person) {
				recommendations.push({
					id: `rec-${nextId++}`,
					type: "train",
					priority: "high",
					targetNodeId: knowledge.id,
					targetNodeName: knowledge.name,
					message: `Train ${person.name} on "${knowledge.name}" — close to level 3.`,
					rationale: `${person.name} is at level ${level}/5. One push to reach expert level.`,
					roiHint: `Smallest investment for bus factor increase on "${knowledge.name}".`,
				});
			}
		}
	}

	// 3. Hire/validate: person with high dependency score
	for (const dep of dependencies) {
		if (dep.dependencyScore >= 2) {
			recommendations.push({
				id: `rec-${nextId++}`,
				type: "hire",
				priority: "high",
				targetNodeId: dep.personId,
				targetNodeName: dep.personName,
				message: `${dep.personName} is a single point of failure for ${dep.dependencyScore} areas — spread knowledge or hire backup.`,
				rationale: `Dependency score ${dep.dependencyScore}. If ${dep.personName} leaves, ${dep.dependencyScore} critical areas lose their sole expert.`,
				roiHint: `Reduces organizational fragility across ${dep.dependencyScore} knowledge areas.`,
			});
		}
	}

	// 4. Validate: proposed knowledge that's been stale
	for (const k of knowledgeNodes) {
		if (k.validationState === "proposed" || k.validationState === "draft") {
			recommendations.push({
				id: `rec-${nextId++}`,
				type: "validate",
				priority: k.criticality === "high" ? "high" : "medium",
				targetNodeId: k.id,
				targetNodeName: k.name,
				message: `Validate "${k.name}" — currently ${k.validationState}, confidence ${k.confidence ?? "?"}%.`,
				rationale: `Knowledge validation increases confidence and organizational IQ.`,
				roiHint: `Improves Company IQ metric and risk accuracy.`,
			});
		}
	}

	// Sort by priority
	const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
	recommendations.sort(
		(a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
	);

	return recommendations.slice(0, 10);
}

function generateHeuristicSummary(
	recommendations: ConsultantRecommendation[],
): string {
	const byType: Record<string, number> = {};
	for (const r of recommendations) {
		byType[r.type] = (byType[r.type] ?? 0) + 1;
	}

	const parts: string[] = [];
	if (byType.document) parts.push(`${byType.document} documentation task(s)`);
	if (byType.train) parts.push(`${byType.train} training opportunity(ies)`);
	if (byType.hire) parts.push(`${byType.hire} hiring/backup concern(s)`);
	if (byType.validate) parts.push(`${byType.validate} validation task(s)`);

	const criticals = recommendations.filter(
		(r) => r.priority === "critical",
	).length;

	return `AI Consultant analyzed the graph and found ${recommendations.length} recommendations (${criticals} critical). Priorities: ${parts.join(", ") || "none"}. Start with the critical documentation tasks to immediately reduce single points of failure.`;
}

// --- LLM-powered consultant ---

const CONSULTANT_SYSTEM_PROMPT = `You are an AI Organizational Consultant for Company Brain OS. You analyze a company's knowledge graph and produce actionable recommendations.

You receive: a list of knowledge nodes with bus factors, confidence scores, and documentation status; a list of people with dependency scores; a list of detected risks; and process resilience data.

Return a JSON object with:
- "recommendations": array of objects with:
  - "type": one of "document", "train", "hire", "validate", "monitor"
  - "priority": "critical", "high", "medium", or "low"
  - "targetNodeName": string — name of the knowledge/person/process
  - "message": string — actionable one-sentence recommendation
  - "rationale": string — why this matters (data-backed)
  - "roiHint": string — what value this generates
- "summary": string — a 2-3 sentence executive summary of the organizational state

Prioritize: undocumented critical knowledge > single points of failure > training gaps > validation debt.

Return raw JSON only. No markdown. No reasoning.`;

async function generateLlmRecommendations(
	nodes: GraphNode[],
	edges: GraphEdge[],
	config?: LlmConfig,
): Promise<{
	recommendations: ConsultantRecommendation[];
	summary: string;
} | null> {
	const cfg = config ?? getLlmConfig();
	if (!cfg) return null;

	const metrics = computeAllMetrics(nodes, edges);
	const risks = detectAllRisks(nodes, edges);

	// Build a compact data payload for the LLM
	const knowledgeLines = metrics.busFactors
		.map((bf) => {
			const conf = metrics.confidences.find(
				(c) => c.knowledgeId === bf.knowledgeId,
			);
			return `- "${bf.knowledgeName}": bus_factor=${bf.busFactor}, criticality=${bf.criticality}, documented=${bf.documented}, confidence=${conf?.confidence ?? "?"}%`;
		})
		.join("\n");

	const peopleLines = metrics.dependencies
		.map(
			(d) =>
				`- ${d.personName}: dependency_score=${d.dependencyScore}, sole expert of [${d.criticalNodes.join(", ")}]`,
		)
		.join("\n");

	const riskLines = risks.risks
		.slice(0, 5)
		.map((r) => `- [${r.severity}] ${r.riskType}: ${r.message}`)
		.join("\n");

	const prompt = `Knowledge graph state:
${knowledgeLines}

People dependencies:
${peopleLines}

Top risks:
${riskLines}

Generate recommendations:`;

	try {
		const content = await chatCompletion(
			[
				{ role: "system", content: CONSULTANT_SYSTEM_PROMPT },
				{ role: "user", content: prompt },
			],
			cfg,
		);

		// Parse JSON from response (handle possible reasoning prefix)
		const jsonMatch = content.match(/\{[\s\S]*"recommendations"[\s\S]*\}/);
		if (!jsonMatch) throw new Error("No JSON found in LLM response");
		const parsed = JSON.parse(jsonMatch[0]);

		return {
			recommendations: (parsed.recommendations ?? []).map(
				(r: Record<string, unknown>, i: number) => ({
					id: `rec-llm-${i + 1}`,
					type: (r.type as RecommendationType) ?? "monitor",
					priority:
						(r.priority as ConsultantRecommendation["priority"]) ?? "medium",
					targetNodeId: "",
					targetNodeName: (r.targetNodeName as string) ?? "",
					message: (r.message as string) ?? "",
					rationale: (r.rationale as string) ?? "",
					roiHint: (r.roiHint as string) ?? "",
				}),
			),
			summary: (parsed.summary as string) ?? "",
		};
	} catch {
		return null; // Fall back to heuristic
	}
}

// --- Public API ---

export async function runConsultant(
	nodes: GraphNode[],
	edges: GraphEdge[],
	config?: LlmConfig,
): Promise<ConsultantReport> {
	const risks = detectAllRisks(nodes, edges);
	const cfg = config ?? getLlmConfig();

	// Try LLM first, fall back to heuristic
	let recommendations: ConsultantRecommendation[];
	let summary: string;
	let modelUsed = "heuristic";

	if (cfg) {
		const llmResult = await generateLlmRecommendations(nodes, edges, cfg);
		if (llmResult) {
			recommendations = llmResult.recommendations;
			summary = llmResult.summary;
			modelUsed = cfg.model ?? "llm";
		} else {
			recommendations = generateHeuristicRecommendations(nodes, edges, risks);
			summary = generateHeuristicSummary(recommendations);
		}
	} else {
		recommendations = generateHeuristicRecommendations(nodes, edges, risks);
		summary = generateHeuristicSummary(recommendations);
	}

	return {
		recommendations,
		summary,
		generatedAt: new Date().toISOString(),
		modelUsed,
	};
}
