-- 0007_rag_qanda_vector.sql
-- Convert node_embeddings.embedding from jsonb to vector(768) + HNSW cosine index.
--
-- Destructive for mismatched-dimension rows; see design §2.4 for rollback.
--
-- Pre-flight (operator-run, optional safety net):
--   CREATE TABLE node_embeddings_pre_rag_backup AS SELECT * FROM node_embeddings;
-- Smoke check (operator-run):
--   SELECT count(*) FROM node_embeddings
--   WHERE jsonb_array_length(embedding) <> 768;
--
-- Rollback (operator-run, NOT automated — dropped mismatched-dimension rows
-- are not recovered):
--   DROP INDEX CONCURRENTLY IF EXISTS node_embeddings_embedding_hnsw_idx;
--   ALTER TABLE node_embeddings
--     ALTER COLUMN embedding TYPE jsonb
--     USING (to_jsonb(embedding));

-- 1. Drop rows whose jsonb array length != 768, logging the count.
DO $$
DECLARE
  dropped_count integer;
BEGIN
  DELETE FROM node_embeddings
  WHERE jsonb_array_length(embedding) <> 768;
  GET DIAGNOSTICS dropped_count = ROW_COUNT;
  RAISE NOTICE 'add-rag-qanda: dropped % node_embeddings rows with dim != 768', dropped_count;
END$$;

--> statement-breakpoint

-- 2. Cast the column in place. jsonb numeric arrays cast cleanly to vector(768).
ALTER TABLE node_embeddings
  ALTER COLUMN embedding TYPE vector(768)
  USING (embedding::vector(768));

--> statement-breakpoint

-- 3. HNSW cosine index, built CONCURRENTLY to avoid blocking writes.
--    m=16, ef_construction=64 per spec decision resolution #2.
--    Cannot run inside a transaction block; Drizzle applies each
--    statement-breakpoint segment separately.
CREATE INDEX CONCURRENTLY IF NOT EXISTS node_embeddings_embedding_hnsw_idx
  ON node_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
