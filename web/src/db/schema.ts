import {
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	unique,
	uniqueIndex,
	timestamp,
	boolean,
} from "drizzle-orm/pg-core";
import { vector768 } from "./vector-type";
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
export const assertionStatusEnum = pgEnum("assertion_status", ["draft", "proposed", "approved", "disputed", "rejected", "superseded", "expired", "archived"]);
export const confidenceClassEnum = pgEnum("confidence_class", ["unverified", "weak", "supported", "verified", "contested"]);

// Ponytail: text IDs match domain contract. No UUID mapping layer needed.
export const nodes = pgTable(
	"nodes",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
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
		companyId: text("company_id").notNull(),
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
		companyId: text("company_id").notNull(),
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
		companyId: text("company_id").notNull(),
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
		companyId: text("company_id").notNull(),
		embedding: vector768("embedding").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("node_embeddings_node_idx").on(table.nodeId),
		index("node_embeddings_company_idx").on(table.companyId),
	],
);

export const memberships = pgTable(
	"memberships",
	{
		userId: text("user_id").notNull(),
		companyId: text("company_id").notNull(),
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
		companyId: text("company_id").notNull(),
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

/** Tenant-protected HR/profile data, deliberately separate from login identity. */
export const userProfiles = pgTable(
	"user_profiles",
	{
		userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
		companyId: text("company_id").notNull(),
		position: text("position"),
		department: text("department"),
		salary: integer("salary"),
		workingHours: integer("working_hours"),
		contractType: text("contract_type"),
		startDate: date("start_date"),
		phone: text("phone"),
		bio: text("bio"),
		/** Explicit link from an authenticated user to their canonical Person projection. */
		personNodeId: text("person_node_id"),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("user_profiles_company_idx").on(table.companyId),
		uniqueIndex("user_profiles_company_person_unique").on(table.companyId, table.personNodeId),
	],
);

// Succession / offboarding playbook actions, persisted as assignable missions.
export const missions = pgTable(
	"missions",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
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
		detailedSteps: jsonb("detailed_steps").$type<string[]>(),
		suggestedTrainerId: text("suggested_trainer_id"),
		suggestedTrainerName: text("suggested_trainer_name"),
		rationale: text("rationale"),
		riskNote: text("risk_note"),
		// Boss-authored detailed instructions + the single assigned employee.
		instructions: text("instructions"),
		assigneeId: text("assignee_id"),
		// Most recent rejection reason surfaced back to the employee.
		rejectionReason: text("rejection_reason"),
	},
	(table) => [
		index("missions_company_idx").on(table.companyId),
		index("missions_status_idx").on(table.status),
	],
);

// Employee deliverables for a mission: an uploaded file (pdf/word/excel/
// audio/video) or written text. Reviewed (approved/rejected) by the boss.
export const missionSubmissions = pgTable(
	"mission_submissions",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
		missionId: text("mission_id").notNull(),
		authorId: text("author_id").notNull(),
		kind: text("kind").$type<"file" | "text">().notNull(),
		text: text("text"),
		storageUrl: text("storage_url"),
		fileName: text("file_name"),
		mimeType: text("mime_type"),
		mediaType: text("media_type"),
		status: text("status")
			.$type<"pending" | "approved" | "rejected">()
			.notNull()
			.default("pending"),
		reviewerId: text("reviewer_id"),
		rejectionReason: text("rejection_reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
	},
	(table) => [
		index("mission_submissions_company_idx").on(table.companyId),
		index("mission_submissions_mission_idx").on(table.missionId),
	],
);

export const missionTransferVerifications = pgTable(
	"mission_transfer_verifications",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
		missionId: text("mission_id").notNull().references(() => missions.id, { onDelete: "cascade" }),
		targetNodeId: text("target_node_id").notNull(),
		backupPersonId: text("backup_person_id").notNull(),
		assessorId: text("assessor_id").notNull(),
		assessorPersonId: text("assessor_person_id"),
		competencyLevel: integer("competency_level").notNull(),
		accessVerified: boolean("access_verified").notNull().default(false),
		evidenceRefs: jsonb("evidence_refs").$type<string[]>().notNull().default([]),
		status: text("status").$type<"proposed" | "approved" | "rejected">().notNull().default("proposed"),
		reviewerId: text("reviewer_id"),
		reviewerPersonId: text("reviewer_person_id"),
		rejectionReason: text("rejection_reason"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
	},
	(table) => [
		index("mission_transfer_verifications_company_idx").on(table.companyId),
		index("mission_transfer_verifications_mission_idx").on(table.missionId),
		index("mission_transfer_verifications_status_idx").on(table.status),
	],
);

export const storedUploads = pgTable(
	"stored_uploads",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
		filename: text("filename").notNull(),
		originalName: text("original_name").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		contentSha256: text("content_sha256"),
		uploadedBy: text("uploaded_by").notNull(),
		scanProvider: text("scan_provider").notNull(),
		status: text("status").$type<"available" | "rejected" | "expired">().notNull().default("available"),
		retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique("stored_uploads_company_filename_unique").on(table.companyId, table.filename),
		index("stored_uploads_company_idx").on(table.companyId),
		index("stored_uploads_retention_idx").on(table.retentionUntil),
	],
);

