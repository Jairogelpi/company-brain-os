import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
	join(process.cwd(), "src/components/ui/button.tsx"),
	"utf8",
);

describe("Button (Programa token rewire)", () => {
	it("uses the primary token for the default variant", () => {
		expect(source).toContain("bg-primary");
		expect(source).toContain("text-primary-foreground");
	});

	it("does not reference banned slate utilities", () => {
		expect(source).not.toMatch(/slate-[0-9]/);
	});

	it("uses the ring token for focus visibility", () => {
		expect(source).toContain("ring-ring");
	});
});
