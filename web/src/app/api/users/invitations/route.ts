import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import {
	createInvitation,
	listInvitations,
	type InvitationRole,
} from "@/server/invitations";

export async function GET() {
	const user = await requireApiUser("user.invite");
	if (user instanceof NextResponse) return user;
	const items = await listInvitations(user.companyId);
	return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
	const user = await requireApiUser("user.invite");
	if (user instanceof NextResponse) return user;
	let body: { email?: string; role?: InvitationRole };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	try {
		const invitation = await createInvitation({
			companyId: user.companyId,
			invitedBy: user.id,
			email: body.email ?? "",
			role: body.role ?? "contributor",
		});
		return NextResponse.json(invitation, {
			status: 201,
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Invitation failed" },
			{ status: 422 },
		);
	}
}
