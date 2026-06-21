import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { users } from "@/db/schema";
import { authConfig } from "./config";
import type { AuthUser, UserRole } from "./permissions";

/**
 * Full Auth.js instance (Node runtime — uses the database and bcrypt).
 *
 * Exposes:
 *  - handlers: GET/POST route handlers for /api/auth/[...nextauth]
 *  - auth():   server-side session reader
 *  - signIn/signOut: server actions
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
	...authConfig,
	providers: [
		Credentials({
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
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
			},
		}),
	],
});

/**
 * Returns the current authenticated user as a domain AuthUser, or null.
 * Use inside Server Components, Route Handlers, and Server Actions.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
	const session = await auth();
	const u = session?.user;
	if (!u?.email) return null;
	return {
		id: u.id ?? "",
		name: u.name ?? u.email,
		email: u.email,
		companyId: u.companyId ?? "demo-corp",
		role: (u.role as UserRole) ?? "viewer",
		validationDomains: u.validationDomains ?? [],
	};
}
