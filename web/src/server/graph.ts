import { createDb } from "@/db";
import { createDrizzleGraphRepository } from "@/db/repository";
import { createDrizzleAssertionRepository } from "@/db/assertion-repository";
import {
	createPersistentGraphService,
	type PersistentGraphService,
} from "@/domain/persistent-graph-service";
import { createCanonicalGraphWriter } from "@/domain/canonical-graph-writer";
import { requireOrganizationId } from "@/auth/organization-context";

/**
 * Builds a DB-backed graph service scoped to a single company (tenant).
 * All reads/writes are isolated to `companyId`.
 */
export function getGraphService(
	companyId: string,
	actorId?: string,
	writeContext?: { sourceType: string; sourceId: string },
): PersistentGraphService {
	const tenantId = requireOrganizationId(companyId);
	const db = createDb();
	const repo = createDrizzleGraphRepository(db, tenantId);
	const projection = createPersistentGraphService(repo, { companyId: tenantId, actorId });
	if (!actorId) return projection;
	const writer = createCanonicalGraphWriter(
		createDrizzleAssertionRepository(db, tenantId),
		repo,
		{
			organizationId: tenantId,
			actorId,
			sourceType: writeContext?.sourceType,
			sourceId: writeContext?.sourceId,
		},
	);
	return {
		...projection,
		createNode: writer.createNode,
		updateNode: writer.updateNode,
		deleteNode: writer.deleteNode,
		createEdge: writer.createEdge,
		updateEdge: writer.updateEdge,
		deleteEdge: writer.deleteEdge,
		applyProposalsWithDecisions: writer.applyProposalsWithDecisions,
		async applyConfirmedProposals() {
			throw new Error("Graph proposals require explicit human review decisions");
		},
	};
}
