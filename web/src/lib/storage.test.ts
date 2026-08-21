import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStorage, resetStorageForTests } from "./storage";

describe("disk storage", () => {
	afterEach(async () => {
		const dir = process.env.STORAGE_DIR;
		delete process.env.STORAGE_DIR;
		resetStorageForTests();
		if (dir) await rm(dir, { recursive: true, force: true });
	});

	it("reports stored object size", async () => {
		process.env.STORAGE_DIR = await mkdtemp(
			join(tmpdir(), "company-brain-os-"),
		);
		resetStorageForTests();
		const storage = getStorage();

		await storage.put("clip.mp3", Buffer.from("hello"), "audio/mpeg");

		await expect(storage.size("clip.mp3")).resolves.toBe(5);
		await expect(storage.size("missing.mp3")).resolves.toBeNull();
	});

	it("supports tenant partitions and rejects traversal keys", async () => {
		process.env.STORAGE_DIR = await mkdtemp(join(tmpdir(), "company-brain-os-"));
		resetStorageForTests();
		const storage = getStorage();
		await storage.put("organizations/tenant/clip.mp3", Buffer.from("hello"));

		await expect(storage.get("organizations/tenant/clip.mp3")).resolves.toEqual(Buffer.from("hello"));
		await expect(storage.put("../escape", Buffer.from("bad"))).rejects.toThrow("Invalid storage key");
	});
});
