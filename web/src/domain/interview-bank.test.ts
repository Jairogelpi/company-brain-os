import { describe, expect, it } from "vitest";
import { AI_EVERY, QUESTION_BANK } from "./interview-bank";

describe("interview question bank", () => {
	it("has a substantial, richer bank of questions", () => {
		expect(QUESTION_BANK.length).toBeGreaterThanOrEqual(20);
	});

	it("uses unique question ids", () => {
		const ids = QUESTION_BANK.map((q) => q.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("covers people, clients, suppliers, systems and projects", () => {
		const areas = new Set(QUESTION_BANK.map((q) => q.area));
		for (const area of ["people", "client", "supplier", "system", "project"]) {
			expect(areas.has(area as never)).toBe(true);
		}
	});

	it("marks person questions and at least one substitute question", () => {
		expect(QUESTION_BANK.some((q) => q.expectsPerson)).toBe(true);
		expect(QUESTION_BANK.some((q) => q.expectsSubstitute)).toBe(true);
	});

	it("inserts an AI question every 5 by default", () => {
		expect(AI_EVERY).toBe(5);
	});
});
