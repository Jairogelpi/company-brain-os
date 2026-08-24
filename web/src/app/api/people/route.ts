import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { listCompanyPeople } from "@/server/people";

/**
 * GET /api/people — canonical graph Person picker source with explicit user
 * mappings. Any authenticated company member may read it.
 */
export async function GET() {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;
	const people = await listCompanyPeople(user.companyId);
	return NextResponse.json({ people });
}
