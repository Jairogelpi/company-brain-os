import { describe, expect, it } from "vitest";
import {
	NODE_TYPES,
	validateGraph,
	type GraphEdge,
	type GraphNode,
} from "./graph";
import {
	INTERVIEW_PROBES,
	answerInterviewQuestion,
	createInterviewSession,
	materializeProposedGraph,
} from "./interview";

describe("adaptive interview F0.5 engine", () => {
	it("starts with S1 key person, not a random probe", () => {
		const session = createInterviewSession();

		expect(INTERVIEW_PROBES.map((probe) => probe.id)).toEqual([
			"PERSONA_CLAVE",
			"CONOCIMIENTO",
			"SUSTITUTO",
			"PROCESO",
			"REGLA_NO_ESCRITA",
		]);
		expect(session.currentQuestion.probe).toBe("PERSONA_CLAVE");
		expect(session.currentQuestion.text).toContain("persona");
	});

	it("asks exactly one question per turn", () => {
		const first = createInterviewSession();
		const second = answerInterviewQuestion(
			first,
			"Pedro es indispensable: si falta mañana producción tiene un problema serio.",
		);

		expect(first.currentQuestion).toBeDefined();
		expect(second.currentQuestion).toBeDefined();
		expect(second.askedQuestions).toHaveLength(2);
		expect(second.askedQuestions.at(-1)).toEqual(second.currentQuestion);
	});

	it("deepens on fragility signals instead of widening away", () => {
		const afterKeyPerson = answerInterviewQuestion(
			createInterviewSession(),
			"Pedro es el único indispensable; si falta mañana se para producción.",
		);

		expect(afterKeyPerson.currentQuestion.probe).toBe("CONOCIMIENTO");
		expect(afterKeyPerson.currentQuestion.text).toContain("Pedro");
		expect(afterKeyPerson.facts.keyPerson?.name).toBe("Pedro");
	});

	it("widens when the answer says the knowledge is covered and documented", () => {
		const afterKeyPerson = answerInterviewQuestion(
			createInterviewSession(),
			"Eso lo saben tres personas y está en un manual validado.",
		);

		expect(afterKeyPerson.currentQuestion.probe).toBe("CONOCIMIENTO");

		const afterKnowledge = answerInterviewQuestion(
			afterKeyPerson,
			"La configuración de la máquina la conocen tres personas y está documentada en un manual.",
		);

		expect(afterKnowledge.currentQuestion.probe).toBe("PROCESO");
		expect(afterKnowledge.alarms).toEqual([]);
	});

	it("maps perfume, law, and bakery sector wording to the same graph structure", () => {
		const examples = [
			"Pedro configura la llenadora y nadie más sabe hacerlo.",
			"Solo el socio firma los contratos grandes y nadie más sabe ese criterio.",
			"La masa madre la lleva siempre María y nadie más sabe hacerla.",
		];

		const structures = examples.map((answer) => {
			const session = answerInterviewQuestion(
				answerInterviewQuestion(
					createInterviewSession(),
					"Pedro es la persona clave si falta mañana.",
				),
				answer,
			);
			const graph = materializeProposedGraph(session.proposals);
			const masteryEdge = graph.edges.find((edge) => edge.type === "MASTERS");
			const expert = graph.nodes.find(
				(node) => node.id === masteryEdge?.fromNodeId,
			);
			return {
				nodeTypes: [...new Set(graph.nodes.map((node) => node.type))].sort(),
				edgeTypes: graph.edges.map((edge) => edge.type).sort(),
				expertName: expert?.name,
			};
		});

		expect(structures).toEqual([
			{
				nodeTypes: ["Knowledge", "Person"],
				edgeTypes: ["MASTERS"],
				expertName: "Pedro",
			},
			{
				nodeTypes: ["Knowledge", "Person"],
				edgeTypes: ["MASTERS"],
				expertName: "socio",
			},
			{
				nodeTypes: ["Knowledge", "Person"],
				edgeTypes: ["MASTERS"],
				expertName: "María",
			},
		]);
	});

	it("generates a first alarm before close for one expert, critical knowledge, no real substitute, and undocumented", () => {
		let session = createInterviewSession();
		session = answerInterviewQuestion(
			session,
			"Pedro es indispensable; si falta mañana se para producción.",
		);
		session = answerInterviewQuestion(
			session,
			"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo.",
		);
		session = answerInterviewQuestion(
			session,
			"Laura lo vio una vez, nivel 2; no hay sustituto real.",
		);
		session = answerInterviewQuestion(
			session,
			"No está escrito en ningún sitio.",
		);

		expect(session.alarms).toHaveLength(1);
		expect(session.alarms[0]).toMatchObject({
			severity: "critical",
			personName: "Pedro",
			knowledgeName: "configurar la llenadora crítica",
		});
		expect(session.alarms[0].message).toContain("Pedro");
	});

	it("never invents node types for sector-specific or cultural rules", () => {
		let session = createInterviewSession();
		session = answerInterviewQuestion(
			session,
			"Pedro tiene una forma especial de tratar al cliente VIP.",
		);
		session = answerInterviewQuestion(
			session,
			"Nunca damos muestra sin pago; todos lo respetan pero nadie lo escribió.",
		);

		const graph = materializeProposedGraph(session.proposals);
		expect(graph.nodes.every((node) => NODE_TYPES.includes(node.type))).toBe(
			true,
		);
		expect(
			graph.nodes.some(
				(node) =>
					node.type === "Knowledge" && node.name.includes("muestra sin pago"),
			),
		).toBe(true);
		expect(
			validateGraph(graph.nodes as GraphNode[], graph.edges as GraphEdge[]).ok,
		).toBe(true);
	});

	it("alarms when substitute level is below 3 and the knowledge is explicitly undocumented", () => {
		let session = createInterviewSession();
		session = answerInterviewQuestion(
			session,
			"Pedro es indispensable; si falta se para producción.",
		);
		session = answerInterviewQuestion(
			session,
			"Pedro configura la llenadora crítica.",
		);
		session = answerInterviewQuestion(
			session,
			"Laura lo vio una vez, nivel 2.",
		);
		session = answerInterviewQuestion(
			session,
			"No está escrito en ningún sitio.",
		);

		expect(session.facts.substitute?.level).toBe(2);
		expect(session.alarms).toHaveLength(1);
	});

	it("does not alarm when there is a real substitute at level 3 or higher", () => {
		let session = createInterviewSession();
		session = answerInterviewQuestion(
			session,
			"Pedro es indispensable; si falta se para producción.",
		);
		session = answerInterviewQuestion(
			session,
			"Pedro configura la llenadora crítica.",
		);
		session = answerInterviewQuestion(
			session,
			"Laura también puede hacerlo, nivel 3.",
		);

		expect(session.facts.substitute?.level).toBe(3);
		expect(session.alarms).toEqual([]);
	});

	it("does not alarm when the critical knowledge is documented or broadly covered", () => {
		let documented = createInterviewSession();
		documented = answerInterviewQuestion(
			documented,
			"Pedro es indispensable; si falta se para producción.",
		);
		documented = answerInterviewQuestion(
			documented,
			"Pedro configura la llenadora crítica.",
		);
		documented = answerInterviewQuestion(documented, "No hay sustituto real.");
		documented = answerInterviewQuestion(
			documented,
			"Está documentado en un SOP validado.",
		);

		let covered = createInterviewSession();
		covered = answerInterviewQuestion(
			covered,
			"Pedro, Laura y Ana saben hacerlo; está cubierto.",
		);
		covered = answerInterviewQuestion(
			covered,
			"La llenadora la conocen tres personas y hay manual.",
		);

		expect(documented.alarms).toEqual([]);
		expect(covered.alarms).toEqual([]);
	});
});
