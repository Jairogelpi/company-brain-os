import { NextResponse } from "next/server";
import { getCurrentUser } from "./nextauth";
import { guardOperation, type AuthUser, type Operation } from "./permissions";

/**
 * Guards an API route handler.
 *
 * Returns the authenticated `AuthUser` on success, or a `NextResponse`
 * (401/403) that the caller should return immediately.
 *
 *   const user = await requireApiUser();
 *   if (user instanceof NextResponse) return user;
 *
 * Pass an `operation` to also enforce role/company permissions.
 */
export async function requireApiUser(
	operation?: Operation,
	companyId?: string,
): Promise<AuthUser | NextResponse> {
	const user = await getCurrentUser();
	if (!user) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	if (operation) {
		const err = guardOperation(user, operation, companyId);
		if (err) {
			return NextResponse.json(
				{ error: err.message, code: err.code },
				{ status: err.code === "unauthorized" ? 401 : 403 },
			);
		}
	}

	return user;
}
