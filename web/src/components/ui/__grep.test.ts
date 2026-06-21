import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const uiDir = join(process.cwd(), "src/components/ui");

function listTsFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) return listTsFiles(full);
		return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
	});
}

describe("components/ui banned utilities", () => {
	it("contains no slate-[0-9] or blue-[0-9] color utilities", () => {
		const offenders: string[] = [];
		for (const file of listTsFiles(uiDir)) {
			const src = readFileSync(file, "utf8");
			const matches = src.match(/(?:slate|blue)-[0-9]/g);
			if (matches) {
				offenders.push(`${relative(uiDir, file)}: ${matches.join(", ")}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
