/**
 * Authorization model for Company Brain OS (pure, no I/O).
 *
 * Authentication itself is handled by Auth.js (NextAuth) — see src/auth/nextauth.ts.
 * This module only answers "can this user do X?".
 *
 * Multi-tenant: company_id isolation on all operations.
 * Roles: owner, validator, contributor, viewer.
 */

// --- Types ---

export type UserRole = "owner" | "validator" | "contributor" | "viewer";

export interface AuthUser {
	id: string;
	name: string;
	email: string;
	companyId: string;
	role: UserRole;
	validationDomains: string[]; // domains this user can validate (for validators)
}

// --- Role hierarchy ---

const ROLE_LEVEL: Record<UserRole, number> = {
	owner: 4,
	validator: 3,
	contributor: 2,
	viewer: 1,
};

export function hasMinimumRole(
	userRole: UserRole,
	required: UserRole,
): boolean {
	return ROLE_LEVEL[userRole] >= ROLE_LEVEL[required];
}

// --- Permission checks ---

export type Operation =
	| "graph.node.create"
	| "graph.node.update"
	| "graph.node.delete"
	| "graph.edge.create"
	| "graph.edge.update"
	| "graph.edge.delete"
	| "mission.create"
	| "mission.assign"
	| "mission.close"
	| "knowledge.validate"
	| "user.invite";

const OPERATION_PERMISSIONS: Record<Operation, UserRole> = {
	"graph.node.create": "contributor",
	"graph.node.update": "contributor",
	"graph.node.delete": "validator",
	"graph.edge.create": "contributor",
	"graph.edge.update": "contributor",
	"graph.edge.delete": "validator",
	"mission.create": "validator",
	"mission.assign": "validator",
	"mission.close": "validator",
	"knowledge.validate": "validator",
	"user.invite": "owner",
};

export function canPerform(user: AuthUser, operation: Operation): boolean {
	const required = OPERATION_PERMISSIONS[operation];
	if (!required) return false;
	return hasMinimumRole(user.role, required);
}

export function canValidate(user: AuthUser, domain: string): boolean {
	if (user.role === "owner") return true;
	if (user.role !== "validator") return false;
	return (
		user.validationDomains.includes(domain) ||
		user.validationDomains.includes("*")
	);
}

// --- Operation guard ---

export interface PermissionError {
	code: "forbidden" | "unauthorized";
	message: string;
	operation: string;
}

export function guardOperation(
	user: AuthUser | null,
	operation: Operation,
	companyId?: string,
): PermissionError | null {
	if (!user) {
		return {
			code: "unauthorized",
			message: "Authentication required.",
			operation,
		};
	}

	if (companyId && user.companyId !== companyId) {
		return {
			code: "forbidden",
			message: `Cannot access company "${companyId}". You belong to "${user.companyId}".`,
			operation,
		};
	}

	if (!canPerform(user, operation)) {
		return {
			code: "forbidden",
			message: `Role "${user.role}" cannot perform "${operation}". Required: ${OPERATION_PERMISSIONS[operation]}.`,
			operation,
		};
	}

	return null;
}
