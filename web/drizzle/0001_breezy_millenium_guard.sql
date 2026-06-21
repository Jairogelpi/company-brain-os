CREATE TABLE "node_embeddings" (
	"node_id" text PRIMARY KEY NOT NULL,
	"embedding" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "node_embeddings" ADD CONSTRAINT "node_embeddings_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "node_embeddings_node_idx" ON "node_embeddings" USING btree ("node_id");