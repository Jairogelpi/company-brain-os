import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { listUserNotifications, markNotificationRead } from "@/server/notifications";

export async function GET() {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;
	const items = await listUserNotifications(user.companyId, user.id);
	return NextResponse.json({
		items,
		unread: items.filter((item) => item.readAt === null).length,
	});
}

export async function PATCH(request: Request) {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;
	let body: { id?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	if (!body.id?.trim()) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}
	const marked = await markNotificationRead(user.companyId, user.id, body.id.trim());
	return marked
		? NextResponse.json({ ok: true })
		: NextResponse.json({ error: "Notification not found" }, { status: 404 });
}
