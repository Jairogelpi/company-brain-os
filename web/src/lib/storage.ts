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

import { writeFile, readFile, mkdir, stat, unlink } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join, resolve, sep } from "path";
import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	DeleteObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

export interface StorageAdapter {
	put(key: string, body: Buffer, contentType?: string): Promise<void>;
	get(key: string): Promise<Buffer | null>;
	exists(key: string): Promise<boolean>;
	size(key: string): Promise<number | null>;
	delete(key: string): Promise<void>;
}

// --- Disk adapter (default) ---

function createDiskAdapter(): StorageAdapter {
	const dir = resolve(process.env.STORAGE_DIR ?? join(process.cwd(), "uploads"));
	function objectPath(key: string): string {
		const path = resolve(dir, key);
		if (path !== dir && !path.startsWith(`${dir}${sep}`)) {
			throw new Error("Invalid storage key");
		}
		return path;
	}

	return {
		async put(key, body) {
			const path = objectPath(key);
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, body, { flag: "wx", mode: 0o600 });
		},
		async get(key) {
			const path = objectPath(key);
			if (!existsSync(path)) return null;
			return readFile(path);
		},
		async exists(key) {
			return existsSync(objectPath(key));
		},
		async size(key) {
			const path = objectPath(key);
			if (!existsSync(path)) return null;
			return (await stat(path)).size;
		},
		async delete(key) {
			const path = objectPath(key);
			if (existsSync(path)) await unlink(path);
		},
	};
}

// --- S3 adapter (optional, lazily loaded) ---

function createS3Adapter(): StorageAdapter {
	const bucket = process.env.S3_BUCKET;
	const region = process.env.S3_REGION ?? "us-east-1";
	const endpoint = process.env.S3_ENDPOINT; // for R2/MinIO
	const serverSideEncryption = process.env.S3_SERVER_SIDE_ENCRYPTION as
		| "AES256"
		| "aws:kms"
		| undefined;
	const kmsKeyId = process.env.S3_KMS_KEY_ID;
	if (!bucket) {
		throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET to be set.");
	}

	const s3 = new S3Client({
		region,
		...(endpoint ? { endpoint, forcePathStyle: true } : {}),
	});

	return {
		async put(key, body, contentType) {
			await s3.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: body,
					ContentType: contentType,
					...(serverSideEncryption
						? {
							ServerSideEncryption: serverSideEncryption,
							...(serverSideEncryption === "aws:kms" && kmsKeyId
								? { SSEKMSKeyId: kmsKeyId }
								: {}),
						}
						: {}),
				}),
			);
		},
		async get(key) {
			try {
				const res = await s3.send(
					new GetObjectCommand({ Bucket: bucket, Key: key }),
				);
				const bytes = await res.Body?.transformToByteArray();
				return bytes ? Buffer.from(bytes) : null;
			} catch {
				return null;
			}
		},
		async exists(key) {
			try {
				await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
				return true;
			} catch {
				return false;
			}
		},
		async size(key) {
			try {
				const res = await s3.send(
					new HeadObjectCommand({ Bucket: bucket, Key: key }),
				);
				return typeof res.ContentLength === "number" ? res.ContentLength : null;
			} catch {
				return null;
			}
		},
		async delete(key) {
			await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
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
