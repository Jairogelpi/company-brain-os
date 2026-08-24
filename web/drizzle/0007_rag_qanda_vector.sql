-- 0007_rag_qanda_vector.sql
-- Fresh-install-safe pgvector bootstrap and embedding conversion.
-- This migration is journaled before any later tenant hardening that expects
-- node_embeddings to exist and before the final idempotent pgvector guard in 0027.

CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

-- Drop rows whose jsonb array length != 768, logging the count.
DO $$
DECLARE
  dropped_count integer;
BEGIN
  DELETE FROM node_embeddings
  WHERE jsonb_typeof(embedding) <> 'array'
     OR jsonb_array_length(embedding) <> 768;
  GET DIAGNOSTICS dropped_count = ROW_COUNT;
  RAISE NOTICE 'add-rag-qanda: dropped % node_embeddings rows with dim != 768', dropped_count;
END$$;
--> statement-breakpoint

ALTER TABLE node_embeddings
  ALTER COLUMN embedding TYPE vector(768)
  USING (embedding::text::vector(768));
--> statement-breakpoint

-- Drizzle executes PostgreSQL migrations transactionally, so CONCURRENTLY is
-- not valid here. Fresh installs have no production write load at this point.
CREATE INDEX IF NOT EXISTS node_embeddings_embedding_hnsw_idx
  ON node_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
