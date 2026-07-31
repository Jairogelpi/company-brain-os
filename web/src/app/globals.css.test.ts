import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

	describe("Company Brain design tokens (globals.css)", () => {
	it("defines the primary accent on the Tailwind theme", () => {
		expect(css).toMatch(/--color-primary:\s*#e6ec4d/i);
	});

	it("keeps the primary accent in the .dark override", () => {
		expect(css).toMatch(/\.dark[\s\S]*--color-primary:\s*#e6ec4d/i);
	});

	it("declares the raw color tokens", () => {
		for (const token of [
			"--color-ink-black",
			"--color-paper-white",
			"--color-fog-gray",
			"--color-ash-gray",
		]) {
			expect(css).toContain(token);
		}
		expect(css).toMatch(/--color-lime:\s*#e6ec4d/i);
	});

	it("uses radius 10px for controls and 16px for cards", () => {
		expect(css).toMatch(/--radius-sm:\s*10px/);
		expect(css).toMatch(/--radius-lg:\s*16px/);
	});

	it("drops the legacy Cold Editorial cobalt signal", () => {
		expect(css).not.toMatch(/--cobalt:/);
		expect(css).not.toMatch(/--cobalt-ink:/);
	});
});
