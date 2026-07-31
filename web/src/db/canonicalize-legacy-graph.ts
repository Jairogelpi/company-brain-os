import { sql } from "drizzle-orm";

type SqlExecutor = {
	execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

/**
 * Runs after migrations have committed, because PostgreSQL does not allow a
 * freshly added enum value to be used in the same migration transaction.
 */
export async function canonicalizeLegacyGraphNodes(db: SqlExecutor): Promise<void> {
	await db.execute(sql`
		UPDATE "nodes"
		SET "type" = 'OrganizationalUnit'
		WHERE "type" = 'Unit' AND "archived" = false
	`);
	await db.execute(sql`
		UPDATE "nodes"
		SET "type" = 'ExternalParty',
			"attributes" = "attributes" || jsonb_build_object('subtype', 'client')
		WHERE "type" = 'Client' AND "archived" = false
	`);
	await db.execute(sql`
		UPDATE "nodes"
		SET "type" = 'ExternalParty',
			"attributes" = "attributes" || jsonb_build_object('subtype', 'supplier')
		WHERE "type" = 'Supplier' AND "archived" = false
	`);
	await db.execute(sql`
		UPDATE "edges"
		SET "archived" = true
		WHERE "archived" = false
		  AND ("from_node_id" IN (SELECT id FROM "nodes" WHERE type = 'Risk')
			OR "to_node_id" IN (SELECT id FROM "nodes" WHERE type = 'Risk'))
	`);
	await db.execute(sql`
		UPDATE "nodes"
		SET "archived" = true
		WHERE "type" = 'Risk' AND "archived" = false
	`);
}
