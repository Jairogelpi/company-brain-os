"use client";

import { useEffect, useRef, useState } from "react";
import {
	Tldraw,
	useEditor,
	renderPlaintextFromRichText,
	type Editor,
} from "tldraw";
import "tldraw/tldraw.css";

import type { GraphService } from "@/domain/graph-service";
import { createCanvasSync, type EditorLikeShape } from "./canvas-sync";

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

type RichTextShapeLike = { props?: { richText?: unknown } };

/** Read a geo/arrow shape's plain-text label (v3+ stores it as richText). */
function readRichTextLabel(editor: Editor, shape: RichTextShapeLike): string {
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
	const eventCount = useRef(0);
	const syncRef = useRef<ReturnType<typeof createCanvasSync> | null>(null);

	useEffect(() => {
		if (!editor) return;
		const sync = createCanvasSync(editor, service, {
			readLabel: (shape: EditorLikeShape) =>
				readRichTextLabel(editor, shape as RichTextShapeLike),
		});
		syncRef.current = sync;
		sync.syncToCanvas();
		return () => {
			sync.dispose();
			syncRef.current = null;
		};
	}, [editor, service]);

	useEffect(() => {
		const currentCount = service.eventLog().length;
		if (currentCount !== eventCount.current) {
			eventCount.current = currentCount;
			syncRef.current?.syncToCanvas();
		}
	});

	useEffect(() => {
		if (syncVersion !== undefined) {
			syncRef.current?.syncToCanvas();
		}
	}, [syncVersion]);

	return null;
}
