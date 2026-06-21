"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import type { ReactNode } from "react";
import type { AuthUser } from "@/auth/permissions";
import { canPerform, type Operation } from "@/auth/permissions";

/**
 * Wraps the app with the Auth.js client session context.
 * Mounted once at the root layout.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
	return <SessionProvider>{children}</SessionProvider>;
}

/**
 * Client hook exposing the current user + permission helpers.
 * Backed by the Auth.js session (httpOnly JWT cookie).
 */
export function useAuth(): {
	user: AuthUser | null;
	can: (operation: Operation) => boolean;
	logout: () => void;
} {
	const { data: session } = useSession();
	const s = session?.user;

	const user: AuthUser | null = s?.email
		? {
				id: s.id ?? "",
				name: s.name ?? s.email,
				email: s.email,
				companyId: s.companyId ?? "demo-corp",
				role: s.role ?? "viewer",
				validationDomains: s.validationDomains ?? [],
			}
		: null;

	return {
		user,
		can: (op) => (user ? canPerform(user, op) : false),
		logout: () => signOut({ redirectTo: "/login" }),
	};
}
