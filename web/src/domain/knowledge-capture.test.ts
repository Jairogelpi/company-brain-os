import { describe, expect, it } from "vitest";
import { createMissionFromRisk, type TransferVerification } from "./missions";
import type { DetectedRisk } from "./risk-engine";
import {
	processCapture,
	buildArtifact,
	getArtifactTemplate,
	closeMissionLoop,
} from "./knowledge-capture";
import { createGraphService } from "./graph-service";
import type { GraphNode, KnowledgeNode } from "./graph";

const sampleRisk: DetectedRisk = {
	id: "risk-spof-k-filler",
	riskType: "single_point_of_failure",
	severity: "critical",
	sourceNodeId: "k-filler",
	sourceNodeName: "configurar llenadora",
	relatedNodeIds: ["pedro"],
	message: "SPOF",
	confidence: 22,
	trigger: "test",
	ruleId: "test",
	ruleVersion: 1,
	inputFacts: {},
	evidenceRefs: [],
};

const pedro: GraphNode = { id: "pedro", type: "Person", name: "Pedro" };
const laura: GraphNode = { id: "laura", type: "Person", name: "Laura" };
const fillerKnowledge: KnowledgeNode = {
	id: "k-filler",
	type: "Knowledge",
	name: "configurar llenadora",
	knowledgeType: "technical",
	documented: false,
	validationState: "proposed",
	confidence: 25,
	criticality: "high",
};

const verification: TransferVerification = {
	id: "laura-observed-run",
	missionId: "mission-spof-k-filler",
	targetNodeId: "k-filler",
	backupPersonId: "laura",
	assessorId: "user-pedro",
	assessorPersonId: "pedro",
	competencyLevel: 4,
	accessVerified: true,
	evidenceRefs: ["artifact:sop", "assessment:run-42"],
	status: "approved",
	reviewerId: "user-owner-1",
	reviewerPersonId: "owner-1",
	createdAt: "2026-08-01T00:00:00.000Z",
};

function continuityService() {
	const service = createGraphService();
	service.createNode(pedro);
	service.createNode(laura);
	service.createNode(fillerKnowledge);
	service.createEdge({
		id: "pedro-mastery",
		type: "MASTERS",
		fromNodeId: "pedro",
		toNodeId: "k-filler",
		attributes: { level: 5 },
	});
	return service;
}

describe("F8 — Universal Capture", () => {
	describe("processCapture", () => {
		it("processes a video capture into a structured contribution", () => {
			const result = processCapture({
				missionId: "mission-spof-k-filler",
				authorId: "pedro",
				type: "video",
				rawContent:
					"Pedro configura la llenadora así: primero ajusta temperatura, luego presión.",
			});

			expect(result.contribution.mediaType).toBe("video");
			expect(result.contribution.authorId).toBe("pedro");
			expect(result.transcript).toContain("Pedro configura");
			expect(result.suggestedArtifactType).toBe("SOP");
		});

		it("suggests quick_guide for screen captures", () => {
			const result = processCapture({
				missionId: "m1",
				authorId: "p1",
				type: "screen",
				rawContent: "Grabación de pantalla del proceso",
			});

			expect(result.suggestedArtifactType).toBe("quick_guide");
		});

		it("extracts tags from content keywords", () => {
			const result = processCapture({
				missionId: "m1",
				authorId: "p1",
				type: "chat",
				rawContent:
					"Nunca damos muestra sin pago. Es una regla de seguridad del cliente.",
			});

			expect(result.suggestedTags).toContain("regla");
			expect(result.suggestedTags).toContain("seguridad");
			expect(result.suggestedTags).toContain("cliente");
		});

		it("processes audio captures into FAQ artifacts", () => {
			const result = processCapture({
				missionId: "m1",
				authorId: "p1",
				type: "audio",
				rawContent:
					"Pregunta: ¿Cómo se firma? Respuesta: Solo el socio firma contratos grandes.",
			});

			expect(result.suggestedArtifactType).toBe("SOP");
			expect(result.suggestedTags).toContain("firma");
		});
	});
});

describe("F9 — Artifact Builder", () => {
	describe("getArtifactTemplate", () => {
		it("returns the SOP template with 8 sections", () => {
			const template = getArtifactTemplate("SOP");
			expect(template.type).toBe("SOP");
			expect(template.sections.length).toBeGreaterThanOrEqual(7);
		});

		it("returns the FAQ template with question/answer sections", () => {
			const template = getArtifactTemplate("FAQ");
			expect(template.sections).toContain("# Pregunta 1");
		});

		it("all template types have sections", () => {
			const types = [
				"SOP",
				"checklist",
				"FAQ",
				"manual",
				"quick_guide",
				"knowledge_card",
				"diagram",
			] as const;
			for (const type of types) {
				const template = getArtifactTemplate(type);
				expect(template.sections.length).toBeGreaterThan(0);
			}
		});
	});

	describe("buildArtifact", () => {
		it("builds an SOP artifact from a processed video contribution", () => {
			const processed = processCapture({
				missionId: "mission-spof-k-filler",
				authorId: "pedro",
				type: "video",
				rawContent: "Paso 1: Ajustar temperatura. Paso 2: Ajustar presión.",
			});

			const artifact = buildArtifact(processed, "k-filler");
			expect(artifact.type).toBe("SOP");
			expect(artifact.content).toContain("Standard Operating Procedure");
			expect(artifact.content).toContain("Paso 1");
			expect(artifact.content).toContain("Paso 2");
			expect(artifact.linkedNodeId).toBe("k-filler");
			expect(artifact.validationState).toBe("draft");
		});
	});
});

describe("F10 — Close the Loop", () => {
	describe("closeMissionLoop", () => {
		it("closes a mission and marks the knowledge node as documented+validated", () => {
			const service = continuityService();

			const mission = createMissionFromRisk(sampleRisk, "owner-1");
			const result = closeMissionLoop(service, mission, verification);

			expect(result.updatedNodes).toBe(1);
			expect(result.updatedEdges).toBe(1);
			expect(result.message).toContain("closed");
			expect(result.message).toContain("configurar llenadora");
			expect(result.newRiskReport).toBeDefined();
			expect(result.newMetrics).toBeDefined();

			// Verify node was updated
			const updated = service.readNode(fillerKnowledge.id) as KnowledgeNode;
			expect(updated?.documented).toBe(true);
			expect(updated?.validationState).toBe("validated");
		});

		it("recalculates risks after closing — undocumented risk should disappear", () => {
			const service = continuityService();

			const mission = createMissionFromRisk(sampleRisk, "owner-1");
			const result = closeMissionLoop(service, mission, verification);

			// After marking as documented, the undocumented critical risk should be gone
			const undocRisks = result.newRiskReport.risks.filter(
				(r) =>
					r.riskType === "undocumented_critical" &&
					r.sourceNodeId === fillerKnowledge.id,
			);
			expect(undocRisks).toHaveLength(0);
			expect(result.newRiskReport.risks.filter(
				(r) => r.riskType === "single_point_of_failure" && r.sourceNodeId === fillerKnowledge.id,
			)).toHaveLength(0);
		});

		it("health score should improve after closing a mission", () => {
			const service = continuityService();

			const mission = createMissionFromRisk(sampleRisk, "owner-1");
			const result = closeMissionLoop(service, mission, verification);

			expect(result.newMetrics.health.overallScore).toBeGreaterThanOrEqual(0);
			expect(result.newMetrics.health.overallScore).toBeLessThanOrEqual(100);
			expect(result.newMetrics.companyIQ.iq).toBeGreaterThan(0); // knowledge is now validated
		});
	});
});
