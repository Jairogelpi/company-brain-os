import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { users } from "@/db/schema";

export async function authorizeCredentials(
	credentials: Partial<Record<"email" | "password", unknown>>,
) {
	const email = String(credentials?.email ?? "")
		.trim()
		.toLowerCase();
	const password = String(credentials?.password ?? "");
	if (!email || !password) return null;

	const db = createDb();
	const rows = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);
	const row = rows[0];
	if (!row) return null;

	const ok = await compare(password, row.passwordHash);
	if (!ok) return null;

	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		companyId: row.companyId,
		validationDomains: row.validationDomains,
	};
}
