import { requireOrganizationId } from "@/auth/organization-context";
import type { AssertionRepository } from "@/db/assertion-repository";
import type { GraphRepository } from "@/db/repository";
import {
	projectApprovedAssertions,
	type GraphProjection,
} from "./graph-projection";

/**
 * Rebuilds the materialized relationship projection for one organization.
 * Only edges owned by the assertion ledger are replaced; manually managed
 * graph edges remain untouched.
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

	for (const edge of await graph.listEdges()) {
		if (typeof edge.attributes?.assertionId === "string") {
			await graph.deleteEdge(edge.id);
		}
	}

	for (const edge of projection.edges) {
		await graph.createEdge({ ...edge, companyId: tenantId });
	}

	return projection;
}
