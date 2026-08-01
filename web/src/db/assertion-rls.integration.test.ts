import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
const suffix = randomUUID().replaceAll("-", "");
const orgA = `rls-a-${suffix}`;
const orgB = `rls-b-${suffix}`;
const role = `rls_${suffix}`;
let admin: Client;

describe.skipIf(!databaseUrl)("assertion ledger RLS", () => {
	beforeAll(async () => {
		admin = new Client({ connectionString: databaseUrl });
		await admin.connect();
		await admin.query("insert into companies (id, name, slug) values ($1, $2, $3), ($4, $5, $6)", [orgA, orgA, orgA, orgB, orgB, orgB]);
		await admin.query(`create role ${role} login password 'rls-test-password'`);
		await admin.query(`grant usage on schema public to ${role}`);
		await admin.query(`grant select, insert on assertions to ${role}`);
		await admin.query("begin");
		await admin.query("select set_config('app.organization_id', $1, true)", [orgA]);
		await admin.query("insert into assertions (id, organization_id, subject_entity_id, predicate, source_type, source_id, status, proposed_by, confidence_class, metadata) values ($1, $2, 'person', 'MASTERS', 'test', 'source-a', 'approved', 'owner', 'verified', '{}'::jsonb)", [`assertion-${suffix}`, orgA]);
		await admin.query("commit");
	});

	afterAll(async () => {
		if (!admin) return;
		await admin.query("delete from assertions where id = $1", [`assertion-${suffix}`]);
		await admin.query(`revoke all privileges on assertions from ${role}`);
		await admin.query(`revoke usage on schema public from ${role}`);
		await admin.query(`drop role if exists ${role}`);
		await admin.query("delete from companies where id in ($1, $2)", [orgA, orgB]);
		await admin.end();
	});

	it("denies cross-tenant reads and writes", async () => {
		const app = new Client({ connectionString: databaseUrl });
		await app.connect();
		await app.query(`set role ${role}`);
		await app.query("begin");
		await app.query("select set_config('app.organization_id', $1, true)", [orgB]);
		const hidden = await app.query("select count(*)::int as count from assertions");
		expect(hidden.rows[0].count).toBe(0);
		await expect(app.query("insert into assertions (id, organization_id, subject_entity_id, predicate, source_type, source_id, status, proposed_by, confidence_class, metadata) values ($1, $2, 'person', 'MASTERS', 'test', 'source-b', 'approved', 'owner', 'verified', '{}'::jsonb)", [`cross-${suffix}`, orgA])).rejects.toThrow(/row-level security/i);
		await app.query("rollback");
		await app.end();
	});
});
