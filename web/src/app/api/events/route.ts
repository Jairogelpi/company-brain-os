import { NextResponse } from "next/server";
import { addClient, removeClient } from "@/lib/sse-bus";
import { requireApiUser } from "@/auth/api-guard";

export async function GET() {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;

	const stream = new ReadableStream({
		start(controller) {
			addClient(controller);
			const data = `data: ${JSON.stringify({ type: "connected", payload: {} })}\n\n`;
			controller.enqueue(new TextEncoder().encode(data));
		},
		cancel(controller) {
			removeClient(controller);
		},
	});

	return new NextResponse(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
