import { handlers } from "@/auth/nextauth";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limiter";

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
	const pathname = new URL(request.url).pathname;
	if (pathname.endsWith("/callback/credentials")) {
		const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
		const client = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
		let emailHash = "unknown";
		try {
			const form = await request.clone().formData();
			const email = String(form.get("email") ?? "").trim().toLowerCase();
			if (email) emailHash = createHash("sha256").update(email).digest("hex");
		} catch {
			// Auth.js returns its normal generic credentials error for malformed input.
		}
		try {
			const limit = await checkDistributedRateLimit(`signin:${client}:${emailHash}`, 10, 5);
			if (!limit.allowed) {
				return NextResponse.json(
					{ error: "Too many sign-in attempts" },
					{ status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
				);
			}
		} catch {
			return NextResponse.json({ error: "Sign-in temporarily unavailable" }, { status: 503 });
		}
	}
	return handlers.POST(request);
}
