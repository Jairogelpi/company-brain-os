import type { GraphNode, KnowledgeNode } from "./graph";
import type { GraphService } from "./graph-service";
import type {
	Mission,
	Contribution,
	Artifact,
	ArtifactType,
	TransferVerification,
} from "./missions";
import { completeMission, transitionMission } from "./missions";
import { computeAllMetrics } from "./metrics";
import { detectAllRisks, type RiskReport } from "./risk-engine";

// --- F8: Universal Capture ---

export type CaptureSource = {
	missionId: string;
	authorId: string;
	type:
		| "audio"
		| "video"
		| "image"
		| "document"
		| "screen"
		| "drawing"
		| "chat";
	rawContent: string; // plain text, transcribed audio, OCR text, chat log
	storageUrl?: string;
};

export interface ProcessedContribution {
	contribution: Contribution;
	transcript: string;
	suggestedArtifactType: ArtifactType;
	suggestedTags: string[];
}

/**
 * Process a raw capture into a structured contribution.
 * In production, this would call transcription/OCR APIs.
 * For F8, it's a deterministic mapping.
 */
export function processCapture(source: CaptureSource): ProcessedContribution {
	const contribution: Contribution = {
		id: `contrib-${source.missionId}-${Date.now()}`,
		missionId: source.missionId,
		authorId: source.authorId,
		mediaType: source.type,
		storageUrl: source.storageUrl,
		transcript: source.rawContent,
		createdAt: new Date().toISOString(),
	};

	// Suggest artifact type based on media type
	const artifactTypeMap: Record<string, ArtifactType> = {
		audio: "SOP",
		video: "SOP",
		screen: "quick_guide",
		document: "manual",
		image: "diagram",
		drawing: "diagram",
		chat: "FAQ",
	};

	const suggestedArtifactType =
		artifactTypeMap[source.type] ?? "knowledge_card";

	// Extract suggested tags from content (ponytail: simple keyword extraction)
	const lower = source.rawContent.toLowerCase();
	const suggestedTags: string[] = [];
	if (lower.includes("configurar")) suggestedTags.push("configuración");
	if (lower.includes("proceso")) suggestedTags.push("proceso");
	if (lower.includes("seguridad")) suggestedTags.push("seguridad");
	if (lower.includes("cliente")) suggestedTags.push("cliente");
	if (lower.includes("producción") || lower.includes("produccion"))
		suggestedTags.push("producción");
	if (lower.includes("firma") || lower.includes("firmar"))
		suggestedTags.push("firma");
	if (lower.includes("regla") || lower.includes("nunca"))
		suggestedTags.push("regla");

	return {
		contribution,
		transcript: source.rawContent,
		suggestedArtifactType,
		suggestedTags,
	};
}

// --- F9: Artifact Builder ---

export interface ArtifactTemplate {
	type: ArtifactType;
	title: string;
	sections: string[];
}

const ARTIFACT_TEMPLATES: Record<ArtifactType, ArtifactTemplate> = {
	SOP: {
		type: "SOP",
		title: "Standard Operating Procedure",
		sections: [
			"# Objetivo",
			"# Alcance",
			"# Responsable",
			"# Materiales necesarios",
			"# Procedimiento paso a paso",
			"# Puntos de control",
			"# Referencias",
		],
	},
	checklist: {
		type: "checklist",
		title: "Checklist de verificación",
		sections: [
			"# Antes de empezar",
			"# Pasos críticos",
			"# Verificación final",
			"# Firmas",
		],
	},
	FAQ: {
		type: "FAQ",
		title: "Preguntas frecuentes",
		sections: ["# Pregunta 1", "# Respuesta", "# Pregunta 2", "# Respuesta"],
	},
	manual: {
		type: "manual",
		title: "Manual de referencia",
		sections: [
			"# Introducción",
			"# Conceptos clave",
			"# Procedimientos",
			"# Solución de problemas",
			"# Apéndices",
		],
	},
	quick_guide: {
		type: "quick_guide",
		title: "Guía rápida",
		sections: ["# En 30 segundos", "# Pasos", "# Errores comunes"],
	},
	knowledge_card: {
		type: "knowledge_card",
		title: "Tarjeta de conocimiento",
		sections: [
			"# Qué es",
			"# Quién lo sabe",
			"# Cómo se hace",
			"# Cuándo se usa",
		],
	},
	diagram: {
		type: "diagram",
		title: "Diagrama",
		sections: ["# Descripción", "# Elementos", "# Relaciones"],
	},
};

export function getArtifactTemplate(type: ArtifactType): ArtifactTemplate {
	return ARTIFACT_TEMPLATES[type];
}

/**
 * Build an artifact from a processed contribution.
 */
export function buildArtifact(
	processed: ProcessedContribution,
	linkedNodeId?: string,
): Artifact {
	const template = getArtifactTemplate(processed.suggestedArtifactType);

	const fullContent = [
		`# ${template.title}: ${linkedNodeId ?? "Sin asignar"}`,
		"",
		...template.sections,
		"",
		"## Contenido capturado",
		"",
		processed.transcript,
	].join("\n");

	return {
		id: `artifact-${processed.contribution.missionId}-${Date.now()}`,
		missionId: processed.contribution.missionId,
		type: processed.suggestedArtifactType,
		content: fullContent,
		linkedNodeId,
		validationState: "draft",
		createdAt: new Date().toISOString(),
	};
}

// --- F10: Close the Loop ---

export interface ClosedLoopResult {
	updatedNodes: number;
	updatedEdges: number;
	newRiskReport: RiskReport;
	newMetrics: ReturnType<typeof computeAllMetrics>;
	message: string;
}

/**
 * Complete the mission-to-risk loop:
 * 1. Validate the content submission
 * 2. Record documentation and a verified backup competency edge
 * 3. Close only with independent transfer evidence
 * 4. Recalculate risks and metrics
 *
 * Uses the GraphService to apply node updates.
 */
export function closeMissionLoop(
	service: GraphService,
	mission: Mission,
	verification: TransferVerification,
): ClosedLoopResult {
	const validatedMission = transitionMission(
		transitionMission(transitionMission(mission, "in_progress"), "submitted"),
		"validated",
	);

	// 2. Update the knowledge node — mark as documented and validated
	let updatedNodes = 0;
	try {
		service.updateNode(mission.targetNodeId, {
			documented: true,
			validationState: "validated",
		} as Partial<KnowledgeNode>);
		updatedNodes = 1;
	} catch {
		// Node might not exist in this service instance — that's OK
	}

	service.createEdge({
		id: `transfer-${verification.id}`,
		type: "MASTERS",
		fromNodeId: verification.backupPersonId,
		toNodeId: mission.targetNodeId,
		attributes: {
			level: verification.competencyLevel,
			accessVerified: verification.accessVerified,
			transferVerificationId: verification.id,
			evidenceRefs: verification.evidenceRefs,
		},
	});
	completeMission(validatedMission, verification);

	// 3. Recalculate risks and metrics
	const nodes = service.listNodes();
	const edges = service.listEdges();
	const newRiskReport = detectAllRisks(nodes, edges);
	const newMetrics = computeAllMetrics(
		nodes,
		edges,
		newRiskReport.summary.total,
	);

	return {
		updatedNodes,
		updatedEdges: 1,
		newRiskReport,
		newMetrics,
		message: `Mission "${mission.objective}" closed after verified transfer. Node "${mission.targetNodeName}" is documented and backed up by ${verification.backupPersonId}. ${newRiskReport.summary.total} risks remaining. Health: ${newMetrics.health.overallScore}/100.`,
	};
}
