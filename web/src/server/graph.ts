import { createDb } from "@/db";
import { createDrizzleGraphRepository } from "@/db/repository";
import {
	createPersistentGraphService,
	type PersistentGraphService,
} from "@/domain/persistent-graph-service";
import { requireOrganizationId } from "@/auth/organization-context";

/**
 * Builds a DB-backed graph service scoped to a single company (tenant).
 * All reads/writes are isolated to `companyId`.
 */
export function getGraphService(
	companyId: string,
	actorId?: string,
): PersistentGraphService {
	const tenantId = requireOrganizationId(companyId);
	const db = createDb();
	const repo = createDrizzleGraphRepository(db, tenantId);
	return createPersistentGraphService(repo, { companyId: tenantId, actorId });
}
