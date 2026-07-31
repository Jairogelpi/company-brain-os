import type { Assertion } from "./assertions";
import { isEdgeType, type GraphEdge } from "./graph";

export type GraphProjection = {
	assertions: Assertion[];
	edges: GraphEdge[];
	hash: string;
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

export function projectApprovedAssertions(assertions: Assertion[]): GraphProjection {
	const approved = assertions
		.filter((assertion) => assertion.status === "approved")
		.sort((left, right) => left.id.localeCompare(right.id));
	const edges = approved.flatMap((assertion) => {
		if (!assertion.objectEntityId || !isEdgeType(assertion.predicate)) return [];
		return [{
			id: `assertion:${assertion.id}`,
			type: assertion.predicate,
			fromNodeId: assertion.subjectEntityId,
			toNodeId: assertion.objectEntityId,
			attributes: {
				assertionId: assertion.id,
				evidenceClass: assertion.confidenceClass,
			},
		} satisfies GraphEdge];
	});

	return { assertions: approved, edges, hash: stableHash(approved) };
}
