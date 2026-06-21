CREATE TYPE "public"."criticality" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."edge_type" AS ENUM('MASTERS', 'LEARNS', 'REQUIRES', 'EXECUTES', 'PRODUCES', 'DEPENDS_ON', 'BELONGS_TO');--> statement-breakpoint
CREATE TYPE "public"."knowledge_type" AS ENUM('technical', 'process', 'rule', 'value', 'policy');--> statement-breakpoint
CREATE TYPE "public"."node_type" AS ENUM('Person', 'Knowledge', 'Process', 'Asset', 'Unit', 'Risk');--> statement-breakpoint
CREATE TYPE "public"."validation_state" AS ENUM('draft', 'proposed', 'validated', 'retired');--> statement-breakpoint
CREATE TABLE "edges" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"type" "edge_type" NOT NULL,
	"from_node_id" text NOT NULL,
	"to_node_id" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_log" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"actor_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_layout" (
	"node_id" text PRIMARY KEY NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"color" text,
	"collapsed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text DEFAULT 'default' NOT NULL,
	"type" "node_type" NOT NULL,
	"name" text NOT NULL,
	"criticality" "criticality",
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"knowledge_type" "knowledge_type",
	"documented" boolean,
	"validation_state" "validation_state",
	"confidence" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_from_node_id_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_to_node_id_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_layout" ADD CONSTRAINT "node_layout_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edges_company_idx" ON "edges" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "edges_type_idx" ON "edges" USING btree ("type");--> statement-breakpoint
CREATE INDEX "edges_from_idx" ON "edges" USING btree ("from_node_id");--> statement-breakpoint
CREATE INDEX "edges_to_idx" ON "edges" USING btree ("to_node_id");--> statement-breakpoint
CREATE INDEX "event_log_company_idx" ON "event_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "event_log_created_at_idx" ON "event_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "node_layout_company_idx" ON "node_layout" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "nodes_company_idx" ON "nodes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "nodes_type_idx" ON "nodes" USING btree ("type");