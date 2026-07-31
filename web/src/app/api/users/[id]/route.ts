import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { users } from "@/db/schema";
import { requireApiUser } from "@/auth/api-guard";

export const runtime = "nodejs";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireApiUser();
	if (auth instanceof NextResponse) return auth;
	const { id } = await params;

	const db = createDb();
	const [row] = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			role: users.role,
			companyId: users.companyId,
			validationDomains: users.validationDomains,
			position: users.position,
			department: users.department,
			salary: users.salary,
			workingHours: users.workingHours,
			contractType: users.contractType,
			startDate: users.startDate,
			phone: users.phone,
			bio: users.bio,
			createdAt: users.createdAt,
		})
		.from(users)
		.where(eq(users.id, id))
		.limit(1);

	if (!row) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	if (row.companyId !== auth.companyId) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { passwordHash: _, ...safe } = row as typeof row & { passwordHash?: string };
	return NextResponse.json(safe);
}

const UPDATABLE_FIELDS = [
	"name",
	"position",
	"department",
	"salary",
	"workingHours",
	"contractType",
	"startDate",
	"phone",
	"bio",
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireApiUser();
	if (auth instanceof NextResponse) return auth;
	const { id } = await params;

	if (auth.id !== id && auth.role !== "owner") {
		return NextResponse.json(
			{ error: "You can only edit your own profile." },
			{ status: 403 },
		);
	}

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json(
			{ error: "Invalid JSON" },
			{ status: 400 },
		);
	}

	const patch: Record<string, unknown> = {};
	for (const field of UPDATABLE_FIELDS) {
		if (field in body) {
			const value = body[field];
			if (field === "salary" || field === "workingHours") {
				if (value !== null && typeof value !== "number") {
					return NextResponse.json(
						{ error: `Invalid ${field}` },
						{ status: 422 },
					);
				}
				patch[field] = value;
			} else if (value !== null && typeof value !== "string") {
				return NextResponse.json(
					{ error: `Invalid ${field}` },
					{ status: 422 },
				);
			} else {
				patch[field] = value || null;
			}
		}
	}

	if (Object.keys(patch).length === 0) {
		return NextResponse.json(
			{ error: "No updatable fields provided." },
			{ status: 422 },
		);
	}

	const db = createDb();

	const [existing] = await db
		.select({ companyId: users.companyId })
		.from(users)
		.where(eq(users.id, id))
		.limit(1);

	if (!existing) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	if (existing.companyId !== auth.companyId) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const [updated] = await db
		.update(users)
		.set(patch)
		.where(eq(users.id, id))
		.returning({
			id: users.id,
			name: users.name,
			position: users.position,
			department: users.department,
			salary: users.salary,
			workingHours: users.workingHours,
			contractType: users.contractType,
			startDate: users.startDate,
			phone: users.phone,
			bio: users.bio,
		});

	return NextResponse.json(updated);
}
