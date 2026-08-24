import { requireOrganizationId } from "@/auth/organization-context";
import type { AssertionRepository } from "@/db/assertion-repository";
import type { GraphRepository } from "@/db/repository";
import {
	projectApprovedAssertions,
	type GraphProjection,
} from "./graph-projection";

/**
 * Rebuilds the complete materialized graph for one organization. The ledger is
 * the sole canonical source: rows that cannot be reproduced from approved,
 * current assertions are deliberately removed from the projection.
 */
export async function rebuildApprovedAssertionProjection(
	assertions: AssertionRepository,
	graph: GraphRepository,
	organizationId: string,
): Promise<GraphProjection> {
	const tenantId = requireOrganizationId(organizationId);
	const projection = projectApprovedAssertions(
		await assertions.listByOrganization(tenantId),
	);

	for (const edge of await graph.listEdges()) await graph.deleteEdge(edge.id);
	for (const node of await graph.listNodes()) await graph.deleteNode(node.id);

	for (const node of projection.nodes) {
		await graph.createNode({ ...node, companyId: tenantId });
	}
	for (const edge of projection.edges) {
		await graph.createEdge({ ...edge, companyId: tenantId });
	}

	return projection;
}
