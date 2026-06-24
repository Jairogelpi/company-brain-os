import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import { getGeminiConfig, geminiGenerate } from "@/ai/gemini";
import type { GraphEdge, GraphNode, KnowledgeNode } from "@/domain/graph";

/** A compact, LLM-friendly snapshot of what the company graph already knows. */
function summarizeGraph(nodes: GraphNode[], edges: GraphEdge[]): string {
	if (nodes.length === 0) return "(El grafo está vacío todavía.)";
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const byType = new Map<string, string[]>();
	for (const n of nodes) {
		const list = byType.get(n.type) ?? [];
		if (list.length < 20) list.push(n.name);
		byType.set(n.type, list);
	}
	const lines: string[] = [];
	for (const [type, names] of byType) {
		lines.push(`- ${type} (${names.length}): ${names.join(", ")}`);
	}

	// Highlight knowledge-risk signals.
	const critical = nodes
		.filter(
			(n) =>
				n.type === "Knowledge" &&
				(n.criticality === "high" || (n as KnowledgeNode).documented === false),
		)
		.slice(0, 10)
		.map((n) => {
			const masters = edges.filter(
				(e) => e.type === "MASTERS" && e.toNodeId === n.id,
			).length;
			const k = n as KnowledgeNode;
			return `  · "${n.name}"${k.criticality === "high" ? " [crítico]" : ""}${k.documented === false ? " [sin documentar]" : ""} — ${masters} experto(s)`;
		});

	const rel = edges
		.slice(0, 25)
		.map((e) => {
			const a = byId.get(e.fromNodeId)?.name ?? "?";
			const b = byId.get(e.toNodeId)?.name ?? "?";
			return `  · ${a} —${e.type}→ ${b}`;
		});

	if (critical.length) lines.push(`Conocimiento en riesgo:\n${critical.join("\n")}`);
	if (rel.length) lines.push(`Relaciones:\n${rel.join("\n")}`);
	return lines.join("\n");
}

/**
 * POST /api/interview/ai-question — generate ONE adaptive, company-specific
 * interview question grounded in the current graph. Returns { question } or
 * { question: null } when Gemini isn't configured or fails (caller falls back
 * to the fixed bank).
 *
 * Body: { history?: { q: string; a: string }[] }.
 */
export async function POST(request: Request) {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;

	const cfg = getGeminiConfig();
	if (!cfg) return NextResponse.json({ question: null });

	let body: { history?: { q: string; a: string }[] };
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

	const service = getGraphService(user.companyId, user.id);
	const [nodes, edges] = await Promise.all([
		service.listNodes(),
		service.listEdges(),
	]);

	const prompt = `Eres un consultor experto en riesgo de conocimiento y dependencia de personas en empresas. Estás haciendo una entrevista para mapear el "cerebro" de ESTA empresa concreta.

MAPA ACTUAL DE LA EMPRESA:
${summarizeGraph(nodes, edges)}

ÚLTIMAS RESPUESTAS DE LA ENTREVISTA:
${history.length ? history.map((h) => `P: ${h.q}\nR: ${h.a}`).join("\n") : "(ninguna todavía)"}

Genera UNA sola pregunta de seguimiento, en español, concreta y ESPECÍFICA de esta empresa (usa nombres reales de personas, conocimientos, procesos, clientes, proveedores o sistemas que aparecen arriba). El objetivo es descubrir un riesgo o un hueco de conocimiento todavía no cubierto: dependencias de una sola persona, conocimiento sin documentar, sustitutos que faltan, proveedores críticos, etc. No repitas preguntas ya hechas. No expliques nada. Devuelve solo la pregunta.`;

	try {
		const raw = await geminiGenerate(prompt, cfg, {
			temperature: 0.8,
			maxOutputTokens: 120,
		});
		// Keep only the first line/question, strip surrounding quotes.
		const question = raw
			.split("\n")
			.map((l) => l.trim())
			.find((l) => l.length > 0)
			?.replace(/^["“]|["”]$/g, "")
			.trim();
		return NextResponse.json({ question: question || null });
	} catch {
		return NextResponse.json({ question: null });
	}
}
