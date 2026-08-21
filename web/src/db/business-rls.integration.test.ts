import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
const suffix = randomUUID().replaceAll("-", "");
const orgA = `business-a-${suffix}`;
const orgB = `business-b-${suffix}`;
const role = `business_rls_${suffix}`;
let admin: Client;

describe.skipIf(!databaseUrl)("business table RLS and tenant foreign keys", () => {
	beforeAll(async () => {
		admin = new Client({ connectionString: databaseUrl });
		await admin.connect();
		await admin.query("insert into companies (id, name, slug) values ($1, $2, $3), ($4, $5, $6)", [orgA, orgA, orgA, orgB, orgB, orgB]);
		await admin.query("insert into nodes (id, company_id, type, name) values ($1, $2, 'Person', 'Pedro'), ($3, $4, 'Person', 'Laura')", [`pedro-${suffix}`, orgA, `laura-${suffix}`, orgB]);
		await admin.query("insert into users (id, email, name, password_hash, company_id, role) values ($1, $2, 'Pedro', 'not-a-login-hash', $3, 'contributor'), ($4, $5, 'Laura', 'not-a-login-hash', $6, 'contributor')", [`user-a-${suffix}`, `pedro-${suffix}@example.test`, orgA, `user-b-${suffix}`, `laura-${suffix}@example.test`, orgB]);
		await admin.query("insert into user_profiles (user_id, company_id, position, salary, person_node_id) values ($1, $2, 'Operator', 40000, $3), ($4, $5, 'Backup', 42000, $6)", [`user-a-${suffix}`, orgA, `pedro-${suffix}`, `user-b-${suffix}`, orgB, `laura-${suffix}`]);
		await admin.query("insert into user_invitations (id, company_id, email, role, token_hash, invited_by, expires_at) values ($1, $2, $3, 'contributor', $4, $5, now() + interval '1 day'), ($6, $7, $8, 'viewer', $9, $10, now() + interval '1 day')", [`invite-a-${suffix}`, orgA, `next-a-${suffix}@example.test`, `token-a-${suffix}`, `user-a-${suffix}`, `invite-b-${suffix}`, orgB, `next-b-${suffix}@example.test`, `token-b-${suffix}`, `user-b-${suffix}`]);
		await admin.query("insert into missions (id, company_id, objective, target_node_id, target_node_name, created_by) values ($1, $2, 'Transfer', $3, 'Pedro', 'owner')", [`mission-${suffix}`, orgA, `pedro-${suffix}`]);
		await admin.query("insert into transcription_jobs (id, company_id, user_id, source, storage_key, mime_type) values ($1, $2, $3, 'test-a', 'a/file.wav', 'audio/wav'), ($4, $5, $6, 'test-b', 'b/file.wav', 'audio/wav')", [`job-a-${suffix}`, orgA, `user-a-${suffix}`, `job-b-${suffix}`, orgB, `user-b-${suffix}`]);
		await admin.query("insert into notifications (id, company_id, recipient_id, channel, title, body, status, idempotency_key) values ($1, $2, $3, 'in_app', 'A', 'A', 'delivered', $4), ($5, $6, $7, 'in_app', 'B', 'B', 'delivered', $8)", [`notif-a-${suffix}`, orgA, `user-a-${suffix}`, `key-a-${suffix}`, `notif-b-${suffix}`, orgB, `user-b-${suffix}`, `key-b-${suffix}`]);
		const embedding = `[${new Array(768).fill(0).join(",")}]`;
		await admin.query("insert into node_embeddings (node_id, company_id, embedding) values ($1, $2, $3::vector), ($4, $5, $3::vector)", [`pedro-${suffix}`, orgA, embedding, `laura-${suffix}`, orgB]);
		await admin.query(`create role ${role} login password 'rls-test-password'`);
		await admin.query(`grant usage on schema public to ${role}`);
		await admin.query(`grant select, insert on nodes, edges, missions, ingestion_items, transcription_jobs, node_embeddings, notifications, user_profiles, user_invitations to ${role}`);
	});

	afterAll(async () => {
		if (!admin) return;
		await admin.query("delete from edges where id like $1", [`%${suffix}%`]);
		await admin.query("delete from notifications where id in ($1, $2)", [`notif-a-${suffix}`, `notif-b-${suffix}`]);
		await admin.query("delete from user_invitations where id in ($1, $2)", [`invite-a-${suffix}`, `invite-b-${suffix}`]);
		await admin.query("delete from transcription_jobs where id in ($1, $2)", [`job-a-${suffix}`, `job-b-${suffix}`]);
		await admin.query("delete from node_embeddings where node_id in ($1, $2)", [`pedro-${suffix}`, `laura-${suffix}`]);
		await admin.query("delete from missions where id = $1", [`mission-${suffix}`]);
		await admin.query("delete from nodes where id in ($1, $2)", [`pedro-${suffix}`, `laura-${suffix}`]);
		await admin.query("delete from users where id in ($1, $2)", [`user-a-${suffix}`, `user-b-${suffix}`]);
		await admin.query(`revoke all privileges on nodes, edges, missions, ingestion_items, transcription_jobs, node_embeddings, notifications, user_profiles, user_invitations from ${role}`);
		await admin.query(`revoke usage on schema public from ${role}`);
		await admin.query(`drop role if exists ${role}`);
		await admin.query("delete from companies where id in ($1, $2)", [orgA, orgB]);
		await admin.end();
	});

	it("hides other organizations and rejects cross-tenant writes", async () => {
		const app = new Client({ connectionString: databaseUrl });
		await app.connect();
		await app.query(`set role ${role}`);
		await app.query("begin");
		await app.query("select set_config('app.organization_id', $1, true)", [orgB]);
		const nodes = await app.query("select id from nodes order by id");
		const missions = await app.query("select id from missions");
		const jobs = await app.query("select id from transcription_jobs");
		const embeddings = await app.query("select node_id from node_embeddings");
		const notifications = await app.query("select id from notifications");
		const profiles = await app.query("select user_id, salary, person_node_id from user_profiles");
		const invitations = await app.query("select id from user_invitations");
		expect(nodes.rows).toEqual([{ id: `laura-${suffix}` }]);
		expect(missions.rows).toEqual([]);
		expect(jobs.rows).toEqual([{ id: `job-b-${suffix}` }]);
		expect(embeddings.rows).toEqual([{ node_id: `laura-${suffix}` }]);
		expect(notifications.rows).toEqual([{ id: `notif-b-${suffix}` }]);
		expect(profiles.rows).toEqual([{ user_id: `user-b-${suffix}`, salary: 42000, person_node_id: `laura-${suffix}` }]);
		expect(invitations.rows).toEqual([{ id: `invite-b-${suffix}` }]);
		await expect(app.query(
			"insert into ingestion_items (id, company_id, source, kind, proposal) values ($1, $2, 'attack', 'text', '{}'::jsonb)",
			[`cross-ingestion-${suffix}`, orgA],
		)).rejects.toThrow(/row-level security/i);
		await app.query("rollback");
		await app.end();
	});

	it("rejects an edge whose endpoint belongs to another organization", async () => {
		await expect(admin.query(
			"insert into edges (id, company_id, type, from_node_id, to_node_id) values ($1, $2, 'BACKS_UP', $3, $4)",
			[`cross-edge-${suffix}`, orgB, `laura-${suffix}`, `pedro-${suffix}`],
		)).rejects.toThrow(/foreign key/i);
	});
});
