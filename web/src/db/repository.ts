import type { NodeType } from "@/domain/graph";
import type { Db } from "./index";
import { nodes, edges, eventLog } from "./schema";
import { and, eq } from "drizzle-orm";
import { requireOrganizationId } from "@/auth/organization-context";
import { withTenantTransaction } from "./tenant-transaction";

// --- Domain types (subset used by repository) ---

export interface RepoNode {
	id: string;
	type: NodeType;
	name: string;
	[k: string]: unknown;
}

export interface RepoEdge {
	id: string;
	type: string;
	fromNodeId: string;
	toNodeId: string;
	companyId?: string;
	attributes?: Record<string, unknown>;
}

export interface RepoEvent {
	id: string;
	companyId?: string;
	actorId?: string;
	eventType: string;
	payload: Record<string, unknown>;
	createdAt?: string;
}

// --- Repository contract ---

export interface GraphRepository {
	createNode(node: RepoNode): Promise<void>;
	readNode(id: string): Promise<RepoNode | undefined>;
	updateNode(id: string, patch: Partial<RepoNode>): Promise<void>;
	deleteNode(id: string): Promise<void>;
	listNodes(): Promise<RepoNode[]>;

	createEdge(edge: RepoEdge): Promise<void>;
	readEdge(id: string): Promise<RepoEdge | undefined>;
	updateEdge(id: string, patch: Partial<RepoEdge>): Promise<void>;
	deleteEdge(id: string): Promise<void>;
	listEdges(): Promise<RepoEdge[]>;

	saveEvent(event: RepoEvent): Promise<void>;
	listEvents(): Promise<RepoEvent[]>;
}

// --- Mapping helpers ---

/** Flatten a domain node into a drizzle insert row */
function nodeToRow(node: RepoNode) {
	return {
		id: node.id,
		companyId: requireOrganizationId(node.companyId as string),
		type: node.type as NodeType,
		name: node.name,
		criticality:
			(node.criticality as "low" | "medium" | "high" | undefined) ?? null,
		attributes: (node.attributes as Record<string, unknown>) ?? {},
		knowledgeType:
			(node.knowledgeType as
				| "technical"
				| "process"
				| "rule"
				| "value"
				| "policy"
				| undefined) ?? null,
		documented: (node.documented as boolean | undefined) ?? null,
		validationState:
			(node.validationState as
				| "draft"
				| "proposed"
				| "validated"
				| "retired"
				| undefined) ?? null,
		confidence: (node.confidence as number | undefined) ?? null,
	};
}

function rowToNode(row: typeof nodes.$inferSelect): RepoNode {
	return {
		id: row.id,
		type: row.type as NodeType,
		name: row.name,
		criticality: row.criticality,
		attributes: row.attributes,
		knowledgeType: row.knowledgeType,
		documented: row.documented,
		validationState: row.validationState,
		confidence: row.confidence,
		companyId: row.companyId,
	};
}

function edgeToRow(edge: RepoEdge) {
	return {
		id: edge.id,
		companyId: requireOrganizationId(edge.companyId),
		type: edge.type as never,
		fromNodeId: edge.fromNodeId,
		toNodeId: edge.toNodeId,
		attributes: edge.attributes ?? {},
	};
}

function rowToEdge(row: typeof edges.$inferSelect): RepoEdge {
	return {
		id: row.id,
		type: row.type,
		fromNodeId: row.fromNodeId,
		toNodeId: row.toNodeId,
		attributes: row.attributes as Record<string, unknown>,
	};
}

function eventToRow(event: RepoEvent) {
	return {
		id: event.id,
		companyId: requireOrganizationId(event.companyId),
		actorId: event.actorId ?? null,
		eventType: event.eventType,
		payload: event.payload,
	};
}

function rowToEvent(row: typeof eventLog.$inferSelect): RepoEvent {
	return {
		id: row.id,
		companyId: row.companyId,
		actorId: row.actorId ?? undefined,
		eventType: row.eventType,
		payload: row.payload as Record<string, unknown>,
		createdAt: row.createdAt.toISOString(),
	};
}

// --- Drizzle implementation ---

/**
 * @param companyId  When provided, all reads/lists are scoped to this tenant
 *                   and inserts default to it — enforcing multi-tenant isolation.
 */
