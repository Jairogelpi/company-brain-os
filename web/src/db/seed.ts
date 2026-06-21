/**
 * Seed script — creates the demo company and demo users with hashed passwords.
 *
 * Usage:  npx tsx src/db/seed.ts
 *
 * Passwords come from SEED_PASSWORD (env). If unset, a default is used and a
 * warning is printed — DO NOT rely on the default in production.
 */

import { hash } from "bcryptjs";
import { createDb } from "./index";
import { companies, users } from "./schema";

type SeedUser = {
	id: string;
	name: string;
	email: string;
	role: "owner" | "validator" | "contributor" | "viewer";
	validationDomains: string[];
};

const DEMO_COMPANY = {
	id: "demo-corp",
	name: "Demo Corporation",
	slug: "demo-corp",
};

const SEED_USERS: SeedUser[] = [
	{
		id: "user-owner",
		name: "Admin",
		email: "admin@companybrain.os",
		role: "owner",
		validationDomains: ["*"],
	},
	{
		id: "user-validator",
		name: "María Validadora",
		email: "maria@companybrain.os",
		role: "validator",
		validationDomains: ["producción", "calidad"],
	},
	{
		id: "user-contributor",
		name: "Pedro",
		email: "pedro@companybrain.os",
		role: "contributor",
		validationDomains: [],
	},
	{
		id: "user-viewer",
		name: "Laura",
		email: "laura@companybrain.os",
		role: "viewer",
		validationDomains: [],
	},
];

export async function seed(): Promise<void> {
	const db = createDb();
	const password = process.env.SEED_PASSWORD;
	if (!password) {
		console.warn(
			"⚠  SEED_PASSWORD not set — using default 'demo1234'. Set SEED_PASSWORD in production.",
		);
	}
	const plain = password ?? "demo1234";
	const passwordHash = await hash(plain, 10);

	// Company (idempotent)
	await db
		.insert(companies)
		.values({ ...DEMO_COMPANY })
		.onConflictDoNothing();

	// Users (idempotent on id; refresh password hash + role each run)
	for (const u of SEED_USERS) {
		await db
			.insert(users)
			.values({
				id: u.id,
				email: u.email,
				name: u.name,
				passwordHash,
				companyId: DEMO_COMPANY.id,
				role: u.role,
				validationDomains: u.validationDomains,
			})
			.onConflictDoUpdate({
				target: users.id,
				set: { passwordHash, role: u.role, name: u.name },
			});
	}

	console.log(
		`Seeded company "${DEMO_COMPANY.id}" and ${SEED_USERS.length} users.`,
	);
	console.log("Demo logins (password = SEED_PASSWORD or 'demo1234'):");
	for (const u of SEED_USERS) console.log(`  ${u.email}  [${u.role}]`);
}

if (process.argv[1]?.includes("seed")) {
	seed()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("Seed failed:", err);
			process.exit(1);
		});
}
