/**
 * Storage abstraction for uploaded files.
 *
 * Driver is chosen via STORAGE_DRIVER:
 *   - "disk" (default): writes under STORAGE_DIR (./uploads). Mount a volume
 *     in production so files survive restarts.
 *   - "s3": stores in an S3-compatible bucket. Requires `@aws-sdk/client-s3`
 *     (npm i @aws-sdk/client-s3) and S3_BUCKET / S3_REGION / credentials.
 *
 * Keeping this behind an interface means the rest of the app never touches
 * the filesystem or a cloud SDK directly.
 */

import { writeFile, readFile, mkdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export interface StorageAdapter {
	put(key: string, body: Buffer, contentType?: string): Promise<void>;
	get(key: string): Promise<Buffer | null>;
	exists(key: string): Promise<boolean>;
	size(key: string): Promise<number | null>;
}

// --- Disk adapter (default) ---

function createDiskAdapter(): StorageAdapter {
	const dir = process.env.STORAGE_DIR ?? join(process.cwd(), "uploads");

	return {
		async put(key, body) {
			await mkdir(dir, { recursive: true });
			await writeFile(join(dir, key), body);
		},
		async get(key) {
			const path = join(dir, key);
			if (!existsSync(path)) return null;
			return readFile(path);
		},
		async exists(key) {
			return existsSync(join(dir, key));
		},
		async size(key) {
			const path = join(dir, key);
			if (!existsSync(path)) return null;
			return (await stat(path)).size;
		},
	};
}

// --- S3 adapter (optional, lazily loaded) ---

function createS3Adapter(): StorageAdapter {
	const bucket = process.env.S3_BUCKET;
	const region = process.env.S3_REGION ?? "us-east-1";
	const endpoint = process.env.S3_ENDPOINT; // for R2/MinIO
	if (!bucket) {
		throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET to be set.");
	}

	// Lazily import so the SDK is only required when S3 is actually used.
	// Indirect specifier keeps TS/bundler from resolving an optional dep.
	const sdkSpecifier = "@aws-sdk/client-s3";
	async function client() {
		const mod = await import(/* webpackIgnore: true */ sdkSpecifier).catch(
			() => {
				throw new Error(
					"STORAGE_DRIVER=s3 needs @aws-sdk/client-s3 (run: npm i @aws-sdk/client-s3).",
				);
			},
		);
		return {
			mod,
			s3: new mod.S3Client({
				region,
				...(endpoint ? { endpoint, forcePathStyle: true } : {}),
			}),
		};
	}

	return {
		async put(key, body, contentType) {
			const { mod, s3 } = await client();
			await s3.send(
				new mod.PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: body,
					ContentType: contentType,
				}),
			);
		},
		async get(key) {
			const { mod, s3 } = await client();
			try {
				const res = await s3.send(
					new mod.GetObjectCommand({ Bucket: bucket, Key: key }),
				);
				const bytes = await res.Body?.transformToByteArray();
				return bytes ? Buffer.from(bytes) : null;
			} catch {
				return null;
			}
		},
		async exists(key) {
			const { mod, s3 } = await client();
			try {
				await s3.send(new mod.HeadObjectCommand({ Bucket: bucket, Key: key }));
				return true;
			} catch {
				return false;
			}
		},
		async size(key) {
			const { mod, s3 } = await client();
			try {
				const res = await s3.send(
					new mod.HeadObjectCommand({ Bucket: bucket, Key: key }),
				);
				return typeof res.ContentLength === "number" ? res.ContentLength : null;
			} catch {
				return null;
			}
		},
	};
}

let cached: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
	if (cached) return cached;
	const driver = (process.env.STORAGE_DRIVER ?? "disk").toLowerCase();
	cached = driver === "s3" ? createS3Adapter() : createDiskAdapter();
	return cached;
}

export function resetStorageForTests(): void {
	cached = null;
}
