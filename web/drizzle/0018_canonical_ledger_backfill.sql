-- Complete the V4 relationship vocabulary. These values become available to
-- application writes after this migration commits.
ALTER TYPE "edge_type" ADD VALUE IF NOT EXISTS 'INTERACTS_WITH';
--> statement-breakpoint
ALTER TYPE "edge_type" ADD VALUE IF NOT EXISTS 'REPLACES';
--> statement-breakpoint
ALTER TYPE "edge_type" ADD VALUE IF NOT EXISTS 'VALIDATES';
--> statement-breakpoint

-- One auditable source per tenant records the one-time import from the legacy
-- mutable graph. Imported claims are explicitly unverified and due for review;
-- no future application path is allowed to write the projection directly.
INSERT INTO "evidence_sources" (id, organization_id, type, created_by)
SELECT 'legacy-graph-source:' || c.id, c.id, 'legacy_graph_migration', 'system:migration-0018'
FROM "companies" c
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "evidence_items" (id, organization_id, source_id, content_hash, metadata)
SELECT
  'legacy-node-item:' || n.id,
  n.company_id,
  'legacy-graph-source:' || n.company_id,
  md5(to_jsonb(n)::text),
  jsonb_build_object('legacyTable', 'nodes', 'legacyId', n.id)
FROM "nodes" n
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "evidence_items" (id, organization_id, source_id, content_hash, metadata)
SELECT
  'legacy-edge-item:' || e.id,
  e.company_id,
  'legacy-graph-source:' || e.company_id,
  md5(to_jsonb(e)::text),
  jsonb_build_object('legacyTable', 'edges', 'legacyId', e.id)
FROM "edges" e
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "assertions" (
  id, organization_id, subject_entity_id, predicate, scalar_value,
  source_type, source_id, status, proposed_by, approved_by, confidence_class,
  review_due_at, metadata
)
SELECT
  'legacy-node-assertion:' || n.id || ':' || claim.predicate,
  n.company_id,
  n.id,
  claim.predicate,
  claim.scalar_value,
  'legacy_graph_migration',
  'legacy-node-item:' || n.id,
  CASE WHEN n.archived THEN 'archived'::assertion_status ELSE 'approved'::assertion_status END,
  'system:migration-0018',
  CASE WHEN n.archived THEN NULL ELSE 'system:migration-0018' END,
  'unverified'::confidence_class,
  now(),
  claim.metadata
FROM "nodes" n
CROSS JOIN LATERAL (
  VALUES
    ('ENTITY_TYPE', to_jsonb(n.type::text), '{}'::jsonb),
    ('ENTITY_NAME', to_jsonb(n.name), '{}'::jsonb),
    ('CRITICALITY', to_jsonb(n.criticality::text), '{}'::jsonb),
    ('NODE_ATTRIBUTES', 'true'::jsonb, jsonb_build_object('nodeAttributes', n.attributes)),
    ('KNOWLEDGE_TYPE', to_jsonb(n.knowledge_type::text), '{}'::jsonb),
    ('DOCUMENTED', to_jsonb(n.documented), '{}'::jsonb),
    ('VALIDATION_STATE', to_jsonb(n.validation_state::text), '{}'::jsonb),
    ('CONFIDENCE', to_jsonb(n.confidence), '{}'::jsonb)
) AS claim(predicate, scalar_value, metadata)
WHERE claim.scalar_value IS NOT NULL
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "assertions" (
  id, organization_id, subject_entity_id, predicate, object_entity_id,
  source_type, source_id, status, proposed_by, approved_by, confidence_class,
  review_due_at, metadata
)
SELECT
  'legacy-edge-assertion:' || e.id,
  e.company_id,
  e.from_node_id,
  e.type::text,
  e.to_node_id,
  'legacy_graph_migration',
  'legacy-edge-item:' || e.id,
  CASE WHEN e.archived THEN 'archived'::assertion_status ELSE 'approved'::assertion_status END,
  'system:migration-0018',
  CASE WHEN e.archived THEN NULL ELSE 'system:migration-0018' END,
  'unverified'::confidence_class,
  now(),
  jsonb_build_object('originalEdgeId', e.id, 'edgeAttributes', e.attributes)
FROM "edges" e
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "assertion_evidence" (
  id, organization_id, assertion_id, evidence_item_id
)
SELECT
  'legacy-node-link:' || n.id || ':' || claim.predicate,
  n.company_id,
  'legacy-node-assertion:' || n.id || ':' || claim.predicate,
  'legacy-node-item:' || n.id
FROM "nodes" n
CROSS JOIN LATERAL (
  VALUES
    ('ENTITY_TYPE', to_jsonb(n.type::text)),
    ('ENTITY_NAME', to_jsonb(n.name)),
    ('CRITICALITY', to_jsonb(n.criticality::text)),
    ('NODE_ATTRIBUTES', 'true'::jsonb),
    ('KNOWLEDGE_TYPE', to_jsonb(n.knowledge_type::text)),
    ('DOCUMENTED', to_jsonb(n.documented)),
    ('VALIDATION_STATE', to_jsonb(n.validation_state::text)),
    ('CONFIDENCE', to_jsonb(n.confidence))
) AS claim(predicate, scalar_value)
WHERE claim.scalar_value IS NOT NULL
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO "assertion_evidence" (
  id, organization_id, assertion_id, evidence_item_id
)
SELECT
  'legacy-edge-link:' || e.id,
  e.company_id,
  'legacy-edge-assertion:' || e.id,
  'legacy-edge-item:' || e.id
FROM "edges" e
ON CONFLICT (id) DO NOTHING;
