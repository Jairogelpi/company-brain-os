import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("Programa design tokens (globals.css)", () => {
	it("defines --color-primary as highlighter yellow on :root", () => {
		expect(css).toMatch(
			/--color-primary:\s*var\(--color-highlighter-yellow\)/i,
		);
	});

	it("keeps --color-primary as highlighter yellow in the .dark override", () => {
		const darkBlock = css.match(/\.dark\s*\{[^}]*\}/);
		expect(darkBlock).not.toBeNull();
		expect(darkBlock![0]).toMatch(
			/--color-primary:\s*var\(--color-highlighter-yellow\)/i,
		);
	});

	it("declares the Programa raw color tokens including the highlighter hex", () => {
		for (const token of [
			"--color-ink-black",
			"--color-paper-white",
			"--color-fog-gray",
			"--color-ash-gray",
			"--color-highlighter-yellow",
		]) {
			expect(css).toContain(token);
		}
		expect(css).toMatch(/--color-highlighter-yellow:\s*#fbff2b/i);
	});

	it("uses radius 10px for controls and 16px for cards", () => {
		expect(css).toMatch(/--radius:\s*10px/);
		expect(css).toMatch(/--radius-lg:\s*16px/);
	});

	it("drops the legacy Cold Editorial cobalt signal", () => {
		expect(css).not.toMatch(/--cobalt:/);
		expect(css).not.toMatch(/--cobalt-ink:/);
	});
});
