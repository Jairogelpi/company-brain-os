import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/auth/permissions";

export type CompanyUser = {
	id: string;
	name: string;
	email: string;
	role: UserRole;
};

/** List the users belonging to a company (for assignee pickers). */
export async function listCompanyUsers(
	companyId: string,
): Promise<CompanyUser[]> {
	const rows = await createDb()
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
		})
		.from(users)
		.where(eq(users.companyId, companyId))
		.orderBy(users.name);
	return rows;
}
