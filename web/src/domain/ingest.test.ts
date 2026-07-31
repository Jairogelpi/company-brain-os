import { describe, expect, it } from "vitest";
import {
	mapEmployeeRows,
	parseEmployeeCsv,
	ingestText,
	type EmployeeRow,
} from "./ingest";
import type { GraphNode } from "./graph";

const ROWS: EmployeeRow[] = [
	{ name: "Pedro", role: "Operario", team: "Producción", manager: "Ana" },
	{ name: "Laura", team: "Producción" },
];

function nodesOf(
	r: ReturnType<typeof mapEmployeeRows>,
	type: GraphNode["type"],
) {
	return r.proposals
		.map((p) => p.proposal)
		.filter((p) => p.type === "create_node" && p.node.type === type)
		.map((p) => (p as { node: GraphNode }).node);
}

describe("ingest — employee list auto-map", () => {
	it("Scenario: uploading an employee list yields a draft map", () => {
		const r = mapEmployeeRows(ROWS, { source: "employees.xlsx" });

		const people = nodesOf(r, "Person");
		const units = nodesOf(r, "OrganizationalUnit");
		const edges = r.proposals
			.map((p) => p.proposal)
			.filter((p) => p.type === "create_edge");

		expect(people.map((n) => n.name).sort()).toEqual(["Laura", "Pedro"]);
		// team is de-duplicated to a single Unit
		expect(units).toHaveLength(1);
		expect(units[0].name).toBe("Producción");
		// one BELONGS_TO edge per person with a team
		expect(edges).toHaveLength(2);
	});

	it("stores role and manager as attributes (no invalid reporting edge)", () => {
		const r = mapEmployeeRows(ROWS, { source: "x" });
		const pedro = nodesOf(r, "Person").find((n) => n.name === "Pedro");
		expect(pedro?.attributes?.role).toBe("Operario");
		expect(pedro?.attributes?.manager).toBe("Ana");
	});

	it("Scenario: nothing is created until approved — output is only proposals", () => {
		const r = mapEmployeeRows(ROWS, { source: "x" });
		// every item is a proposal carrying provenance; no side effects
		expect(r.proposals.length).toBeGreaterThan(0);
		expect(r.proposals.every((p) => p.source === "x")).toBe(true);
	});

	it("Scenario: re-running does not duplicate previously approved data", () => {
		const existing = new Set(["person-pedro", "unit-produccion"]);
		const r = mapEmployeeRows(ROWS, { source: "x", existingNodeIds: existing });

		const people = nodesOf(r, "Person");
		const units = nodesOf(r, "OrganizationalUnit");
		// Pedro + the existing unit are skipped; only Laura is new
		expect(people.map((n) => n.name)).toEqual(["Laura"]);
		expect(units).toHaveLength(0);
		// Pedro's edge is skipped (both endpoints already exist)
		const edges = r.proposals
			.map((p) => p.proposal)
			.filter((p) => p.type === "create_edge");
		expect(edges).toHaveLength(1); // only Laura -> Producción
	});

	it("parses an employee CSV (header-mapped, tolerant of spacing)", () => {
		const csv = [
			"name, role, team, manager",
			"Pedro,Operario,Producción,Ana",
			"Laura,,Producción,",
			"   ", // blank line ignored
		].join("\n");
		const rows = parseEmployeeCsv(csv);
		expect(rows).toEqual([
			{ name: "Pedro", role: "Operario", team: "Producción", manager: "Ana" },
			{ name: "Laura", team: "Producción" },
		] satisfies EmployeeRow[]);
	});

	it("CSV without a name column throws a clear error", () => {
		expect(() => parseEmployeeCsv("role,team\nOperario,Producción")).toThrow(
			/name/i,
		);
	});

	it("empty input yields no proposals", () => {
		const r = mapEmployeeRows([], { source: "x" });
		expect(r.proposals).toHaveLength(0);
	});

	describe("text mapper", () => {
		const TRANSCRIPT =
			"Pedro es indispensable; si falta mañana se para producción. " +
			"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo. " +
			"No está escrito en ningún sitio.";

		it("Scenario: a transcript yields reviewable proposals with provenance", () => {
			const r = ingestText(TRANSCRIPT, { source: "Ops sync 2026-06-18" });
			expect(r.proposals.length).toBeGreaterThan(0);
			expect(r.proposals.every((p) => p.source === "Ops sync 2026-06-18")).toBe(
				true,
			);
			const names = r.proposals
				.map((p) => p.proposal)
				.filter((p) => p.type === "create_node")
				.map((p) => (p as { node: GraphNode }).node.name.toLowerCase());
			expect(names.some((n) => n.includes("pedro"))).toBe(true);
		});

		it("Scenario: empty/irrelevant text yields no proposals", () => {
			expect(ingestText("", { source: "x" }).proposals).toHaveLength(0);
			expect(
				ingestText("buenos días a todos", { source: "x" }).proposals,
			).toHaveLength(0);
		});

		it("dedupes against existing node ids", () => {
			const all = ingestText(TRANSCRIPT, { source: "x" });
			const ids = all.proposals
				.map((p) => p.proposal)
				.filter((p) => p.type === "create_node")
				.map((p) => (p as { node: GraphNode }).node.id);
			const second = ingestText(TRANSCRIPT, {
				source: "x",
				existingNodeIds: new Set(ids),
			});
			const newNodes = second.proposals
				.map((p) => p.proposal)
				.filter((p) => p.type === "create_node");
			expect(newNodes).toHaveLength(0);
		});
	});

	it("uses deterministic, accent-stripped ids", () => {
		const r = mapEmployeeRows([{ name: "Pedro", team: "Producción" }], {
			source: "x",
		});
		const pedro = nodesOf(r, "Person")[0];
		const unit = nodesOf(r, "OrganizationalUnit")[0];
		expect(pedro.id).toBe("person-pedro");
		expect(unit.id).toBe("unit-produccion");
	});

	it("keeps distinct deterministic ids for non-Latin employee names", () => {
		const r = mapEmployeeRows([{ name: "王明" }, { name: "李雷" }], {
			source: "employees.csv",
		});

		const people = nodesOf(r, "Person");
		expect(people.map((n) => n.name).sort()).toEqual(["李雷", "王明"]);
		expect(new Set(people.map((n) => n.id)).size).toBe(2);
		expect(people.every((n) => n.id.startsWith("person-"))).toBe(true);
		expect(people.map((n) => n.id)).not.toContain("person-");
	});

	it("re-imports non-Latin rows idempotently", () => {
		const first = mapEmployeeRows([{ name: "王明" }, { name: "李雷" }], {
			source: "x",
		});
		const ids = new Set(nodesOf(first, "Person").map((n) => n.id));
		const second = mapEmployeeRows([{ name: "王明" }, { name: "李雷" }], {
			source: "x",
			existingNodeIds: ids,
		});

		expect(nodesOf(second, "Person")).toHaveLength(0);
	});
});
