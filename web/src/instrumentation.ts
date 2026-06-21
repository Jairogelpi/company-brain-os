import { ensureTranscriptionWorkerStarted } from "@/server/transcription-bootstrap";

export async function register() {
	if (process.env.NEXT_RUNTIME === "edge") return;
	ensureTranscriptionWorkerStarted();
}
