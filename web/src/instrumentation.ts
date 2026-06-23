export async function register() {
	// Boot the transcription worker only in the Node.js server runtime. The
	// dynamic import lives inside the branch so webpack drops it (and its
	// pg/fs deps) from the edge bundle, where node builtins don't exist.
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { ensureTranscriptionWorkerStarted } = await import(
			"@/server/transcription-bootstrap"
		);
		ensureTranscriptionWorkerStarted();
	}
}