/** Durable user notification plus delivery-outbox state. */
export const notifications = pgTable(
	"notifications",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
		recipientId: text("recipient_id"),
		channel: text("channel").$type<"email" | "in_app">().notNull(),
		destination: text("destination"),
		title: text("title").notNull(),
		body: text("body").notNull(),
		actionUrl: text("action_url"),
		status: text("status")
			.$type<"pending" | "processing" | "delivered" | "failed" | "dead_letter">()
			.notNull()
			.default("pending"),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastError: text("last_error"),
		idempotencyKey: text("idempotency_key").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }),
		readAt: timestamp("read_at", { withTimezone: true }),
	},
	(table) => [
		unique("notifications_company_idempotency_unique").on(
			table.companyId,
			table.idempotencyKey,
		),
		index("notifications_recipient_idx").on(table.companyId, table.recipientId),
		index("notifications_delivery_idx").on(
			table.companyId,
			table.status,
			table.nextAttemptAt,
		),
	],
);

export const userInvitations = pgTable(
	"user_invitations",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
		email: text("email").notNull(),
		role: text("role").$type<"validator" | "contributor" | "viewer">().notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		invitedBy: text("invited_by").notNull(),
		status: text("status")
			.$type<"pending" | "accepted" | "revoked" | "expired">()
			.notNull()
			.default("pending"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		acceptedBy: text("accepted_by"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
	},
	(table) => [
		index("user_invitations_company_idx").on(table.companyId),
		index("user_invitations_email_idx").on(table.companyId, table.email),
		index("user_invitations_status_idx").on(table.companyId, table.status),
	],
);

// Durable review queue + ingest audit trail (passive capture).
export const ingestionItems = pgTable(
	"ingestion_items",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
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

export const transcriptionJobs = pgTable(
	"transcription_jobs",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id").notNull(),
		userId: text("user_id").notNull(),
		source: text("source").notNull(),
		storageKey: text("storage_key").notNull(),
		mimeType: text("mime_type").notNull(),
		status: text("status")
			.$type<"queued" | "processing" | "completed" | "failed">()
			.notNull()
			.default("queued"),
		transcript: text("transcript"),
		noSpeech: boolean("no_speech").notNull().default(false),
		failReason: text("fail_reason"),
		provider: text("provider"),
		durationSeconds: integer("duration_seconds"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("transcription_jobs_company_idx").on(table.companyId),
		index("transcription_jobs_status_idx").on(table.status),
	],
);

export const validationScopes = pgTable(
	"validation_scopes",
	{
		userId: text("user_id").notNull(),
		companyId: text("company_id").notNull(),
		domain: text("domain").notNull(),
	},
	(table) => [
		index("validation_scopes_user_idx").on(table.userId),
		index("validation_scopes_company_idx").on(table.companyId),
	],
);

export const evidenceSources = pgTable("evidence_sources", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => companies.id),
	type: text("type").notNull(),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("evidence_sources_org_idx").on(table.organizationId)]);

export const evidenceItems = pgTable("evidence_items", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => companies.id),
	sourceId: text("source_id").notNull().references(() => evidenceSources.id),
	contentHash: text("content_hash"),
	metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("evidence_items_org_idx").on(table.organizationId), index("evidence_items_source_idx").on(table.sourceId)]);

export const assertions = pgTable("assertions", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => companies.id),
	subjectEntityId: text("subject_entity_id").notNull(),
	predicate: text("predicate").notNull(),
	objectEntityId: text("object_entity_id"),
	scalarValue: jsonb("scalar_value"),
	sourceType: text("source_type").notNull(),
	sourceId: text("source_id").notNull(),
	status: assertionStatusEnum("status").notNull(),
	proposedBy: text("proposed_by").notNull(),
	approvedBy: text("approved_by"),
	validFrom: timestamp("valid_from", { withTimezone: true }),
	validUntil: timestamp("valid_until", { withTimezone: true }),
	recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
	supersededBy: text("superseded_by"),
	confidenceClass: confidenceClassEnum("confidence_class").notNull(),
	reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
	metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [index("assertions_org_idx").on(table.organizationId), index("assertions_subject_idx").on(table.subjectEntityId), index("assertions_status_idx").on(table.status), index("assertions_source_idx").on(table.sourceType, table.sourceId)]);

export const assertionEvidence = pgTable("assertion_evidence", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => companies.id),
	assertionId: text("assertion_id").notNull().references(() => assertions.id),
	evidenceItemId: text("evidence_item_id").notNull().references(() => evidenceItems.id),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("assertion_evidence_unique").on(table.assertionId, table.evidenceItemId), index("assertion_evidence_org_idx").on(table.organizationId)]);
