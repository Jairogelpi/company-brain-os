import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { analyzeTextWithLLM } from "@/ai/extraction";
import * as client from "@/ai/client";
import type { InterviewQuestion } from "@/domain/interview";

const sampleQuestion: InterviewQuestion = {
	id: "persona_clave-probe",
	probe: "PERSONA_CLAVE",
	purpose: "probe",
	text: "¿Quién es la persona que si falta mañana tienes un problema serio?",
};

describe("analyzeTextWithLLM", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("falls back to heuristic when LLM is not configured", async () => {
		// Ensure no LLM config
		vi.spyOn(client, "getLlmConfig").mockReturnValue(null);

		const heuristic = vi.fn().mockReturnValue({
			personName: "Pedro",
			knowledgeName: undefined,
			ruleName: undefined,
			processName: undefined,
			critical: true,
			covered: false,
			documented: false,
			undocumented: false,
			noSubstitute: false,
		});

		const signals = await analyzeTextWithLLM(
			"Pedro es indispensable",
			sampleQuestion,
			heuristic,
		);

		expect(signals.personName).toBe("Pedro");
		expect(signals.critical).toBe(true);
		expect(heuristic).toHaveBeenCalledTimes(1);
	});

	it("falls back to heuristic on network error", async () => {
		vi.spyOn(client, "getLlmConfig").mockReturnValue({
			apiKey: "test-key",
			baseUrl: "http://localhost:9999",
		});

		const heuristic = vi.fn().mockReturnValue({
			critical: false,
			covered: false,
			documented: false,
			undocumented: false,
			noSubstitute: false,
		});

		const signals = await analyzeTextWithLLM(
			"Pedro es indispensable",
			sampleQuestion,
			heuristic,
		);

		expect(signals.critical).toBe(false);
		expect(heuristic).toHaveBeenCalledTimes(1);
	});

	it("returns LLM-extracted signals when API succeeds", async () => {
		const mockResponse = JSON.stringify({
			personName: "María",
			critical: true,
			covered: false,
			documented: false,
			undocumented: true,
			noSubstitute: true,
		});

		vi.spyOn(client, "getLlmConfig").mockReturnValue({
			apiKey: "test-key",
			baseUrl: "http://localhost:9999",
		});

		vi.spyOn(client, "chatCompletion").mockResolvedValue(mockResponse);

		const heuristic = vi.fn();

		const signals = await analyzeTextWithLLM(
			"María es indispensable y nadie más puede hacerlo",
			sampleQuestion,
			heuristic,
		);

		expect(signals.personName).toBe("María");
		expect(signals.critical).toBe(true);
		expect(signals.noSubstitute).toBe(true);
		expect(heuristic).not.toHaveBeenCalled();
	});

	it("parses knowledge signals from LLM response", async () => {
		const mockResponse = JSON.stringify({
			knowledgeName: "configurar la llenadora",
			documented: false,
			critical: true,
		});

		vi.spyOn(client, "getLlmConfig").mockReturnValue({
			apiKey: "test-key",
			baseUrl: "http://localhost:9999",
		});
		vi.spyOn(client, "chatCompletion").mockResolvedValue(mockResponse);

		const heuristic = vi.fn();

		const signals = await analyzeTextWithLLM(
			"Solo Pedro sabe configurar la llenadora",
			{
				id: "conocimiento-probe",
				probe: "CONOCIMIENTO",
				purpose: "probe",
				text: "¿Qué hace exactamente que nadie más sepa hacer?",
			},
			heuristic,
		);

		expect(signals.knowledgeName).toBe("configurar la llenadora");
		expect(signals.documented).toBe(false);
		expect(signals.critical).toBe(true);
	});

	it("handles substitute signals with numeric level", async () => {
		const mockResponse = JSON.stringify({
			substituteName: "Laura",
			substituteLevel: 2,
			noSubstitute: false,
		});

		vi.spyOn(client, "getLlmConfig").mockReturnValue({
			apiKey: "test-key",
			baseUrl: "http://localhost:9999",
		});
		vi.spyOn(client, "chatCompletion").mockResolvedValue(mockResponse);

		const heuristic = vi.fn();

		const signals = await analyzeTextWithLLM(
			"Laura lo vio una vez, nivel 2",
			{
				id: "sustituto-probe",
				probe: "SUSTITUTO",
				purpose: "probe",
				text: "¿Quién es el segundo que más se acerca?",
			},
			heuristic,
		);

		expect(signals.substituteName).toBe("Laura");
		expect(signals.substituteLevel).toBe(2);
		expect(signals.noSubstitute).toBe(false);
	});

	it("gracefully handles malformed LLM JSON", async () => {
		vi.spyOn(client, "getLlmConfig").mockReturnValue({
			apiKey: "test-key",
			baseUrl: "http://localhost:9999",
		});
		vi.spyOn(client, "chatCompletion").mockResolvedValue(
			"not valid json at all",
		);

		const heuristic = vi.fn().mockReturnValue({
			critical: false,
			covered: false,
			documented: false,
			undocumented: false,
			noSubstitute: false,
		});

		const signals = await analyzeTextWithLLM(
			"cualquier cosa",
			sampleQuestion,
			heuristic,
		);

		// parseSignals returns defaults on parse failure
		expect(signals.critical).toBe(false);
		expect(signals.noSubstitute).toBe(false);
	});

	it("clamps substituteLevel to 0-5 range", async () => {
		const mockResponse = JSON.stringify({
			substituteName: "Carlos",
			substituteLevel: 8,
		});

		vi.spyOn(client, "getLlmConfig").mockReturnValue({
			apiKey: "test-key",
			baseUrl: "http://localhost:9999",
		});
		vi.spyOn(client, "chatCompletion").mockResolvedValue(mockResponse);

		const heuristic = vi.fn();

		const signals = await analyzeTextWithLLM(
			"Carlos nivel 8",
			sampleQuestion,
			heuristic,
		);

		expect(signals.substituteLevel).toBe(5);
	});
});
