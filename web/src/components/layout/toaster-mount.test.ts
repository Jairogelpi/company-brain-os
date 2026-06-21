import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
	join(process.cwd(), "src/app/(app)/layout.tsx"),
	"utf8",
);

describe("(app) layout (Programa top bar + toaster)", () => {
	it("mounts the sonner Toaster", () => {
		expect(source).toMatch(/from "sonner"/);
		expect(source).toContain("Toaster");
	});

	it("does not use backdrop-blur or legacy paper vars", () => {
		expect(source).not.toMatch(/backdrop-blur/);
	});
});
