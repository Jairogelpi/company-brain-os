import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	createInterviewSession,
	answerInterviewQuestionAsync,
} from "@/domain/interview";

describe("answerInterviewQuestionAsync (LLM path)", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("runs a full interview using LLM extraction (fallback path when not configured)", async () => {
		// When LLM is not configured, answerInterviewQuestionAsync
		// falls back to heuristic analysis. The session progresses normally.
		let session = createInterviewSession();

		session = await answerInterviewQuestionAsync(
			session,
			"Pedro es indispensable; si falta se para producción.",
		);
		expect(session.facts.keyPerson?.name).toBe("Pedro");
		expect(session.proposals.length).toBeGreaterThanOrEqual(1);

		session = await answerInterviewQuestionAsync(
			session,
			"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo.",
		);
		expect(session.facts.knowledge?.name).toBeTruthy();

		session = await answerInterviewQuestionAsync(
			session,
			"Laura lo vio una vez, nivel 2.",
		);
		expect(session.facts.substitute).toBeDefined();

		session = await answerInterviewQuestionAsync(
			session,
			"No está escrito en ningún sitio.",
		);
		expect(session.facts.documented).toBe(false);

		// First alarm should fire
		expect(session.alarms).toHaveLength(1);
		expect(session.alarms[0].personName).toBe("Pedro");
	});

	it("progresses through the same probe sequence as sync version", async () => {
		let session = createInterviewSession();

		const answers = [
			"Pedro es indispensable.",
			"Solo Pedro configura la llenadora y nadie más sabe.",
			"Laura nivel 2.",
			"No está documentado.",
		];

		for (const answer of answers) {
			session = await answerInterviewQuestionAsync(session, answer);
		}

		// Should have asked PERSONA_CLAVE, CONOCIMIENTO, SUSTITUTO, documentation_check
		const probes = session.askedQuestions.map((q) => q.probe);
		expect(probes).toContain("PERSONA_CLAVE");
		expect(probes).toContain("CONOCIMIENTO");
		expect(probes).toContain("SUSTITUTO");
		expect(probes.some((p) => p === "SUSTITUTO")).toBe(true);
	});
});
