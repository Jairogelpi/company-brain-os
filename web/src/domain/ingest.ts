import type { GraphOperationProposal } from "./interview";
import { createInterviewSession, answerInterviewQuestion } from "./interview";
import type { GraphNode, GraphEdge } from "./graph";

/**
 * Zero-effort auto-map (passive capture, change #1).
 *
 * Turns data the company already has into reviewable graph proposals — never
 * writes. The structured mapper below ("upload your employee list") is the
 * day-one "llega hecho" path; a text mapper reuses the extraction engine.
 */

export interface EmployeeRow {
	name: string;
	role?: string;
	team?: string;
	manager?: string;
}

/** A proposal plus where it came from (provenance for the review inbox). */
export interface IngestedProposal {
	proposal: GraphOperationProposal;
	source: string;
}

export interface IngestResult {
	source: string;
	proposals: IngestedProposal[];
	summary: string;
}

export interface IngestOptions {
	source: string;
	/** Node ids already in the graph — skipped so re-runs don't duplicate. */
	existingNodeIds?: Set<string>;
}

function stableHash(value: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36).padStart(8, "0").slice(0, 8);
}

/** Accent-stripped, deterministic slug so ids are stable across re-runs. */
function slug(s: string): string {
	const normalized = s
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return normalized || stableHash(s);
}

/**
 * Parse an employee CSV into rows. Header-mapped; recognises name/role/team/
 * manager (case-insensitive). ponytail: naive comma split — no quoted-comma
 * support; upgrade to a CSV lib if employee names start containing commas.
 */
export function parseEmployeeCsv(csv: string): EmployeeRow[] {
	const lines = csv
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	if (lines.length === 0) return [];

	const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
	const col = (name: string) => headers.indexOf(name);
	const nameIdx = col("name");
	if (nameIdx === -1) {
		throw new Error("CSV must have a 'name' column.");
	}
	const roleIdx = col("role");
	const teamIdx = col("team");
	const managerIdx = col("manager");

	const rows: EmployeeRow[] = [];
	for (const line of lines.slice(1)) {
		const cells = line.split(",").map((c) => c.trim());
		const name = cells[nameIdx];
		if (!name) continue;
		const row: EmployeeRow = { name };
		const role = roleIdx >= 0 ? cells[roleIdx] : "";
		const team = teamIdx >= 0 ? cells[teamIdx] : "";
		const manager = managerIdx >= 0 ? cells[managerIdx] : "";
		if (role) row.role = role;
		if (team) row.team = team;
		if (manager) row.manager = manager;
		rows.push(row);
	}
	return rows;
}

export function mapEmployeeRows(
	rows: EmployeeRow[],
	opts: IngestOptions,
): IngestResult {
	const existing = opts.existingNodeIds ?? new Set<string>();
	const proposals: IngestedProposal[] = [];
	// Tracks ids materialized in this batch (existing ∪ newly proposed) so we
	// neither duplicate within the batch nor against the live graph.
	const known = new Set<string>(existing);

	const add = (proposal: GraphOperationProposal) =>
		proposals.push({ proposal, source: opts.source });

	for (const row of rows) {
		const name = row.name?.trim();
		if (!name) continue;

		const personId = `person-${slug(name)}`;
		if (!known.has(personId)) {
			known.add(personId);
			const attributes: Record<string, unknown> = {};
			if (row.role) attributes.role = row.role;
			if (row.manager) attributes.manager = row.manager;
			const node: GraphNode = { id: personId, type: "Person", name };
			if (Object.keys(attributes).length > 0) node.attributes = attributes;
			add({
				type: "create_node",
				node,
				reason: `Imported from ${opts.source}`,
			});
		}

		const team = row.team?.trim();
		if (!team) continue;
		const unitId = `unit-${slug(team)}`;
		if (!known.has(unitId)) {
			known.add(unitId);
			add({
				type: "create_node",
				node: { id: unitId, type: "Unit", name: team },
				reason: `Team from ${opts.source}`,
			});
		}

		// Person BELONGS_TO Unit. Skip when both endpoints predate this run
		// (already linked) — avoids duplicate edges on re-import.
		const personPreexisted = existing.has(personId);
		const unitPreexisted = existing.has(unitId);
		if (personPreexisted && unitPreexisted) continue;

		const edge: GraphEdge = {
			id: `edge-${personId}-belongs-${unitId}`,
			type: "BELONGS_TO",
			fromNodeId: personId,
			toNodeId: unitId,
		};
		add({
			type: "create_edge",
			edge,
			reason: `Team membership from ${opts.source}`,
		});
	}

	const people = proposals.filter(
		(p) =>
			p.proposal.type === "create_node" && p.proposal.node.type === "Person",
	).length;
	return {
		source: opts.source,
		proposals,
		summary: `${people} people, ${proposals.length} proposals from ${opts.source}`,
	};
}

/** Drop proposals that already exist (node id present, or edge fully connecting existing nodes). */
function dedupe(
	raw: GraphOperationProposal[],
	existing: Set<string>,
	source: string,
): IngestedProposal[] {
	const out: IngestedProposal[] = [];
	for (const p of raw) {
		if (p.type === "create_node" && existing.has(p.node.id)) continue;
		if (
			p.type === "create_edge" &&
			existing.has(p.edge.fromNodeId) &&
			existing.has(p.edge.toNodeId)
		)
			continue;
		out.push({ proposal: p, source });
	}
	return out;
}

/**
 * Text mapper: run unstructured text through the (heuristic) interview engine
 * to produce reviewable proposals. Reuses the same engine as guided capture, so
 * a transcript yields the same kind of graph as a live interview — no LLM needed.
 */
export function ingestText(text: string, opts: IngestOptions): IngestResult {
	const sentences = text
		.split(/\n+|(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	let session = createInterviewSession();
	for (const sentence of sentences) {
		session = answerInterviewQuestion(session, sentence);
	}

	const proposals = dedupe(
		session.proposals,
		opts.existingNodeIds ?? new Set(),
		opts.source,
	);
	const people = proposals.filter(
		(p) =>
			p.proposal.type === "create_node" && p.proposal.node.type === "Person",
	).length;
	return {
		source: opts.source,
		proposals,
		summary: `${people} people, ${proposals.length} proposals from ${opts.source}`,
	};
}
