import { describe, expect, it } from "vitest";
import {
	nodeToShape,
	edgeToShape,
	getNodeColor,
	nodeLabel,
} from "./canvas-mapping";

import type { GraphNode, GraphEdge, KnowledgeNode } from "@/domain/graph";

const person: GraphNode = {
	id: "node-person",
	type: "Person",
	name: "Pedro",
};

const knowledge: KnowledgeNode = {
	id: "node-k-1",
	type: "Knowledge",
	name: "configurar llenadora",
	knowledgeType: "technical",
	documented: false,
	validationState: "proposed",
	confidence: 25,
	criticality: "high",
};

const processNode: GraphNode = {
	id: "node-proc",
	type: "Process",
	name: "Producción",
};

const assetNode: GraphNode = {
	id: "node-asset",
	type: "Asset",
	name: "Llenadora",
};

const unitNode: GraphNode = {
	id: "node-unit",
	type: "Unit",
	name: "Planta 1",
};

const riskNode: GraphNode = {
	id: "node-risk",
	type: "Risk",
	name: "Parada de línea",
};

describe("graph-to-canvas shape mapping", () => {
	it("maps a Person node to a geo shape with blue color", () => {
		const shape = nodeToShape(person, { x: 0, y: 0 });

		expect(shape.type).toBe("geo");
		expect(shape.props.geo).toBe("rectangle");
		expect(shape.props.color).toBe("blue");
		expect(nodeLabel(person)).toBe("Person: Pedro");
		expect(shape.props.richText).toBeDefined();
		expect(shape.props.w).toBeGreaterThan(0);
		expect(shape.props.h).toBeGreaterThan(0);
	});

	it("maps a Knowledge node to a geo shape with orange color", () => {
		const shape = nodeToShape(knowledge, { x: 100, y: 200 });

		expect(shape.type).toBe("geo");
		expect(shape.props.color).toBe("orange");
		expect(nodeLabel(knowledge)).toBe("Knowledge: configurar llenadora");
		expect(shape.props.richText).toBeDefined();
		expect(shape.x).toBe(100);
		expect(shape.y).toBe(200);
	});

	it("maps a Process node to green", () => {
		expect(getNodeColor("Process")).toBe("green");
	});

	it("maps an Asset node to violet", () => {
		expect(getNodeColor("Asset")).toBe("violet");
	});

	it("maps a Unit node to grey", () => {
		expect(getNodeColor("Unit")).toBe("grey");
	});

	it("maps a Risk node to red", () => {
		expect(getNodeColor("Risk")).toBe("red");
	});

	it("falls back to black for unknown node types", () => {
		expect(getNodeColor("Unknown" as any)).toBe("black");
	});

	it("maps an edge to an arrow shape from source centre to target centre", () => {
		const edge: GraphEdge = {
			id: "edge-1",
			type: "MASTERS",
			fromNodeId: person.id,
			toNodeId: knowledge.id,
			attributes: { level: 5 },
		};

		const n1 = nodeToShape(person, { x: 50, y: 100 });
		const n2 = nodeToShape(knowledge, { x: 250, y: 100 });

		const arrow = edgeToShape(edge, n1, n2);

		expect(arrow.type).toBe("arrow");
		expect(arrow.props.color).toBe("black");
		expect(arrow.props.richText).toBeDefined();
		// Terminals are points (v3+), not bindings; end is offset toward target.
		expect(arrow.props.start).toEqual({ x: 0, y: 0 });
		expect(arrow.props.end.x).toBe(200); // 250 - 50
		expect(arrow.props.end.y).toBe(0);
	});

	it("edgeToShape still returns a shape for degenerate edges", () => {
		const edge: GraphEdge = {
			id: "edge-2",
			type: "REQUIRES",
			fromNodeId: "missing-1",
			toNodeId: "missing-2",
		};

		const fallbackNode = nodeToShape(person, { x: 0, y: 0 });

		const arrow = edgeToShape(edge, fallbackNode, fallbackNode);
		expect(arrow.type).toBe("arrow");
	});

	it("each node type has a distinct node shape with correct labeling", () => {
		const nodes: GraphNode[] = [
			person,
			knowledge,
			processNode,
			assetNode,
			unitNode,
			riskNode,
		];

		const shapes = nodes.map((n, i) => nodeToShape(n, { x: i * 200, y: 0 }));

		expect(shapes).toHaveLength(6);
		const colors = shapes.map((s) => s.props.color);
		expect(new Set(colors).size).toBe(6); // all distinct
		expect(colors).toEqual([
			"blue",
			"orange",
			"green",
			"violet",
			"grey",
			"red",
		]);
	});
});

describe("canvas sync layer", () => {
	it("computes a layout grid from a list of nodes", () => {
		// ponytail: simple grid layout, no force-directed
		const nodes: GraphNode[] = [person, knowledge, processNode, riskNode];
		const shapes = nodes.map((n, i) =>
			nodeToShape(n, { x: (i % 2) * 300, y: Math.floor(i / 2) * 200 }),
		);

		expect(shapes).toHaveLength(4);
		expect(shapes[0].x).toBe(0);
		expect(shapes[0].y).toBe(0);
		expect(shapes[1].x).toBe(300);
		expect(shapes[1].y).toBe(0);
		expect(shapes[2].x).toBe(0);
		expect(shapes[2].y).toBe(200);
		expect(shapes[3].x).toBe(300);
		expect(shapes[3].y).toBe(200);
	});

	it("generates unique shape IDs based on node/edge ID", () => {
		const shape = nodeToShape(person, { x: 0, y: 0 });
		expect(shape.id).toBe("shape:node-person");

		const shape2 = nodeToShape(knowledge, { x: 100, y: 0 });
		expect(shape2.id).toBe("shape:node-k-1");
	});

	it("produces valid tldraw shapes with required props", () => {
		const shape = nodeToShape(person, { x: 10, y: 20 });

		// All shapes must have id, type, props
		expect(shape.id).toBeDefined();
		expect(shape.type).toBeDefined();
		expect(shape.x).toBe(10);
		expect(shape.y).toBe(20);
		expect(shape.props).toBeDefined();
		expect(shape.props.w).toBeGreaterThan(0);
		expect(shape.props.h).toBeGreaterThan(0);
	});
});
