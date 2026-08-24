-- pgvector is a required production dependency. Earlier testcontainer setup
-- created it out of band and migration 0007 was not registered in the journal,
-- so a fresh deployed database could retain the legacy jsonb column.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

DO $$
DECLARE
  embedding_type text;
BEGIN
  SELECT data_type INTO embedding_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'node_embeddings'
    AND column_name = 'embedding';

  IF embedding_type = 'jsonb' THEN
    DELETE FROM "node_embeddings"
    WHERE jsonb_typeof("embedding") <> 'array'
       OR jsonb_array_length("embedding") <> 768;

    ALTER TABLE "node_embeddings"
      ALTER COLUMN "embedding" TYPE vector(768)
      USING ("embedding"::text::vector(768));
  ELSIF embedding_type <> 'USER-DEFINED' THEN
    RAISE EXCEPTION 'Unsupported node_embeddings.embedding type: %', embedding_type;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "node_embeddings_embedding_hnsw_idx"
  ON "node_embeddings" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
