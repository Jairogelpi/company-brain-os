import { beforeEach, describe, expect, it, vi } from "vitest";

const { createDbMock, hashMock, checkRateLimitMock } = vi.hoisted(() => ({
	createDbMock: vi.fn(),
	hashMock: vi.fn(async () => "$2b$10$hashed-password"),
	checkRateLimitMock: vi.fn(),
}));

vi.mock("@/db", () => ({ createDb: createDbMock }));
vi.mock("bcryptjs", () => ({ hash: hashMock }));
vi.mock("@/lib/rate-limiter", () => ({
	checkDistributedRateLimit: checkRateLimitMock,
}));

type FakeDbOptions = {
	emailRows?: unknown[];
	slugRows?: unknown[];
	transactionError?: unknown;
};

function makeFakeDb(opts: FakeDbOptions = {}) {
	const selectResults = [opts.emailRows ?? [], opts.slugRows ?? []];
	const insertedCompanies: unknown[] = [];
	const insertedUsers: unknown[] = [];
	let insertCall = 0;
	const tx = {
		insert: vi.fn(() => {
			const call = insertCall++;
			return {
				values: vi.fn((value: unknown) => {
					if (call === 0) {
						insertedCompanies.push(value);
						return undefined;
					}
					insertedUsers.push(value);
					return {
						returning: async () => [
							{
								...(value as object),
								id: "user-1",
								email: "owner@example.com",
								role: "owner",
								companyId: "acme-corp",
							},
						],
					};
				}),
			};
		}),
	};
	return {
		insertedCompanies,
		insertedUsers,
		select: vi.fn(() => ({
			from: () => ({
				where: () => ({
					limit: async () => selectResults.shift() ?? [],
				}),
			}),
		})),
		transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => unknown) => {
			if (opts.transactionError) throw opts.transactionError;
			return cb(tx);
		}),
	};
}

async function post(body: unknown) {
	const { POST } = await import("./route");
	return POST(
		new Request("http://local/api/auth/register", {
			method: "POST",
			body: JSON.stringify(body),
		}),
	);
}

const validBody = {
	email: "Owner@Example.com",
	password: "correct-horse-battery",
	companyName: "Acme Corp",
	slug: "acme-corp",
};

describe("POST /api/auth/register", () => {
	beforeEach(() => {
		vi.resetModules();
		createDbMock.mockReset();
		checkRateLimitMock.mockReset().mockResolvedValue({
			allowed: true,
			remaining: 2,
			retryAfter: 0,
		});
		hashMock.mockClear();
		hashMock.mockResolvedValue("$2b$10$hashed-password");
	});

	it("creates a company and owner user", async () => {
		const db = makeFakeDb();
		createDbMock.mockReturnValue(db);

		const res = await post(validBody);
		const json = await res.json();

		expect(res.status).toBe(201);
		expect(json).toEqual({
			id: "user-1",
			email: "owner@example.com",
			role: "owner",
			companyId: "acme-corp",
		});
		expect(hashMock).toHaveBeenCalledWith("correct-horse-battery", 12);
		expect(db.insertedCompanies).toHaveLength(1);
		expect(db.insertedUsers).toEqual([
			expect.objectContaining({
				email: "owner@example.com",
				passwordHash: "$2b$10$hashed-password",
				role: "owner",
				validationDomains: ["*"],
				companyId: "acme-corp",
			}),
		]);
		expect(JSON.stringify(json)).not.toContain("password");
	});

	it("rate-limits repeated signup attempts before reading business data", async () => {
		checkRateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 30 });
		const res = await post(validBody);
		expect(res.status).toBe(429);
		expect(res.headers.get("retry-after")).toBe("30");
		expect(createDbMock).not.toHaveBeenCalled();
	});

	it("rejects duplicate email without inserting", async () => {
		const db = makeFakeDb({ emailRows: [{ id: "existing" }] });
		createDbMock.mockReturnValue(db);

		const res = await post(validBody);

		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: "Conflict", field: "email" });
		expect(db.transaction).not.toHaveBeenCalled();
	});

	it("rejects duplicate slug without inserting", async () => {
		const db = makeFakeDb({ slugRows: [{ id: "acme-corp" }] });
		createDbMock.mockReturnValue(db);

		const res = await post(validBody);

		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: "Conflict", field: "slug" });
		expect(db.transaction).not.toHaveBeenCalled();
	});

	it.each([
		["email", { ...validBody, email: "bad" }],
		["password", { ...validBody, password: "short" }],
		["companyName", { ...validBody, companyName: "" }],
		["slug", { ...validBody, slug: "Bad Slug!" }],
	])("returns 422 for invalid %s", async (field, body) => {
		createDbMock.mockReturnValue(makeFakeDb());
		const res = await post(body);
		expect(res.status).toBe(422);
		expect(await res.json()).toEqual({ error: "Invalid signup", field });
	});

	it.each([
		["users_email_unique", "email"],
		["companies_slug_unique", "slug"],
		["companies_pkey", "slug"],
	])("maps unique violation %s to field %s", async (constraint, field) => {
		const db = makeFakeDb({ transactionError: { code: "23505", constraint } });
		createDbMock.mockReturnValue(db);

		const res = await post(validBody);

		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: "Conflict", field });
	});

	it("does not mask unknown unique violations as slug conflicts", async () => {
		const error = { code: "23505", constraint: "some_other_unique" };
		const db = makeFakeDb({ transactionError: error });
		createDbMock.mockReturnValue(db);

		await expect(post(validBody)).rejects.toEqual(error);
	});
});
