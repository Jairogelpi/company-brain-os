-- 0011_more_node_types.sql
-- Add Client, Supplier, Project, System to the node_type enum.
ALTER TYPE "node_type" ADD VALUE IF NOT EXISTS 'Client';
--> statement-breakpoint
ALTER TYPE "node_type" ADD VALUE IF NOT EXISTS 'Supplier';
--> statement-breakpoint
ALTER TYPE "node_type" ADD VALUE IF NOT EXISTS 'Project';
--> statement-breakpoint
ALTER TYPE "node_type" ADD VALUE IF NOT EXISTS 'System';
