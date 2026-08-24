import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { and, desc, eq, gt, lte } from "drizzle-orm";
import { createDb } from "@/db";
import { userInvitations, users } from "@/db/schema";
import { withTenantTransaction } from "@/db/tenant-transaction";
import { requireOrganizationId } from "@/auth/organization-context";
import { isValidPassword, PASSWORD_BCRYPT_ROUNDS } from "@/auth/signup-validation";
import { enqueueInvitationEmail } from "./notifications";

export type InvitationRole = "validator" | "contributor" | "viewer";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenHash(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function createInvitationToken(companyId: string): string {
	const tenant = Buffer.from(requireOrganizationId(companyId), "utf8").toString("base64url");
	return `${tenant}.${randomBytes(32).toString("base64url")}`;
}

export function invitationCompanyId(token: string): string {
	const [encodedTenant, secret, extra] = token.split(".");
	if (!encodedTenant || !secret || extra || !/^[A-Za-z0-9_-]{40,}$/.test(secret)) {
		throw new Error("Invalid invitation");
	}
	const companyId = Buffer.from(encodedTenant, "base64url").toString("utf8");
	return requireOrganizationId(companyId);
}

export async function createInvitation(input: {
	companyId: string;
	invitedBy: string;
	email: string;
	role: InvitationRole;
}): Promise<{ id: string; email: string; role: InvitationRole; expiresAt: string; invitePath: string }> {
	const companyId = requireOrganizationId(input.companyId);
	const email = input.email.trim().toLowerCase();
	if (!EMAIL_RE.test(email)) throw new Error("Invalid email");
	if (!["validator", "contributor", "viewer"].includes(input.role)) throw new Error("Invalid role");
	const token = createInvitationToken(companyId);
	const id = `invite-${globalThis.crypto.randomUUID()}`;
	const expiresAt = new Date(Date.now() + 7 * 86_400_000);
	const invitePath = `/accept-invite?token=${encodeURIComponent(token)}`;
	const db = createDb();
	await withTenantTransaction(db, companyId, async (tx) => {
		const existing = await tx.select({ id: users.id }).from(users)
			.where(eq(users.email, email)).limit(1);
		if (existing[0]) throw new Error("Email cannot be invited");
		await tx.update(userInvitations).set({ status: "revoked" }).where(and(
			eq(userInvitations.companyId, companyId),
			eq(userInvitations.email, email),
			eq(userInvitations.status, "pending"),
		));
		await tx.insert(userInvitations).values({
			id,
			companyId,
			email,
			role: input.role,
			tokenHash: tokenHash(token),
			invitedBy: input.invitedBy,
			status: "pending",
			expiresAt,
		});
		await enqueueInvitationEmail(tx, { id, companyId, email, role: input.role, invitePath });
	});
	return { id, email, role: input.role, expiresAt: expiresAt.toISOString(), invitePath };
}

export async function listInvitations(companyId: string) {
	const db = createDb();
	return withTenantTransaction(db, companyId, async (tx) => {
		await tx.update(userInvitations).set({ status: "expired" }).where(and(
			eq(userInvitations.companyId, companyId),
			eq(userInvitations.status, "pending"),
			lte(userInvitations.expiresAt, new Date()),
		));
		return tx.select({
		id: userInvitations.id,
		email: userInvitations.email,
		role: userInvitations.role,
		status: userInvitations.status,
		expiresAt: userInvitations.expiresAt,
		createdAt: userInvitations.createdAt,
		}).from(userInvitations).where(eq(userInvitations.companyId, companyId))
			.orderBy(desc(userInvitations.createdAt));
	});
}

export async function acceptInvitation(input: {
	token: string;
	password: string;
	name: string;
}): Promise<{ id: string; email: string; companyId: string; role: InvitationRole }> {
	if (!isValidPassword(input.password)) throw new Error("Password must contain 12–128 characters");
	const name = input.name.trim();
	if (!name || name.length > 100) throw new Error("Invalid name");
	const companyId = invitationCompanyId(input.token);
	const db = createDb();
	return withTenantTransaction(db, companyId, async (tx) => {
		const rows = await tx.select().from(userInvitations).where(and(
			eq(userInvitations.companyId, companyId),
			eq(userInvitations.tokenHash, tokenHash(input.token)),
			eq(userInvitations.status, "pending"),
			gt(userInvitations.expiresAt, new Date()),
		)).limit(1);
		const invitation = rows[0];
		if (!invitation) throw new Error("Invitation is invalid or expired");
		const existing = await tx.select({ id: users.id }).from(users)
			.where(eq(users.email, invitation.email)).limit(1);
		if (existing[0]) throw new Error("Invitation cannot be accepted");
		const userId = `user-${globalThis.crypto.randomUUID()}`;
		const passwordHash = await hash(input.password, PASSWORD_BCRYPT_ROUNDS);
		await tx.insert(users).values({
			id: userId,
			email: invitation.email,
			name,
			passwordHash,
			companyId,
			role: invitation.role,
			validationDomains: [],
		});
		const accepted = await tx.update(userInvitations).set({
			status: "accepted",
			acceptedBy: userId,
			acceptedAt: new Date(),
		}).where(and(
			eq(userInvitations.id, invitation.id),
			eq(userInvitations.companyId, companyId),
			eq(userInvitations.status, "pending"),
		)).returning({ id: userInvitations.id });
		if (!accepted[0]) throw new Error("Invitation was already used");
		return { id: userId, email: invitation.email, companyId, role: invitation.role };
	});
}
