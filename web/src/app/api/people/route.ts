import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { listCompanyPeople } from "@/server/people";

/**
 * GET /api/people — combined people picker source (graph Person nodes + app
 * users), de-duplicated. Any authenticated company member may read it.
 */
export async function GET() {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;
	const people = await listCompanyPeople(user.companyId);
	return NextResponse.json({ people });
}
