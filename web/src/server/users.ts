import { and, eq } from "drizzle-orm";
import { createDb } from "@/db";
import { userProfiles, users } from "@/db/schema";
import type { UserRole } from "@/auth/permissions";
import { withTenantTransaction } from "@/db/tenant-transaction";

export type CompanyUser = {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	personNodeId?: string;
};

/** List the users belonging to a company (for assignee pickers). */
export async function listCompanyUsers(
	companyId: string,
): Promise<CompanyUser[]> {
	const db = createDb();
	const rows = await withTenantTransaction(db, companyId, (tx) => tx.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
			personNodeId: userProfiles.personNodeId,
		})
		.from(users)
		.leftJoin(userProfiles, and(
			eq(userProfiles.userId, users.id),
			eq(userProfiles.companyId, users.companyId),
		))
		.where(eq(users.companyId, companyId))
		.orderBy(users.name));
	return rows.map((row) => ({ ...row, personNodeId: row.personNodeId ?? undefined }));
}
