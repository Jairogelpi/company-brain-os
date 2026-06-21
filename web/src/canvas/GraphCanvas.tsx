"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Tldraw,
	useEditor,
	createShapeId,
	renderPlaintextFromRichText,
	type Editor,
	type TLShape,
} from "tldraw";
import "tldraw/tldraw.css";

import type { GraphService } from "@/domain/graph-service";
import type { GraphNode, NodeType, KnowledgeNode } from "@/domain/graph";
import { nodeToShape, edgeToShape } from "./canvas-mapping";

export type GraphCanvasProps = {
	service: GraphService;
	/** Incremented by parent to trigger sync from external events (e.g. interview proposals). */
	syncVersion?: number;
};

export default function GraphCanvas({
	service,
	syncVersion,
}: GraphCanvasProps) {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return (
			<div className="flex h-[600px] items-center justify-center text-slate-500">
				Loading canvas...
			</div>
		);
	}

	return (
		<div className="h-[600px] w-full rounded-xl border shadow-sm">
			<Tldraw>
				<CanvasSync service={service} syncVersion={syncVersion} />
			</Tldraw>
		</div>
	);
}

// --- Helpers ---

const VALID_NODE_TYPES = new Set<string>([
	"Person",
	"Knowledge",
	"Process",
	"Asset",
	"Unit",
	"Risk",
]);

function parseNodeType(text: string): NodeType | null {
	const colon = text.indexOf(":");
	if (colon === -1) return null;
	const candidate = text.slice(0, colon).trim();
	return VALID_NODE_TYPES.has(candidate) ? (candidate as NodeType) : null;
}

function parseNodeName(text: string): string {
	const colon = text.indexOf(":");
	return colon === -1 ? text : text.slice(colon + 1).trim();
}

function shapeIdToDomainId(shapeId: string): string {
	return shapeId.startsWith("shape:") ? shapeId.slice(6) : shapeId;
}

function domainIdToShapeId(id: string): ReturnType<typeof createShapeId> {
	return createShapeId(id);
}

type RichTextShapeLike = { props?: { richText?: unknown } };

/** Read a geo/arrow shape's plain-text label (v3+ stores it as richText). */
function readLabel(editor: Editor, shape: RichTextShapeLike): string {
	const rich = shape.props?.richText;
	if (!rich) return "";
	try {
		return renderPlaintextFromRichText(
			editor,
			rich as Parameters<typeof renderPlaintextFromRichText>[1],
		);
	} catch {
		return "";
	}
}

// --- Canvas → Service Sync ---

function CanvasSync({
	service,
	syncVersion,
}: {
	service: GraphService;
	syncVersion?: number;
}) {
	const editor = useEditor();
	const isSyncing = useRef(false);
	const eventCount = useRef(0);

	const syncToCanvas = useCallback(() => {
		if (!editor || isSyncing.current) return;
		isSyncing.current = true;

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

			const allNewIds = new Set(nodeShapes.map((s) => s.id));
			const edgeShapes: ReturnType<typeof edgeToShape>[] = [];

			for (const e of edges) {
				const sourceShape = nodeShapes.find(
					(ns) => ns.id === domainIdToShapeId(e.fromNodeId),
				);
				const targetShape = nodeShapes.find(
					(ns) => ns.id === domainIdToShapeId(e.toNodeId),
				);
				if (!sourceShape || !targetShape) continue;
				allNewIds.add(domainIdToShapeId(e.id));
				edgeShapes.push(edgeToShape(e, sourceShape, targetShape));
			}

			// Delete shapes that no longer exist in the service
			const toDelete = [...existingIds].filter((id) => !allNewIds.has(id));
			if (toDelete.length > 0) {
				editor.deleteShapes(toDelete);
			}

			editor.createShapes([
				...nodeShapes,
				...edgeShapes,
			] as unknown as TLShape[]);
		} finally {
			isSyncing.current = false;
		}
	}, [editor, service]);

	// --- Canvas → Service write-back ---

	useEffect(() => {
		if (!editor) return;

		const unsubscribes: (() => void)[] = [];

		unsubscribes.push(
			editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
				if (isSyncing.current) return;
				if (shape.type !== "geo") return;
				const text = readLabel(editor, shape as RichTextShapeLike);
				const nodeType = parseNodeType(text);
				if (!nodeType) return;
				const nodeName = parseNodeName(text);
				if (!nodeName) return;

				const domainId = shapeIdToDomainId(shape.id);
				const node: GraphNode = {
					id: domainId,
					type: nodeType,
					name: nodeName,
				} as GraphNode;

				if (nodeType === "Knowledge") {
					(node as KnowledgeNode).knowledgeType = "technical";
					(node as KnowledgeNode).documented = false;
					(node as KnowledgeNode).validationState = "proposed";
					(node as KnowledgeNode).confidence = 25;
					(node as KnowledgeNode).criticality = "medium";
				}

				try {
					service.createNode(node);
				} catch {
					// idempotent: node may already exist
				}
			}),
		);

		unsubscribes.push(
			editor.sideEffects.registerAfterChangeHandler("shape", (_prev, next) => {
				if (isSyncing.current) return;
				if (next.type !== "geo") return;
				const domainId = shapeIdToDomainId(next.id);
				const text = readLabel(editor, next as RichTextShapeLike);
				const nodeName = parseNodeName(text);

				try {
					service.updateNode(domainId, {
						name: nodeName || undefined,
					} as Partial<GraphNode>);
				} catch {
					// node may have been deleted
				}
			}),
		);

		unsubscribes.push(
			editor.sideEffects.registerBeforeDeleteHandler("shape", (shape) => {
				if (isSyncing.current) return;
				if (shape.type !== "geo") return;
				const domainId = shapeIdToDomainId(shape.id);
				try {
					service.deleteNode(domainId);
				} catch {
					// already deleted
				}
			}),
		);

		return () => {
			for (const unsub of unsubscribes) unsub();
		};
	}, [editor, service]);

	// --- Sync on mount, on service changes, and on external syncVersion ---

	useEffect(() => {
		const timer = requestAnimationFrame(() => {
			syncToCanvas();
		});
		return () => cancelAnimationFrame(timer);
	}, [syncToCanvas]);

	useEffect(() => {
		const currentCount = service.eventLog().length;
		if (currentCount !== eventCount.current) {
			eventCount.current = currentCount;
			syncToCanvas();
		}
	});

	// External sync trigger (from interview proposals applied, etc.)
	useEffect(() => {
		if (syncVersion !== undefined) {
			syncToCanvas();
		}
	}, [syncVersion, syncToCanvas]);

	return null;
}
