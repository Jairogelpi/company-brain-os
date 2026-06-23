import {
	TranscriptionError,
	transcriptionService,
	type TranscriptionProvider,
	type TranscriptionService,
} from "@/ai/transcription";
import { ingestText } from "@/domain/ingest";
import { savePending } from "@/server/ingestion";
import {
	defaultTranscriptionJobStore,
	type TranscriptionJob,
	type TranscriptionJobStore,
} from "./transcription-jobs";

export type StopFn = () => void;

type IngestTextFn = typeof ingestText;
type SavePendingFn = typeof savePending;

export interface TranscriptionWorkerOptions {
	store?: TranscriptionJobStore;
	service?: TranscriptionService;
	ingest?: IngestTextFn;
	save?: SavePendingFn;
	batchSize?: number;
}

function failureReason(err: unknown): string {
	if (err instanceof TranscriptionError) return `${err.code}: ${err.message}`;
	if (err instanceof Error) return err.message;
	return "transcription failed";
}

async function completeWithTranscript(
	job: TranscriptionJob,
	provider: TranscriptionProvider,
	text: string,
	noSpeech: boolean,
	options: Required<
		Pick<TranscriptionWorkerOptions, "store" | "ingest" | "save">
	>,
): Promise<void> {
	await options.store.updateStatus(job.id, "completed", {
		transcript: text,
		provider,
		noSpeech,
		failReason: null,
	});

	if (noSpeech || text.trim() === "") return;

	const result = options.ingest(text, { source: job.source });
	await options.save(
		job.companyId,
		job.source,
		"text",
		result.proposals.map((p) => p.proposal),
	);
}

export async function runTranscriptionWorkerOnce(
	options: TranscriptionWorkerOptions = {},
): Promise<void> {
	const store = options.store ?? defaultTranscriptionJobStore;
	const service = options.service ?? transcriptionService;
	const ingest = options.ingest ?? ingestText;
	const save = options.save ?? savePending;
	const jobs = await store.claimQueued(options.batchSize ?? 1);

	for (const job of jobs) {
		try {
			const result = await service.transcribe(job.storageKey, job.mimeType);
			if (result.provider === "unavailable") {
				await store.updateStatus(job.id, "failed", {
					failReason: "transcription provider unavailable",
					provider: "unavailable",
				});
				continue;
			}
			await completeWithTranscript(
				job,
				result.provider,
				result.text,
				result.noSpeech === true || result.text.trim() === "",
				{ store, ingest, save },
			);
		} catch (err) {
			await store.updateStatus(job.id, "failed", {
				failReason: failureReason(err),
			});
		}
	}
}

export function startTranscriptionWorker(
	options: TranscriptionWorkerOptions & {
		intervalMs?: number;
		runOnce?: () => Promise<void>;
	} = {},
): StopFn {
	const store = options.store ?? defaultTranscriptionJobStore;
	const configuredInterval =
		options.intervalMs ?? Number(process.env.TRANSCRIPTION_WORKER_INTERVAL_MS);
	const intervalMs = configuredInterval || 5000;
	void store.reclaimProcessing();
	const runOnce =
		options.runOnce ??
		(() => runTranscriptionWorkerOnce({ ...options, store }));
	const timer = setInterval(() => {
		void runOnce();
	}, intervalMs);
	return () => clearInterval(timer);
}
