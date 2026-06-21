import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "./permissions";

/**
 * Edge-safe Auth.js configuration.
 *
 * Contains NO database or bcrypt access so it can run inside Next.js
 * middleware (edge runtime). The Credentials provider (which needs Node)
 * lives in `nextauth.ts`, which spreads this config.
 */
export const authConfig = {
	pages: {
		signIn: "/login",
	},
	session: {
		strategy: "jwt",
		maxAge: 24 * 60 * 60, // 24h
	},
	trustHost: true,
	callbacks: {
		// Copy domain fields from the authorized user onto the JWT at sign-in.
		jwt({ token, user }) {
			if (user) {
				token.id = user.id as string;
				token.role = (user as { role?: UserRole }).role ?? "viewer";
				token.companyId =
					(user as { companyId?: string }).companyId ?? "demo-corp";
				token.validationDomains =
					(user as { validationDomains?: string[] }).validationDomains ?? [];
			}
			return token;
		},
		// Expose those fields to the app via `session.user`.
		session({ session, token }) {
			if (session.user) {
				session.user.id = (token.id as string) ?? session.user.id;
				session.user.role = (token.role as UserRole) ?? "viewer";
				session.user.companyId = (token.companyId as string) ?? "demo-corp";
				session.user.validationDomains =
					(token.validationDomains as string[]) ?? [];
			}
			return session;
		},
		// Gates page navigation. API routes self-enforce auth (returning JSON
		// 401/403 via requireApiUser) so we let them through here rather than
		// redirecting XHR calls to the login page.
		authorized({ auth, request }) {
			const { pathname } = request.nextUrl;
			const isPublic =
				pathname === "/login" ||
				pathname.startsWith("/api/") ||
				pathname.startsWith("/_next") ||
				pathname === "/favicon.ico";
			if (isPublic) return true;
			return !!auth?.user;
		},
	},
	providers: [], // real providers are added in nextauth.ts
} satisfies NextAuthConfig;
