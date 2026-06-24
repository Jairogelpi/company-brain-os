import {
	canConnect,
	isEdgeType,
	type EdgeType,
	type GraphEdge,
	type GraphNode,
	type KnowledgeNode,
	type NodeType,
} from "@/domain/graph";
import type { GraphOperationProposal } from "@/domain/interview";
import { geminiGenerate, type GeminiConfig } from "./gemini";

/**
 * Gemini-powered extraction: free text → validated graph proposals.
 *
 * Far richer than the heuristic ingestText — it pulls people, knowledge,
 * processes, clients, suppliers, systems, projects, risks AND the relationships
 * between them. Everything is validated against the domain (node types,
 * knowledge defaults, canConnect endpoint rules) and de-duplicated against the
 * existing graph, so the output is always safe to feed the review queue.
 */

export type ExistingNode = { id: string; name: string; type: NodeType };

const CATEGORY_TYPE: Record<string, NodeType> = {
	people: "Person",
	knowledge: "Knowledge",
	processes: "Process",
	assets: "Asset",
	units: "Unit",
	risks: "Risk",
	clients: "Client",
	suppliers: "Supplier",
	projects: "Project",
	systems: "System",
	documents: "Document",
};

function slug(s: string): string {
	return (
		s
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 48) || "node"
	);
}

function buildPrompt(text: string, existing: ExistingNode[]): string {
	const existingByType = new Map<string, string[]>();
	for (const n of existing) {
		const l = existingByType.get(n.type) ?? [];
		if (l.length < 30) l.push(n.name);
		existingByType.set(n.type, l);
	}
	const existingSummary =
		[...existingByType.entries()]
			.map(([t, names]) => `- ${t}: ${names.join(", ")}`)
			.join("\n") || "(grafo vacío)";

	return `Eres un extractor de grafos de conocimiento empresarial. Lees texto en español y devuelves SOLO un objeto JSON (sin markdown, sin explicaciones).

NODOS YA EXISTENTES (reutiliza estos nombres EXACTOS si la persona/cosa ya está; no los dupliques):
${existingSummary}

Esquema de salida (todas las claves opcionales, omite las vacías):
{
  "people": ["Nombre"],
  "knowledge": [{"name": "...", "critical": true|false, "documented": true|false}],
  "processes": [{"name": "...", "critical": true|false}],
  "clients": ["..."],
  "suppliers": ["..."],
  "systems": ["..."],
  "projects": ["..."],
  "documents": ["Nombre de un manual/SOP/PDF/doc"],
  "relationships": [{"from": "Nombre exacto", "type": "TIPO", "to": "Nombre exacto"}]
}

Tipos de relación válidos y sus extremos (USA SOLO ESTOS):
- MASTERS: Person → Knowledge (domina)
- LEARNS: Person → Knowledge (está aprendiendo)
- EXECUTES: Person → Process
- REQUIRES: Process → Knowledge | Process → System | Project → Knowledge | Project → System
- PRODUCES: Process → Asset | Project → Asset
- BELONGS_TO: Person|Process|Project|System → Unit
- BACKS_UP: Person → Person (es el backup/sustituto de)
- OWNS: Person → Client | Person → Supplier (lleva la relación con ese cliente/proveedor)
- MANAGES: Person → Project | Person → Unit (gestiona/lidera)
- ADMINISTERS: Person → System (sabe administrar/configurar el sistema)
- DOCUMENTS: Document → Knowledge | Document → Process (este documento documenta eso)
- DEPENDS_ON: cualquiera → cualquiera (solo si ninguna de las anteriores encaja)

IMPORTANTE: clasifica un sistema/herramienta (ERP, CRM, software, hoja de cálculo) como "systems", no como "knowledge". Para "X lleva la relación con el cliente Y" usa OWNS. Para "Z es el backup de W" usa BACKS_UP.

Reglas:
- "from" y "to" deben ser nombres que aparezcan en algún array de nodos (existentes o nuevos).
- Si alguien es el único que sabe algo, igualmente crea MASTERS; el riesgo se calcula aparte.
- No inventes nombres que no estén en el texto.

TEXTO:
"""
${text}
"""

JSON:`;
}

type RawJson = {
	people?: string[];
	knowledge?: Array<{ name?: string; critical?: boolean; documented?: boolean }>;
	processes?: Array<{ name?: string; critical?: boolean }>;
	clients?: string[];
	suppliers?: string[];
	systems?: string[];
	projects?: string[];
	documents?: string[];
	relationships?: Array<{ from?: string; type?: string; to?: string }>;
};

