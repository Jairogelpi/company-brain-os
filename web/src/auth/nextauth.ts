import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./config";
import { authorizeCredentials } from "./authorize";
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
			authorize: authorizeCredentials,
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
