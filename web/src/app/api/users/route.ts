import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { listCompanyUsers } from "@/server/users";

/** GET /api/users — list company members. Requires mission.assign (validator+). */
export async function GET() {
	const user = await requireApiUser("mission.assign");
	if (user instanceof NextResponse) return user;
	const users = await listCompanyUsers(user.companyId);
	return NextResponse.json({ users });
}
