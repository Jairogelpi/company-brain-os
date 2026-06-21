import { createDb } from "@/db";
import { createDrizzleGraphRepository } from "@/db/repository";
import {
	createPersistentGraphService,
	type PersistentGraphService,
} from "@/domain/persistent-graph-service";

/**
 * Builds a DB-backed graph service scoped to a single company (tenant).
 * All reads/writes are isolated to `companyId`.
 */
export function getGraphService(
	companyId: string,
	actorId?: string,
): PersistentGraphService {
	const db = createDb();
	const repo = createDrizzleGraphRepository(db, companyId);
	return createPersistentGraphService(repo, { companyId, actorId });
}
