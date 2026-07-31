import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
	join(process.cwd(), "src/components/layout/Sidebar.tsx"),
	"utf8",
);

describe("Sidebar (Programa + lucide)", () => {
	it("imports icons from lucide-react", () => {
		expect(source).toContain('from "lucide-react"');
	});

	it("contains no inline svg <path d= icon helpers", () => {
		expect(source).not.toMatch(/<path d=/);
		expect(source).not.toMatch(/const I = /);
	});

	it("keeps all navigate labels", () => {
		for (const key of [
			'key: "dashboard"',
			'key: "capture"',
			'key: "inbox"',
			'key: "people"',
			'key: "knowledge"',
			'key: "graph"',
			'key: "genome"',
			'key: "simulator"',
			'key: "succession"',
			'key: "settings"',
		]) {
			expect(source).toContain(key);
		}
	});

	it("does not use the banned cobalt signal", () => {
		expect(source).not.toMatch(/var\(--cobalt\)/);
	});
});
