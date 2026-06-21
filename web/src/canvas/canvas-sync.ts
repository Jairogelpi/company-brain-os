import type { GraphService } from "@/domain/graph-service";
import type { GraphNode, KnowledgeNode, NodeType } from "@/domain/graph";
import { edgeToShape, nodeToShape } from "./canvas-mapping";

export type EditorLikeShape = {
	id: string;
	type: string;
	props?: unknown;
};

export interface EditorLike {
	getCurrentPageShapes(): EditorLikeShape[];
	createShapes(shapes: unknown[]): void;
	deleteShapes(ids: string[]): void;
	sideEffects: {
		registerAfterCreateHandler(
			kind: "shape",
			handler: (shape: EditorLikeShape) => void,
		): () => void;
		registerAfterChangeHandler(
			kind: "shape",
			handler: (prev: EditorLikeShape, next: EditorLikeShape) => void,
		): () => void;
		registerBeforeDeleteHandler(
			kind: "shape",
			handler: (shape: EditorLikeShape) => void,
		): () => void;
	};
}

const VALID_NODE_TYPES = new Set<string>([
	"Person",
	"Knowledge",
	"Process",
	"Asset",
	"Unit",
	"Risk",
]);

export function parseNodeType(text: string): NodeType | null {
	const colon = text.indexOf(":");
	if (colon === -1) return null;
	const candidate = text.slice(0, colon).trim();
	return VALID_NODE_TYPES.has(candidate) ? (candidate as NodeType) : null;
}

export function parseNodeName(text: string): string {
	const colon = text.indexOf(":");
	return colon === -1 ? text : text.slice(colon + 1).trim();
}

export function shapeIdToDomainId(shapeId: string): string {
	return shapeId.startsWith("shape:") ? shapeId.slice(6) : shapeId;
}

export function domainIdToShapeId(id: string): `shape:${string}` {
	return `shape:${id}`;
}

export function readLabel(shape: EditorLikeShape): string {
	const props = shape.props as { text?: unknown } | undefined;
	const text = props?.text;
	return typeof text === "string" ? text : "";
}

function toNode(
	shape: EditorLikeShape,
	labelReader: (shape: EditorLikeShape) => string,
): GraphNode | null {
	if (shape.type !== "geo") return null;
	const text = labelReader(shape);
	const type = parseNodeType(text);
	if (!type) return null;
	const name = parseNodeName(text);
	if (!name) return null;
	const node: GraphNode = {
		id: shapeIdToDomainId(shape.id),
		type,
		name,
	};
	if (type === "Knowledge") {
		(node as KnowledgeNode).knowledgeType = "technical";
		(node as KnowledgeNode).documented = false;
		(node as KnowledgeNode).validationState = "proposed";
		(node as KnowledgeNode).confidence = 25;
		(node as KnowledgeNode).criticality = "medium";
	}
	return node;
}

export function createCanvasSync(
	editor: EditorLike,
	service: GraphService,
	options?: { readLabel?: (shape: EditorLikeShape) => string },
) {
	const labelReader = options?.readLabel ?? readLabel;
	let isSyncing = false;

	function syncToCanvas() {
		if (isSyncing) return;
		isSyncing = true;
		try {
			const nodes = service.listNodes();
			const edges = service.listEdges();
			const existingShapes = editor.getCurrentPageShapes();
			const existingIds = new Set(existingShapes.map((s) => s.id));
			const nodeShapes = nodes.map((n, i) =>
				nodeToShape(n, {
					x: (i % 3) * 280 + 50,
					y: Math.floor(i / 3) * 160 + 50,
				}),
			);
			const allNewIds = new Set<string>(nodeShapes.map((s) => s.id));
			const edgeShapes: ReturnType<typeof edgeToShape>[] = [];

			for (const edge of edges) {
				const sourceShape = nodeShapes.find(
					(s) => s.id === domainIdToShapeId(edge.fromNodeId),
				);
				const targetShape = nodeShapes.find(
					(s) => s.id === domainIdToShapeId(edge.toNodeId),
				);
				if (!sourceShape || !targetShape) continue;
				allNewIds.add(domainIdToShapeId(edge.id));
				edgeShapes.push(edgeToShape(edge, sourceShape, targetShape));
			}

			const toDelete = [...existingIds].filter((id) => !allNewIds.has(id));
			if (toDelete.length > 0) editor.deleteShapes(toDelete);
			editor.createShapes([...nodeShapes, ...edgeShapes]);
		} finally {
			isSyncing = false;
		}
	}

	const unsubscribes = [
		editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
			if (isSyncing) return;
			const node = toNode(shape, labelReader);
			if (!node) return;
			try {
				service.createNode(node);
			} catch {
				// idempotent: node may already exist
			}
		}),
		editor.sideEffects.registerAfterChangeHandler("shape", (_prev, next) => {
			if (isSyncing || next.type !== "geo") return;
			try {
				service.updateNode(shapeIdToDomainId(next.id), {
					name: parseNodeName(labelReader(next)) || undefined,
				} as Partial<GraphNode>);
			} catch {
				// node may have been deleted
			}
		}),
		editor.sideEffects.registerBeforeDeleteHandler("shape", (shape) => {
			if (isSyncing || shape.type !== "geo") return;
			try {
				service.deleteNode(shapeIdToDomainId(shape.id));
			} catch {
				// already deleted
			}
		}),
	];

	return {
		syncToCanvas,
		dispose: () => {
			for (const unsubscribe of unsubscribes) unsubscribe();
		},
	};
}
