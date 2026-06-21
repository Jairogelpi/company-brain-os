import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	unique,
	timestamp,
	boolean,
} from "drizzle-orm/pg-core";
import { EDGE_TYPES, KNOWLEDGE_TYPES, NODE_TYPES } from "@/domain/graph";

export const nodeTypeEnum = pgEnum("node_type", NODE_TYPES);
export const edgeTypeEnum = pgEnum("edge_type", EDGE_TYPES);
export const knowledgeTypeEnum = pgEnum("knowledge_type", KNOWLEDGE_TYPES);
export const criticalityEnum = pgEnum("criticality", ["low", "medium", "high"]);
export const validationStateEnum = pgEnum("validation_state", [
	"draft",
	"proposed",
	"validated",
	"retired",
]);

// Ponytail: text IDs match domain contract. No UUID mapping layer needed.
export const nodes = pgTable(
	"nodes",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull().default("default"),
		type: nodeTypeEnum("type").notNull(),
		name: text("name").notNull(),
		criticality: criticalityEnum("criticality"),
		attributes: jsonb("attributes")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		knowledgeType: knowledgeTypeEnum("knowledge_type"),
		documented: boolean("documented"),
		validationState: validationStateEnum("validation_state"),
		confidence: integer("confidence"),
		archived: boolean("archived").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("nodes_company_idx").on(table.companyId),
		index("nodes_type_idx").on(table.type),
	],
);

export const edges = pgTable(
	"edges",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull().default("default"),
		type: edgeTypeEnum("type").notNull(),
		fromNodeId: text("from_node_id")
			.notNull()
			.references(() => nodes.id, { onDelete: "cascade" }),
		toNodeId: text("to_node_id")
			.notNull()
			.references(() => nodes.id, { onDelete: "cascade" }),
		attributes: jsonb("attributes")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		archived: boolean("archived").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("edges_company_idx").on(table.companyId),
		index("edges_type_idx").on(table.type),
		index("edges_from_idx").on(table.fromNodeId),
		index("edges_to_idx").on(table.toNodeId),
	],
);

export const nodeLayout = pgTable(
	"node_layout",
	{
		nodeId: text("node_id")
			.primaryKey()
			.references(() => nodes.id, { onDelete: "cascade" }),
		companyId: text("company_id").notNull().default("default"),
		x: integer("x").notNull().default(0),
		y: integer("y").notNull().default(0),
		color: text("color"),
		collapsed: boolean("collapsed").notNull().default(false),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("node_layout_company_idx").on(table.companyId)],
);

export const eventLog = pgTable(
	"event_log",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull().default("default"),
		actorId: text("actor_id"),
		eventType: text("event_type").notNull(),
		payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("event_log_company_idx").on(table.companyId),
		index("event_log_created_at_idx").on(table.createdAt),
	],
);

export const nodeEmbeddings = pgTable(
	"node_embeddings",
	{
		nodeId: text("node_id")
			.primaryKey()
			.references(() => nodes.id, { onDelete: "cascade" }),
		embedding: jsonb("embedding").$type<number[]>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("node_embeddings_node_idx").on(table.nodeId)],
);

export const memberships = pgTable(
	"memberships",
	{
		userId: text("user_id").notNull(),
		companyId: text("company_id").notNull().default("default"),
		role: text("role")
			.$type<"owner" | "validator" | "contributor" | "viewer">()
			.notNull()
			.default("viewer"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("memberships_user_idx").on(table.userId),
		index("memberships_company_idx").on(table.companyId),
	],
);

export const companies = pgTable(
	"companies",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		unique("companies_slug_unique").on(table.slug),
		index("companies_slug_idx").on(table.slug),
	],
);

export const users = pgTable(
	"users",
	{
		id: text("id").primaryKey(),
		email: text("email").notNull().unique(),
		name: text("name").notNull(),
		passwordHash: text("password_hash").notNull(),
		companyId: text("company_id").notNull().default("demo-corp"),
		role: text("role")
			.$type<"owner" | "validator" | "contributor" | "viewer">()
			.notNull()
			.default("viewer"),
		validationDomains: jsonb("validation_domains")
			.$type<string[]>()
			.notNull()
			.default([]),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("users_email_idx").on(table.email),
		index("users_company_idx").on(table.companyId),
	],
);

// Succession / offboarding playbook actions, persisted as assignable missions.
export const missions = pgTable(
	"missions",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull().default("default"),
		personId: text("person_id"), // departing person the playbook is for
		objective: text("objective").notNull(),
		targetNodeId: text("target_node_id").notNull(),
		targetNodeName: text("target_node_name").notNull(),
		assigneeIds: jsonb("assignee_ids").$type<string[]>().notNull().default([]),
		priority: text("priority")
			.$type<"low" | "medium" | "high" | "critical">()
			.notNull()
			.default("medium"),
		dueDate: text("due_date"),
		status: text("status")
			.$type<"open" | "in_progress" | "submitted" | "validated" | "closed">()
			.notNull()
			.default("open"),
		createdBy: text("created_by").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		closedAt: timestamp("closed_at", { withTimezone: true }),
	},
	(table) => [
		index("missions_company_idx").on(table.companyId),
		index("missions_status_idx").on(table.status),
	],
);

// Durable review queue + ingest audit trail (passive capture).
export const ingestionItems = pgTable(
	"ingestion_items",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull().default("default"),
		source: text("source").notNull(),
		kind: text("kind").$type<"csv" | "text">().notNull(),
		proposal: jsonb("proposal").$type<Record<string, unknown>>().notNull(),
		status: text("status")
			.$type<"pending" | "approved" | "rejected">()
			.notNull()
			.default("pending"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
	},
	(table) => [
		index("ingestion_items_company_idx").on(table.companyId),
		index("ingestion_items_status_idx").on(table.status),
	],
);

export const validationScopes = pgTable(
	"validation_scopes",
	{
		userId: text("user_id").notNull(),
		companyId: text("company_id").notNull().default("default"),
		domain: text("domain").notNull(),
	},
	(table) => [
		index("validation_scopes_user_idx").on(table.userId),
		index("validation_scopes_company_idx").on(table.companyId),
	],
);
