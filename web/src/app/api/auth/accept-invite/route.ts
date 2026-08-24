import { NextResponse } from "next/server";
import { acceptInvitation } from "@/server/invitations";
import { checkDistributedRateLimit } from "@/lib/rate-limiter";

export async function POST(request: Request) {
	const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	const client = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
	try {
		const limit = await checkDistributedRateLimit(`invite-accept:${client}`, 10, 5);
		if (!limit.allowed) {
			return NextResponse.json(
				{ error: "Too many attempts" },
				{ status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
			);
		}
	} catch {
		return NextResponse.json({ error: "Invitation service temporarily unavailable" }, { status: 503 });
	}
	let body: { token?: string; password?: string; name?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	try {
		const user = await acceptInvitation({
			token: body.token ?? "",
			password: body.password ?? "",
			name: body.name ?? "",
		});
		return NextResponse.json(user, { status: 201, headers: { "Cache-Control": "no-store" } });
	} catch {
		return NextResponse.json({ error: "Invitation is invalid or expired" }, { status: 422 });
	}
}
