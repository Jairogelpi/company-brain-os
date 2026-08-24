import type { Assertion } from "./assertions";
import {
	canConnect,
	isEdgeType,
	isKnowledgeType,
	isNodeType,
	type GraphEdge,
	type GraphNode,
} from "./graph";

export const ENTITY_PREDICATES = {
	type: "ENTITY_TYPE",
	name: "ENTITY_NAME",
	criticality: "CRITICALITY",
	archived: "ARCHIVED",
	knowledgeType: "KNOWLEDGE_TYPE",
	documented: "DOCUMENTED",
	validationState: "VALIDATION_STATE",
	confidence: "CONFIDENCE",
	attributes: "NODE_ATTRIBUTES",
} as const;

export type ProjectionRejection = {
	assertionId: string;
	reason: "missing_entity" | "invalid_endpoint" | "invalid_scalar";
};

export type GraphProjection = {
	assertions: Assertion[];
	nodes: GraphNode[];
	edges: GraphEdge[];
	hash: string;
	rejectedInputs: ProjectionRejection[];
};

function stableHash(value: unknown): string {
	const text = JSON.stringify(value);
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `fnv1a-${(hash >>> 0).toString(16)}`;
}

function activeAt(assertion: Assertion, at: number): boolean {
	if (assertion.status !== "approved") return false;
	if (assertion.validFrom && new Date(assertion.validFrom).getTime() > at) return false;
	if (assertion.validUntil && new Date(assertion.validUntil).getTime() <= at) return false;
	return true;
}

function recordValue(assertion: Assertion): string | number | boolean | null | undefined {
	return assertion.scalarValue;
}

function metadataRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}

function assertionOrder(left: Assertion, right: Assertion): number {
	const recorded = left.recordedAt.localeCompare(right.recordedAt);
	return recorded === 0 ? left.id.localeCompare(right.id) : recorded;
}

export function projectApprovedAssertions(
	assertions: Assertion[],
	at = new Date().getTime(),
): GraphProjection {
	const approved = assertions
		.filter((assertion) => activeAt(assertion, at))
		.sort(assertionOrder);
	const latestScalars = new Map<string, Assertion>();
	for (const assertion of approved) {
		if (assertion.objectEntityId || isEdgeType(assertion.predicate)) continue;
		latestScalars.set(`${assertion.subjectEntityId}\u0000${assertion.predicate}`, assertion);
	}

	const subjects = new Set(approved.map((assertion) => assertion.subjectEntityId));
	const rejectedInputs: ProjectionRejection[] = [];
	const nodes = [...subjects].sort().flatMap((subjectEntityId) => {
		const get = (predicate: string) => latestScalars.get(`${subjectEntityId}\u0000${predicate}`);
		const typeAssertion = get(ENTITY_PREDICATES.type);
		const nameAssertion = get(ENTITY_PREDICATES.name);
		const type = typeAssertion ? recordValue(typeAssertion) : undefined;
		const name = nameAssertion ? recordValue(nameAssertion) : undefined;
		if (typeof type !== "string" || !isNodeType(type) || typeof name !== "string" || !name.trim()) {
			if (typeAssertion) rejectedInputs.push({ assertionId: typeAssertion.id, reason: "invalid_scalar" });
			if (nameAssertion) rejectedInputs.push({ assertionId: nameAssertion.id, reason: "invalid_scalar" });
			return [];
		}
		if (recordValue(get(ENTITY_PREDICATES.archived) ?? {} as Assertion) === true) return [];

		const predicates: Record<string, string> = {};
		for (const assertion of latestScalars.values()) {
			if (assertion.subjectEntityId === subjectEntityId) predicates[assertion.predicate] = assertion.id;
		}
		const assertionIds = Object.values(predicates).sort();
		const attributesAssertion = get(ENTITY_PREDICATES.attributes);
		const nodeAttributes = metadataRecord(
			attributesAssertion?.metadata.nodeAttributes ?? typeAssertion?.metadata.nodeAttributes,
		);
		const node: GraphNode = {
			id: subjectEntityId,
			type,
			name: name.trim(),
			attributes: {
				...nodeAttributes,
				provenance: { assertionIds, predicates },
			},
		};
		const criticality = recordValue(get(ENTITY_PREDICATES.criticality) ?? {} as Assertion);
		if (criticality === "low" || criticality === "medium" || criticality === "high") node.criticality = criticality;
		if (type === "Knowledge") {
			const knowledgeType = recordValue(get(ENTITY_PREDICATES.knowledgeType) ?? {} as Assertion);
			const documented = recordValue(get(ENTITY_PREDICATES.documented) ?? {} as Assertion);
			const validationState = recordValue(get(ENTITY_PREDICATES.validationState) ?? {} as Assertion);
			const confidence = recordValue(get(ENTITY_PREDICATES.confidence) ?? {} as Assertion);
			if (!isKnowledgeType(String(knowledgeType)) || typeof documented !== "boolean" ||
				!(["draft", "proposed", "validated", "retired"] as unknown[]).includes(validationState) ||
				typeof confidence !== "number" || confidence < 0 || confidence > 100) {
				for (const predicate of [ENTITY_PREDICATES.knowledgeType, ENTITY_PREDICATES.documented, ENTITY_PREDICATES.validationState, ENTITY_PREDICATES.confidence]) {
					const invalid = get(predicate);
					if (invalid) rejectedInputs.push({ assertionId: invalid.id, reason: "invalid_scalar" });
				}
				return [];
			}
			Object.assign(node, { knowledgeType, documented, validationState, confidence });
		}
		return [node];
	});
	const nodesById = new Map(nodes.map((node) => [node.id, node]));
	const edges = approved.flatMap((assertion) => {
		if (!assertion.objectEntityId || !isEdgeType(assertion.predicate)) return [];
		const from = nodesById.get(assertion.subjectEntityId);
		const to = nodesById.get(assertion.objectEntityId);
		if (!from || !to) {
			rejectedInputs.push({ assertionId: assertion.id, reason: "missing_entity" });
			return [];
		}
		if (!canConnect(assertion.predicate, from.type, to.type)) {
			rejectedInputs.push({ assertionId: assertion.id, reason: "invalid_endpoint" });
			return [];
		}
		return [{
			id: `assertion:${assertion.id}`,
			type: assertion.predicate,
			fromNodeId: assertion.subjectEntityId,
			toNodeId: assertion.objectEntityId,
			attributes: {
				...metadataRecord(assertion.metadata.edgeAttributes),
				assertionId: assertion.id,
				assertionIds: [assertion.id],
				evidenceClass: assertion.confidenceClass,
			},
		} satisfies GraphEdge];
	});

	return {
		assertions: approved,
		nodes,
		edges,
		hash: stableHash({ nodes, edges }),
		rejectedInputs,
	};
}
