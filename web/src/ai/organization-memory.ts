import type { GraphNode, GraphEdge, KnowledgeNode } from "@/domain/graph";
import {
	computeBusFactors,
	computeConfidences,
	computeAllMetrics,
} from "@/domain/metrics";
import { detectAllRisks } from "@/domain/risk-engine";
import { VectorStore, simpleEmbed, type SearchResult } from "./vector-store";

// --- Organization Memory ---

export interface MemoryContext {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	content: string;
	busFactor?: number;
	confidence?: number;
	documented?: boolean;
	criticality?: string;
}

export interface MemoryQueryResult {
	answer: string;
	sources: Array<{
		nodeId: string;
		nodeName: string;
		nodeType: string;
		relevance: number;
	}>;
}

export class OrganizationMemory {
	private vectorStore: VectorStore;
	private nodeCache: Map<string, GraphNode> = new Map();
	private edgeCache: Map<string, GraphEdge> = new Map();

	constructor() {
		this.vectorStore = new VectorStore();
	}

	index(nodes: GraphNode[], edges: GraphEdge[]): void {
		const busFactors = computeBusFactors(nodes, edges);
		const confidences = computeConfidences(nodes, edges);

		this.nodeCache.clear();
		this.edgeCache.clear();
		for (const n of nodes) this.nodeCache.set(n.id, n);
		for (const e of edges) this.edgeCache.set(e.id, e);

		for (const node of nodes) {
			const bf = busFactors.find((b) => b.knowledgeId === node.id);
			const conf = confidences.find((c) => c.knowledgeId === node.id);

			const content = buildNodeContent(
				node,
				nodes,
				edges,
				bf?.busFactor,
				conf?.confidence,
				bf?.documented ?? undefined,
			);

			const vector = simpleEmbed(content);
			this.vectorStore.upsert(node.id, vector, {
				nodeName: node.name,
				nodeType: node.type,
				busFactor: bf?.busFactor,
				confidence: conf?.confidence,
				documented: bf?.documented ?? undefined,
				criticality: (node as { criticality?: string }).criticality,
			});
		}
	}

	search(query: string, topK: number = 5): SearchResult[] {
		const queryVector = simpleEmbed(query);
		return this.vectorStore.search(queryVector, topK);
	}

	async answer(question: string): Promise<MemoryQueryResult> {
		const results = this.search(question, 5);

		const sources = results.map((r) => ({
			nodeId: r.id,
			nodeName: (r.metadata.nodeName as string) ?? r.id,
			nodeType: (r.metadata.nodeType as string) ?? "unknown",
			relevance: r.score,
		}));

		const answer = this.buildAnswer(question, results);

		return { answer, sources };
	}

	private buildAnswer(question: string, results: SearchResult[]): string {
		const lowerQ = question.toLowerCase();
		const relevantNodes = results.filter((r) => r.score > 0.1);

		if (relevantNodes.length === 0) {
			return "No tengo información suficiente en la memoria organizacional. Intentá indexar primero el grafo.";
		}

		const topResult = relevantNodes[0];
		const meta = topResult.metadata;

		if (
			lowerQ.includes("quién") ||
			lowerQ.includes("quien") ||
			lowerQ.includes("persona")
		) {
			const expertNodes = relevantNodes.filter(
				(r) => r.metadata.nodeType === "Person",
			);
			if (expertNodes.length > 0) {
				return `${expertNodes[0].metadata.nodeName} es la persona más relevante.`;
			}
			if (meta.nodeType === "Knowledge") {
				const busFactor = meta.busFactor as number;
				if (busFactor === 0)
					return `"${meta.nodeName}" no tiene expertos — conocimiento potencialmente perdido.`;
				return `"${meta.nodeName}" tiene bus factor ${busFactor}. ${busFactor === 1 ? "Depende de una sola persona: alto riesgo." : "Está cubierto por varias personas."}`;
			}
		}

		if (
			lowerQ.includes("riesgo") ||
			lowerQ.includes("frágil") ||
			lowerQ.includes("fragil")
		) {
			const allNodes = [...this.nodeCache.values()];
			const allEdges = [...this.edgeCache.values()];
			const report = detectAllRisks(allNodes, allEdges);

			if (report.risks.length === 0)
				return "No se detectaron riesgos. La organización parece saludable.";

			const topRisks = report.risks.slice(0, 3);
			return [
				`**${report.summary.total} riesgos** (${report.summary.critical} críticos, ${report.summary.high} altos)`,
				"",
				...topRisks.map(
					(r) =>
						`- [${r.severity}] **${r.sourceNodeName}**: ${r.message.split(".")[0]}.`,
				),
			].join("\n");
		}

		if (lowerQ.includes("documenta") || lowerQ.includes("escrito")) {
			const documented = meta.documented as boolean;
			return documented
				? `"${meta.nodeName}" SÍ está documentado.`
				: `"${meta.nodeName}" NO está documentado — riesgo.`;
		}

		if (
			lowerQ.includes("métrico") ||
			lowerQ.includes("metric") ||
			lowerQ.includes("salud") ||
			lowerQ.includes("iq")
		) {
			const allNodes = [...this.nodeCache.values()];
			const allEdges = [...this.edgeCache.values()];
			const metrics = computeAllMetrics(allNodes, allEdges);
			return [
				`**Cobertura:** ${metrics.coverage.coveragePercent}% (${metrics.coverage.coveredCritical}/${metrics.coverage.totalCritical})`,
				`**Salud:** ${metrics.health.overallScore}/100`,
				`**Company IQ:** ${metrics.companyIQ.iq}%`,
				`**Riesgos abiertos:** ${metrics.health.openRiskCount}`,
			].join("\n");
		}

		if (
			lowerQ.includes("qué") ||
			lowerQ.includes("que") ||
			lowerQ.includes("como") ||
			lowerQ.includes("cómo")
		) {
			return `"${meta.nodeName}" es un nodo tipo ${meta.nodeType}. Bus factor: ${meta.busFactor ?? "?"}, confianza: ${meta.confidence ?? "?"}%, ${meta.documented ? "documentado." : "no documentado."}`;
		}

		const summary = relevantNodes
			.slice(0, 3)
			.map(
				(r) =>
					`- **${r.metadata.nodeName}** (${r.metadata.nodeType}): ${Math.round(r.score * 100)}%`,
			)
			.join("\n");
		return `Resultados más relevantes:\n${summary}`;
	}
}

function buildNodeContent(
	node: GraphNode,
	nodes: GraphNode[],
	edges: GraphEdge[],
	busFactor?: number,
	confidence?: number,
	documented?: boolean,
): string {
	const parts: string[] = [node.name, node.type];

	if (busFactor !== undefined) parts.push(`bus factor ${busFactor}`);
	if (confidence !== undefined) parts.push(`confianza ${confidence}%`);
	if (documented !== undefined) {
		parts.push(documented ? "documentado" : "no documentado");
	}

	const relatedEdges = edges.filter(
		(e) => e.fromNodeId === node.id || e.toNodeId === node.id,
	);
	for (const e of relatedEdges) {
		const otherId = e.fromNodeId === node.id ? e.toNodeId : e.fromNodeId;
		const other = nodes.find((n) => n.id === otherId);
		if (other) parts.push(`${e.type} ${other.name}`);
	}

	if (node.type === "Knowledge") {
		const k = node as KnowledgeNode;
		if (k.knowledgeType) parts.push(k.knowledgeType);
		if (k.validationState) parts.push(k.validationState);
	}

	return parts.join(". ");
}
