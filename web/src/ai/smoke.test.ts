/**
 * Smoke test for the LLM extraction pipeline.
 * Requires a real OpenCode Go API key.
 *
 * Usage:
 *   npx vitest run src/ai/smoke.test.ts --config vitest.config.ts
 *
 * Caveats:
 *   - Tests call the real API; network latency applies.
 *   - GLM-5.2 may do reasoning before JSON output; the parser handles it.
 *   - Skipped by default. Remove .skip to run.
 */
import { describe, expect, it } from "vitest";
import { configureLlm } from "@/ai/client";
import { analyzeTextWithLLM } from "@/ai/extraction";
import type { InterviewQuestion } from "@/domain/interview";

// Read the key from env; never hardcode. Skipped automatically when unset.
const API_KEY = process.env.OPENCODE_API_KEY ?? "";

const fallback = () => ({
	critical: false,
	covered: false,
	documented: false,
	undocumented: false,
	noSubstitute: false,
});

const hasKey = Boolean(process.env.OPENCODE_API_KEY);
const describeOrSkip = hasKey ? describe : describe.skip;

describeOrSkip("LLM extraction smoke test (real API)", () => {
	it("extracts person name and critical flag", async () => {
		configureLlm({ apiKey: API_KEY });

		const question: InterviewQuestion = {
			id: "persona_clave-probe",
			probe: "PERSONA_CLAVE",
			purpose: "probe",
			text: "¿Quién es la persona que si falta mañana tienes un problema serio?",
		};

		const signals = await analyzeTextWithLLM(
			"Pedro es indispensable; si falta mañana se para producción.",
			question,
			fallback,
		);

		expect(signals.personName).toBeDefined();
		expect(signals.critical).toBe(true);
	}, 30000);

	it("extracts knowledge and undocumented flags", async () => {
		configureLlm({ apiKey: API_KEY });

		const question: InterviewQuestion = {
			id: "conocimiento-probe",
			probe: "CONOCIMIENTO",
			purpose: "probe",
			text: "¿Qué hace exactamente que nadie más sepa hacer?",
		};

		const signals = await analyzeTextWithLLM(
			"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo. No está documentado.",
			question,
			fallback,
		);

		expect(signals.knowledgeName).toBeDefined();
		expect(signals.undocumented).toBe(true);
	}, 30000);

	it("extracts substitute with level", async () => {
		configureLlm({ apiKey: API_KEY });

		const question: InterviewQuestion = {
			id: "sustituto-probe",
			probe: "SUSTITUTO",
			purpose: "probe",
			text: "Si se fuera, ¿quién es el segundo que más se acerca?",
		};

		const signals = await analyzeTextWithLLM(
			"Laura lo ha visto hacer pero solo nivel 2. No hay sustituto real.",
			question,
			fallback,
		);

		expect(signals.substituteName).toBeDefined();
		expect(signals.substituteLevel).toBeLessThanOrEqual(3);
		expect(signals.noSubstitute).toBe(true);
	}, 30000);
});
