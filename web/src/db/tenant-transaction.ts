import { sql } from "drizzle-orm";
import { requireOrganizationId } from "@/auth/organization-context";
import type { Db } from "./index";

export type TenantTransaction = Pick<Db, "select" | "insert" | "update" | "delete" | "execute">;

/**
 * Establishes the PostgreSQL RLS tenant inside the same transaction as every
 * query. Setting it outside the transaction is unsafe with a connection pool.
 */
export function withTenantTransaction<T>(
	db: Db,
	organizationId: string,
	work: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
	const tenantId = requireOrganizationId(organizationId);
	return db.transaction(async (tx) => {
		await tx.execute(sql`select set_config('app.organization_id', ${tenantId}, true)`);
		return work(tx);
	});
}
