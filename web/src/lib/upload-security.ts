import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createConnection } from "node:net";

const SAFE_NAME = /^[a-f0-9-]{36}\.[a-z0-9]+$/i;

export function tenantStorageKey(organizationId: string, filename: string): string {
	if (!organizationId.trim()) throw new Error("organizationId is required");
	if (!SAFE_NAME.test(filename)) throw new Error("Invalid filename");
	const tenantPartition = createHash("sha256").update(organizationId).digest("hex").slice(0, 32);
	return `organizations/${tenantPartition}/${filename}`;
}

function signingSecret(): string {
	const secret = process.env.UPLOAD_URL_SIGNING_SECRET ?? process.env.AUTH_SECRET;
	if (secret && secret.length >= 32) return secret;
	if (process.env.NODE_ENV === "production") {
		throw new Error("UPLOAD_URL_SIGNING_SECRET or AUTH_SECRET must contain at least 32 characters");
	}
	return "development-only-upload-url-secret";
}

function signature(organizationId: string, filename: string, expires: number): string {
	return createHmac("sha256", signingSecret())
		.update(`${organizationId}\n${filename}\n${expires}`)
		.digest("hex");
}

export function createSignedUploadUrl(
	organizationId: string,
	filename: string,
	now = Date.now(),
	ttlSeconds = 15 * 60,
): string {
	tenantStorageKey(organizationId, filename);
	const expires = Math.floor(now / 1000) + ttlSeconds;
	return `/api/upload/${filename}?expires=${expires}&signature=${signature(organizationId, filename, expires)}`;
}

export function verifySignedUploadUrl(
	organizationId: string,
	urlOrPath: string,
	now = Date.now(),
): boolean {
	try {
		const url = new URL(urlOrPath, "http://company-brain.local");
		const filename = url.pathname.split("/").pop() ?? "";
		tenantStorageKey(organizationId, filename);
		const expires = Number(url.searchParams.get("expires"));
		const provided = url.searchParams.get("signature") ?? "";
		if (!Number.isInteger(expires) || expires < Math.floor(now / 1000) || !/^[a-f0-9]{64}$/i.test(provided)) return false;
		const expected = signature(organizationId, filename, expires);
		return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
	} catch {
		return false;
	}
}

export function refreshStoredUploadUrl(
	organizationId: string,
	storedUrl: string | undefined,
): string | undefined {
	if (!storedUrl) return undefined;
	const filename = new URL(storedUrl, "http://company-brain.local").pathname.split("/").pop() ?? "";
	try {
		return createSignedUploadUrl(organizationId, filename);
	} catch {
		return undefined;
	}
}

export type MalwareScanResult =
	| { clean: true; provider: "basic" | "clamav" }
	| { clean: false; provider: "basic" | "clamav"; signature: string };

function basicScan(buffer: Buffer): MalwareScanResult {
	const eicarMarker = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";
	return buffer.includes(Buffer.from(eicarMarker))
		? { clean: false, provider: "basic", signature: "Eicar-Test-Signature" }
		: { clean: true, provider: "basic" };
}

async function clamAvScan(buffer: Buffer): Promise<MalwareScanResult> {
	const host = process.env.CLAMAV_HOST ?? "clamav";
	const port = Number(process.env.CLAMAV_PORT) || 3310;
	const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS) || 15_000;
	return new Promise((resolve, reject) => {
		const socket = createConnection({ host, port });
		const responses: Buffer[] = [];
		const timeout = setTimeout(() => socket.destroy(new Error("ClamAV scan timed out")), timeoutMs);
		socket.on("connect", () => {
			socket.write("zINSTREAM\0");
			for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
				const chunk = buffer.subarray(offset, offset + 64 * 1024);
				const size = Buffer.alloc(4);
				size.writeUInt32BE(chunk.length);
				socket.write(size);
				socket.write(chunk);
			}
			socket.end(Buffer.alloc(4));
		});
		socket.on("data", (chunk) => responses.push(
			typeof chunk === "string" ? Buffer.from(chunk) : chunk,
		));
		socket.on("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		socket.on("close", () => {
			clearTimeout(timeout);
			const response = Buffer.concat(responses).toString("utf8").replace(/\0/g, "").trim();
			if (response.endsWith("OK")) resolve({ clean: true, provider: "clamav" });
			else if (response.includes("FOUND")) {
				const signature = response.match(/: (.+) FOUND/)?.[1] ?? "malware";
				resolve({ clean: false, provider: "clamav", signature });
			} else if (response) reject(new Error(`Unexpected ClamAV response: ${response}`));
			else reject(new Error("ClamAV closed without a response"));
		});
	});
}

export async function scanUpload(buffer: Buffer): Promise<MalwareScanResult> {
	const basic = basicScan(buffer);
	if (!basic.clean) return basic;
	const mode = process.env.MALWARE_SCAN_MODE ?? (process.env.NODE_ENV === "production" ? "clamav" : "basic");
	if (mode === "basic" && process.env.NODE_ENV !== "production") return basic;
	if (mode !== "clamav") throw new Error("Production uploads require MALWARE_SCAN_MODE=clamav");
	return clamAvScan(buffer);
}
