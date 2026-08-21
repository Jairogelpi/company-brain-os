import { startTranscriptionWorker } from "@/server/transcription-worker";
import { startNotificationWorker } from "@/server/notification-worker";
import { startUploadRetentionWorker } from "@/server/upload-retention-worker";

const stopTranscription = startTranscriptionWorker();
const stopNotifications = startNotificationWorker();
const stopUploadRetention = startUploadRetentionWorker();

function shutdown() {
	stopTranscription();
	stopNotifications();
	stopUploadRetention();
	process.exitCode = 0;
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
