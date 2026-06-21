import { describe, expect, it, vi } from "vitest";
import type { GraphNode } from "@/domain/graph";
import { createGraphService } from "@/domain/graph-service";
import {
	createCanvasSync,
	type EditorLike,
	type EditorLikeShape,
} from "./canvas-sync";

class FakeEditor implements EditorLike {
	shapes: EditorLikeShape[] = [];
	created: unknown[][] = [];
	deleted: string[][] = [];
	afterCreate: ((shape: EditorLikeShape) => void)[] = [];
	afterChange: ((prev: EditorLikeShape, next: EditorLikeShape) => void)[] = [];
	beforeDelete: ((shape: EditorLikeShape) => void)[] = [];
	unsubscribes = [vi.fn(), vi.fn(), vi.fn()];
	sideEffects = {
		registerAfterCreateHandler: (
			_kind: "shape",
			h: (shape: EditorLikeShape) => void,
		) => {
			this.afterCreate.push(h);
			return this.unsubscribes[0];
		},
		registerAfterChangeHandler: (
			_kind: "shape",
			h: (prev: EditorLikeShape, next: EditorLikeShape) => void,
		) => {
			this.afterChange.push(h);
			return this.unsubscribes[1];
		},
		registerBeforeDeleteHandler: (
			_kind: "shape",
			h: (shape: EditorLikeShape) => void,
		) => {
			this.beforeDelete.push(h);
			return this.unsubscribes[2];
		},
	};
	getCurrentPageShapes() {
		return this.shapes;
	}
	createShapes(shapes: unknown[]) {
		this.created.push(shapes);
		this.shapes = [...this.shapes, ...(shapes as EditorLikeShape[])];
	}
	deleteShapes(ids: string[]) {
		this.deleted.push(ids);
		this.shapes = this.shapes.filter((s) => !ids.includes(s.id));
	}
	fireCreate(shape: EditorLikeShape) {
		for (const h of this.afterCreate) h(shape);
	}
	fireChange(prev: EditorLikeShape, next: EditorLikeShape) {
		for (const h of this.afterChange) h(prev, next);
	}
	fireDelete(shape: EditorLikeShape) {
		for (const h of this.beforeDelete) h(shape);
	}
}

function geo(id: string, text: string): EditorLikeShape {
	return { id: `shape:${id}`, type: "geo", props: { text } };
}

describe("createCanvasSync", () => {
	it("writes created geo node shapes back to the graph service", () => {
		const service = createGraphService();
		const editor = new FakeEditor();
		createCanvasSync(editor, service);

		editor.fireCreate(geo("person-ana", "Person: Ana"));

		expect(service.readNode("person-ana")).toEqual(
			expect.objectContaining({
				id: "person-ana",
				type: "Person",
				name: "Ana",
			}),
		);
	});

	it("deletes graph nodes before matching geo shapes are deleted", () => {
		const service = createGraphService();
		service.createNode({ id: "person-ana", type: "Person", name: "Ana" });
		const editor = new FakeEditor();
		createCanvasSync(editor, service);

		editor.fireDelete(geo("person-ana", "Person: Ana"));

		expect(service.readNode("person-ana")).toBeUndefined();
	});

	it("syncs service nodes to canvas shapes", () => {
		const service = createGraphService();
		const node: GraphNode = { id: "person-ana", type: "Person", name: "Ana" };
		service.createNode(node);
		const editor = new FakeEditor();
		const sync = createCanvasSync(editor, service);

		sync.syncToCanvas();

		expect(editor.created.at(-1)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "shape:person-ana" }),
			]),
		);
	});

	it("disposes all registered canvas handlers", () => {
		const service = createGraphService();
		const editor = new FakeEditor();
		const sync = createCanvasSync(editor, service);

		sync.dispose();

		for (const unsubscribe of editor.unsubscribes) {
			expect(unsubscribe).toHaveBeenCalledTimes(1);
		}
	});
});
