import { describe, expect, it } from "vitest";
import { createInMemoryAssertionRepository } from "@/db/assertion-repository";
import { createInMemoryGraphRepository } from "@/db/repository";
import { createCanonicalGraphWriter } from "./canonical-graph-writer";
import { detectAllRisks } from "./risk-engine";
import {
	completeMission,
	createMissionFromRisk,
	transitionMission,
	type TransferVerification,
} from "./missions";
import type { GraphEdge, GraphNode, KnowledgeNode } from "./graph";
import { rebuildApprovedAssertionProjection } from "./assertion-projection-service";

describe("canonical Pedro / Laura continuity journey", () => {
	it("keeps the risk open after documentation and closes it only after independently verified transfer", async () => {
		const ledger = createInMemoryAssertionRepository();
		const graph = createInMemoryGraphRepository();
		let sequence = 0;
		const writer = createCanonicalGraphWriter(ledger, graph, {
			organizationId: "factory-1",
			actorId: "owner-1",
			sourceType: "canonical_e2e",
			sourceId: "pedro-laura",
			now: () => `2026-08-01T00:00:${String(sequence).padStart(2, "0")}.000Z`,
			id: () => `e2e-${++sequence}`,
		});

		await writer.createNode({ id: "pedro", type: "Person", name: "Pedro" });
		await writer.createNode({ id: "laura", type: "Person", name: "Laura" });
		await writer.createNode({
			id: "line-config",
			type: "Knowledge",
			name: "Configure production line",
			knowledgeType: "technical",
			documented: false,
			validationState: "validated",
			confidence: 80,
			criticality: "high",
		});
		await writer.createEdge({
			id: "pedro-mastery",
			type: "MASTERS",
			fromNodeId: "pedro",
			toNodeId: "line-config",
			attributes: { level: 5 },
		});

		const initial = detectAllRisks(
			await graph.listNodes() as GraphNode[],
			await graph.listEdges() as GraphEdge[],
		);
		const dependency = initial.risks.find((risk) => risk.riskType === "single_point_of_failure");
		expect(dependency).toBeDefined();
		expect(dependency?.evidenceRefs.every((ref) => ref.startsWith("assertion:"))).toBe(true);

		let mission = createMissionFromRisk(dependency!, "owner-1", ["laura"]);
		mission = transitionMission(mission, "in_progress");
		mission = transitionMission(mission, "submitted");
		mission = transitionMission(mission, "validated");
		await writer.updateNode("line-config", {
			documented: true,
			validationState: "validated",
		} as Partial<KnowledgeNode>);

		const afterDocumentation = detectAllRisks(
			await graph.listNodes() as GraphNode[],
			await graph.listEdges() as GraphEdge[],
		);
		expect(afterDocumentation.risks.some((risk) => risk.riskType === "undocumented_critical")).toBe(false);
		expect(afterDocumentation.risks.some((risk) => risk.riskType === "single_point_of_failure")).toBe(true);

		const verification: TransferVerification = {
			id: "verification-laura",
			missionId: mission.id,
			targetNodeId: "line-config",
			backupPersonId: "laura",
			assessorId: "user-pedro",
			assessorPersonId: "pedro",
			competencyLevel: 4,
			accessVerified: true,
			evidenceRefs: ["artifact:sop-line-config", "assessment:observed-run-42"],
			status: "approved",
			reviewerId: "user-owner-1",
			reviewerPersonId: "owner-1",
			createdAt: "2026-08-02T00:00:00.000Z",
			reviewedAt: "2026-08-03T00:00:00.000Z",
		};
		await writer.createEdge({
			id: "laura-verified-mastery",
			type: "MASTERS",
			fromNodeId: "laura",
			toNodeId: "line-config",
			attributes: {
				level: 4,
				accessVerified: true,
				transferVerificationId: verification.id,
				evidenceRefs: verification.evidenceRefs,
			},
		});
		mission = completeMission(mission, verification);

		const mitigated = detectAllRisks(
			await graph.listNodes() as GraphNode[],
			await graph.listEdges() as GraphEdge[],
		);
		expect(mission.status).toBe("closed");
		expect(mitigated.risks.some((risk) => risk.sourceNodeId === "line-config")).toBe(false);

		const firstHash = (await rebuildApprovedAssertionProjection(ledger, graph, "factory-1")).hash;
		const secondHash = (await rebuildApprovedAssertionProjection(ledger, graph, "factory-1")).hash;
		expect(secondHash).toBe(firstHash);
		expect((await graph.listNodes()).every((node) =>
			Boolean((node.attributes as Record<string, unknown> | undefined)?.provenance),
		)).toBe(true);
		expect((await graph.listEdges()).every((edge) => typeof edge.attributes?.assertionId === "string")).toBe(true);
		const assertions = await ledger.listByOrganization("factory-1");
		expect(new Set(await ledger.listEvidenceAssertionIds("factory-1")))
			.toEqual(new Set(assertions.map((assertion) => assertion.id)));
	});
});