export function createDrizzleGraphRepository(
	db: Db,
	companyId: string,
): GraphRepository {
	const tenantId = requireOrganizationId(companyId);
	const scopeNode = (extra: ReturnType<typeof eq>) =>
		and(extra, eq(nodes.companyId, tenantId));
	const scopeEdge = (extra: ReturnType<typeof eq>) =>
		and(extra, eq(edges.companyId, tenantId));
	const withCompany = <T extends object>(row: T): T =>
		({ ...row, companyId: tenantId } as T);

	return {
		async createNode(node) {
			await withTenantTransaction(db, tenantId, (tx) =>
				tx.insert(nodes).values(nodeToRow(withCompany(node))),
			);
		},

		async readNode(id) {
			const rows = await withTenantTransaction(db, tenantId, (tx) => tx
				.select().from(nodes).where(scopeNode(eq(nodes.id, id))).limit(1));
			return rows[0] ? rowToNode(rows[0]) : undefined;
		},

		async updateNode(id, patch) {
			const set: Record<string, unknown> = {};
			if (patch.name !== undefined) set.name = patch.name;
			if (patch.type !== undefined) set.type = patch.type as never;
			if (patch.attributes) set.attributes = patch.attributes;
			if (patch.criticality !== undefined)
				set.criticality = patch.criticality as never;
			if (patch.knowledgeType !== undefined)
				set.knowledgeType = patch.knowledgeType as never;
			if (patch.documented !== undefined) set.documented = patch.documented;
			if (patch.validationState !== undefined)
				set.validationState = patch.validationState as never;
			if (patch.confidence !== undefined) set.confidence = patch.confidence;
			if (Object.keys(set).length === 0) return;
			await withTenantTransaction(db, tenantId, (tx) =>
				tx.update(nodes).set(set).where(scopeNode(eq(nodes.id, id))),
			);
		},

		async deleteNode(id) {
			await withTenantTransaction(db, tenantId, (tx) =>
				tx.delete(nodes).where(scopeNode(eq(nodes.id, id))),
			);
		},

		async listNodes() {
			const rows = await withTenantTransaction(db, tenantId, (tx) => tx
				.select().from(nodes).where(scopeNode(eq(nodes.archived, false))));
			return rows.map(rowToNode);
		},

		async createEdge(edge) {
			await withTenantTransaction(db, tenantId, (tx) =>
				tx.insert(edges).values(edgeToRow(withCompany(edge))),
			);
		},

		async readEdge(id) {
			const rows = await withTenantTransaction(db, tenantId, (tx) => tx
				.select().from(edges).where(scopeEdge(eq(edges.id, id))).limit(1));
			return rows[0] ? rowToEdge(rows[0]) : undefined;
		},

		async updateEdge(id, patch) {
			const set: Record<string, unknown> = {};
			if (patch.attributes) set.attributes = patch.attributes;
			if (Object.keys(set).length === 0) return;
			await withTenantTransaction(db, tenantId, (tx) =>
				tx.update(edges).set(set).where(scopeEdge(eq(edges.id, id))),
			);
		},

		async deleteEdge(id) {
			await withTenantTransaction(db, tenantId, (tx) =>
				tx.delete(edges).where(scopeEdge(eq(edges.id, id))),
			);
		},

		async listEdges() {
			const rows = await withTenantTransaction(db, tenantId, (tx) => tx
				.select().from(edges).where(scopeEdge(eq(edges.archived, false))));
			return rows.map(rowToEdge);
		},

		async saveEvent(event) {
			await withTenantTransaction(db, tenantId, (tx) =>
				tx.insert(eventLog).values(eventToRow(withCompany(event))),
			);
		},

		async listEvents() {
			const rows = await withTenantTransaction(db, tenantId, (tx) => tx
				.select().from(eventLog).where(eq(eventLog.companyId, tenantId)).orderBy(eventLog.createdAt));
			return rows.map(rowToEvent);
		},
	};
}

// --- In-memory fallback (for tests, no real DB needed) ---

export function createInMemoryGraphRepository(): GraphRepository {
	const nodeMap = new Map<string, RepoNode>();
	const edgeMap = new Map<string, RepoEdge>();
	const eventList: RepoEvent[] = [];

	return {
		async createNode(node) {
			if (nodeMap.has(node.id))
				throw new Error(`Node already exists: ${node.id}`);
			nodeMap.set(node.id, { ...node });
		},
		async readNode(id) {
			const n = nodeMap.get(id);
			return n ? { ...n } : undefined;
		},
		async updateNode(id, patch) {
			const current = nodeMap.get(id);
			if (!current) throw new Error(`Missing node: ${id}`);
			nodeMap.set(id, { ...current, ...patch });
		},
		async deleteNode(id) {
			nodeMap.delete(id);
		},
		async listNodes() {
			return [...nodeMap.values()].map((n) => ({ ...n }));
		},
		async createEdge(edge) {
			if (edgeMap.has(edge.id))
				throw new Error(`Edge already exists: ${edge.id}`);
			edgeMap.set(edge.id, { ...edge });
		},
		async readEdge(id) {
			const e = edgeMap.get(id);
			return e ? { ...e } : undefined;
		},
		async updateEdge(id, patch) {
			const current = edgeMap.get(id);
			if (!current) throw new Error(`Missing edge: ${id}`);
			edgeMap.set(id, { ...current, ...patch });
		},
		async deleteEdge(id) {
			edgeMap.delete(id);
		},
		async listEdges() {
			return [...edgeMap.values()].map((e) => ({ ...e }));
		},
		async saveEvent(event) {
			eventList.push({
				...event,
				createdAt: event.createdAt ?? new Date().toISOString(),
			});
		},
		async listEvents() {
			return [...eventList];
		},
	};
}
