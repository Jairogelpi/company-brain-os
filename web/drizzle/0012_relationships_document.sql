-- 0012_relationships_document.sql
-- New Document node type + people/contact/document relationships.
ALTER TYPE "node_type" ADD VALUE IF NOT EXISTS 'Document';
--> statement-breakpoint
ALTER TYPE "edge_type" ADD VALUE IF NOT EXISTS 'BACKS_UP';
--> statement-breakpoint
ALTER TYPE "edge_type" ADD VALUE IF NOT EXISTS 'OWNS';
--> statement-breakpoint
ALTER TYPE "edge_type" ADD VALUE IF NOT EXISTS 'MANAGES';
--> statement-breakpoint
ALTER TYPE "edge_type" ADD VALUE IF NOT EXISTS 'ADMINISTERS';
--> statement-breakpoint
ALTER TYPE "edge_type" ADD VALUE IF NOT EXISTS 'DOCUMENTS';
