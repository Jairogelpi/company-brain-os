import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { userProfiles, users } from "@/db/schema";
import { withTenantTransaction, type TenantTransaction } from "@/db/tenant-transaction";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";

export const runtime = "nodejs";

function selectProfile(tx: TenantTransaction, companyId: string, id: string) {
	return tx
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			role: users.role,
			companyId: users.companyId,
			validationDomains: users.validationDomains,
			position: userProfiles.position,
			department: userProfiles.department,
			salary: userProfiles.salary,
			workingHours: userProfiles.workingHours,
			contractType: userProfiles.contractType,
			startDate: userProfiles.startDate,
			phone: userProfiles.phone,
			bio: userProfiles.bio,
			personNodeId: userProfiles.personNodeId,
			createdAt: users.createdAt,
		})
		.from(users)
		.leftJoin(userProfiles, and(
			eq(userProfiles.userId, users.id),
			eq(userProfiles.companyId, users.companyId),
		))
		.where(and(eq(users.id, id), eq(users.companyId, companyId)))
		.limit(1);
}

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireApiUser();
	if (auth instanceof NextResponse) return auth;
	const { id } = await params;
	if (auth.id !== id && auth.role !== "owner") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	const db = createDb();
	const [row] = await withTenantTransaction(db, auth.companyId, (tx) =>
		selectProfile(tx, auth.companyId, id));
	return row
		? NextResponse.json(row)
		: NextResponse.json({ error: "Not found" }, { status: 404 });
}

const PROFILE_FIELDS = [
	"position",
	"department",
	"salary",
	"workingHours",
	"contractType",
	"startDate",
	"phone",
	"bio",
	"personNodeId",
] as const;
const UPDATABLE_FIELDS = ["name", ...PROFILE_FIELDS] as const;
const SELF_UPDATABLE_FIELDS = new Set<string>(["name", "phone", "bio"]);
type ProfileField = (typeof PROFILE_FIELDS)[number];
type ProfilePatch = {
	position?: string | null;
	department?: string | null;
	salary?: number | null;
	workingHours?: number | null;
	contractType?: string | null;
	startDate?: string | null;
	phone?: string | null;
	bio?: string | null;
	personNodeId?: string | null;
};

export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireApiUser();
	if (auth instanceof NextResponse) return auth;
	const { id } = await params;
	if (auth.id !== id && auth.role !== "owner") {
		return NextResponse.json({ error: "You can only edit your own profile." }, { status: 403 });
	}

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const requested = UPDATABLE_FIELDS.filter((field) => field in body);
	if (requested.length === 0) {
		return NextResponse.json({ error: "No updatable fields provided." }, { status: 422 });
	}
	if (auth.role !== "owner" && requested.some((field) => !SELF_UPDATABLE_FIELDS.has(field))) {
		return NextResponse.json({ error: "Only an owner can edit HR fields." }, { status: 403 });
	}
	if ("personNodeId" in body) {
		const value = body.personNodeId;
		if (value !== null && (typeof value !== "string" || !value.trim())) {
			return NextResponse.json({ error: "Invalid personNodeId" }, { status: 422 });
		}
		if (typeof value === "string") {
			const node = await getGraphService(auth.companyId).readNode(value.trim());
			if (node?.type !== "Person") {
				return NextResponse.json({ error: "personNodeId must reference a tenant Person node." }, { status: 422 });
			}
		}
	}

	let name: string | undefined;
	const profilePatch: ProfilePatch = {};
	for (const field of requested) {
		const value = body[field];
		if (field === "name") {
			if (typeof value !== "string" || !value.trim()) {
				return NextResponse.json({ error: "Invalid name" }, { status: 422 });
			}
			name = value.trim();
			continue;
		}
		if (field === "salary" || field === "workingHours") {
			if (value !== null && (!Number.isInteger(value) || (value as number) < 0)) {
				return NextResponse.json({ error: `Invalid ${field}` }, { status: 422 });
			}
			if (field === "workingHours" && typeof value === "number" && value > 168) {
				return NextResponse.json({ error: "Invalid workingHours" }, { status: 422 });
			}
			profilePatch[field] = value as number | null;
			continue;
		}
		if (field === "personNodeId") {
			profilePatch.personNodeId = typeof value === "string" ? value.trim() : null;
			continue;
		}
		if (value !== null && typeof value !== "string") {
			return NextResponse.json({ error: `Invalid ${field}` }, { status: 422 });
		}
		if (field === "startDate" && typeof value === "string" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			return NextResponse.json({ error: "Invalid startDate" }, { status: 422 });
		}
		profilePatch[field] = typeof value === "string" ? value.trim() || null : null;
	}

	const db = createDb();
	try {
	const updated = await withTenantTransaction(db, auth.companyId, async (tx) => {
		const existing = await tx
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.id, id), eq(users.companyId, auth.companyId)))
			.limit(1);
		if (!existing[0]) return undefined;
		if (name !== undefined) {
			await tx.update(users).set({ name }).where(and(
				eq(users.id, id),
				eq(users.companyId, auth.companyId),
			));
		}
		if (Object.keys(profilePatch).length > 0) {
			await tx.insert(userProfiles).values({
				userId: id,
				companyId: auth.companyId,
				...profilePatch,
			}).onConflictDoUpdate({
				target: userProfiles.userId,
				set: { ...profilePatch, updatedAt: new Date() },
			});
		}
		return (await selectProfile(tx, auth.companyId, id))[0];
	});
	return updated
		? NextResponse.json(updated)
		: NextResponse.json({ error: "Not found" }, { status: 404 });
	} catch (error) {
		if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
			return NextResponse.json({ error: "That canonical Person is already mapped to another user." }, { status: 409 });
		}
		throw error;
	}
}
