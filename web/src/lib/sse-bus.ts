/**
 * SSE event bus for real-time graph updates.
 * Shared between the SSE endpoint and the GraphService broadcast mechanism.
 */

const clients = new Set<ReadableStreamController<Uint8Array>>();

export function broadcastEvent(event: {
	type: string;
	payload: Record<string, unknown>;
}) {
	const data = `data: ${JSON.stringify(event)}\n\n`;
	const encoder = new TextEncoder();
	const encoded = encoder.encode(data);

	for (const controller of clients) {
		try {
			controller.enqueue(encoded);
		} catch {
			clients.delete(controller);
		}
	}
}

export function addClient(controller: ReadableStreamController<Uint8Array>) {
	clients.add(controller);
}

export function removeClient(controller: ReadableStreamController<Uint8Array>) {
	clients.delete(controller);
}

export function getClientCount(): number {
	return clients.size;
}