function parseJson(raw: string): RawJson | null {
	const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
	const start = cleaned.indexOf("{");
	const end = cleaned.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) return null;
	try {
		return JSON.parse(cleaned.slice(start, end + 1)) as RawJson;
	} catch {
		return null;
	}
}

function knowledgeNode(
	id: string,
	name: string,
	critical: boolean,
	documented: boolean,
): KnowledgeNode {
	return {
		id,
		type: "Knowledge",
		name,
		knowledgeType: "technical",
		documented,
		validationState: "proposed",
		confidence: documented ? 60 : 25,
		criticality: critical ? "high" : "medium",
	};
}

export async function extractGraphProposals(
	text: string,
	existing: ExistingNode[],
	config: GeminiConfig,
): Promise<{ proposals: GraphOperationProposal[]; summary: string }> {
	const raw = await geminiGenerate(buildPrompt(text, existing), config, {
		temperature: 0.2,
		maxOutputTokens: 2048,
	});
	const data = parseJson(raw);
	if (!data) return { proposals: [], summary: "No se pudo interpretar la respuesta." };

	// name(lower) → { id, type } resolver, seeded with existing nodes.
	const resolve = new Map<string, { id: string; type: NodeType }>();
	for (const n of existing) resolve.set(n.name.trim().toLowerCase(), { id: n.id, type: n.type });
	const existingIds = new Set(existing.map((n) => n.id));

	const nodeProposals: GraphOperationProposal[] = [];

	function ensureNode(
		name: string,
		type: NodeType,
		make: (id: string) => GraphNode | KnowledgeNode,
	): void {
		const key = name.trim().toLowerCase();
		if (!key) return;
		if (resolve.has(key)) return; // already known (existing or added this batch)
		const id = `${type.toLowerCase()}-${slug(name)}`;
		resolve.set(key, { id, type });
		if (existingIds.has(id)) return; // dedupe by id too
		nodeProposals.push({
			type: "create_node",
			node: make(id),
			reason: "Extraído por IA del texto de captura.",
		});
	}

	// Plain-name categories.
	for (const [cat, names] of Object.entries({
		people: data.people,
		clients: data.clients,
		suppliers: data.suppliers,
		systems: data.systems,
		projects: data.projects,
		documents: data.documents,
	})) {
		const type = CATEGORY_TYPE[cat];
		for (const name of names ?? []) {
			if (typeof name === "string" && name.trim()) {
				ensureNode(name, type, (id) => ({ id, type, name: name.trim() }));
			}
		}
	}
	// Knowledge (with attributes).
	for (const k of data.knowledge ?? []) {
		if (k?.name?.trim()) {
			const name = k.name.trim();
			ensureNode(name, "Knowledge", (id) =>
				knowledgeNode(id, name, k.critical === true, k.documented === true),
			);
		}
	}
	// Processes (with criticality).
	for (const p of data.processes ?? []) {
		if (p?.name?.trim()) {
			const name = p.name.trim();
			ensureNode(name, "Process", (id) => ({
				id,
				type: "Process",
				name,
				criticality: p.critical === true ? "high" : "medium",
			}));
		}
	}

	// Relationships — only those that resolve to known nodes AND pass canConnect.
	const edgeProposals: GraphOperationProposal[] = [];
	const seenEdges = new Set<string>();
	for (const r of data.relationships ?? []) {
		const type = (r?.type ?? "").toUpperCase();
		if (!isEdgeType(type)) continue;
		const from = resolve.get((r.from ?? "").trim().toLowerCase());
		const to = resolve.get((r.to ?? "").trim().toLowerCase());
		if (!from || !to || from.id === to.id) continue;
		if (!canConnect(type as EdgeType, from.type, to.type)) continue;
		const id = `edge-${type.toLowerCase()}-${from.id}-${to.id}`;
		if (seenEdges.has(id)) continue;
		seenEdges.add(id);
		const edge: GraphEdge = { id, type: type as EdgeType, fromNodeId: from.id, toNodeId: to.id };
		edgeProposals.push({
			type: "create_edge",
			edge,
			reason: "Relación extraída por IA.",
		});
	}

	// Nodes before edges so a batch approval applies cleanly.
	const proposals = [...nodeProposals, ...edgeProposals];
	const summary = `${nodeProposals.length} nodo(s) y ${edgeProposals.length} relación(es) extraídos por IA.`;
	return { proposals, summary };
}
