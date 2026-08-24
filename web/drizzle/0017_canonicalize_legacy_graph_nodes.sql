-- Risks are derived from approved facts; they are not organizational nodes.
-- Legacy Unit/Client/Supplier rows are converted by the post-deploy task after
-- the enum additions from 0015 have committed.
UPDATE "edges"
SET "archived" = true
WHERE "archived" = false
  AND ("from_node_id" IN (SELECT id FROM "nodes" WHERE type = 'Risk')
    OR "to_node_id" IN (SELECT id FROM "nodes" WHERE type = 'Risk'));
--> statement-breakpoint
UPDATE "nodes"
SET "archived" = true
WHERE "type" = 'Risk' AND "archived" = false;
