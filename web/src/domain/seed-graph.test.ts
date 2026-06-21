import { describe, expect, it } from "vitest";
import { createInMemoryGraphRepository } from "@/db/repository";
import { createPersistentGraphService } from "./persistent-graph-service";
import { seedDemoGraph, buildDemoSession } from "./seed-graph";

describe("seed-graph", () => {
	it("builds a demo interview session with proposals", () => {
		const session = buildDemoSession();
		expect(session.proposals.length).toBeGreaterThan(0);
	});

	it("seeds nodes into a persistent service", async () => {
		const repo = createInMemoryGraphRepository();
		const service = createPersistentGraphService(repo, {
			companyId: "demo-corp",
			actorId: "test",
		});

		const result = await seedDemoGraph(service);
		expect(result.seeded).toBe(true);
		expect(result.nodeCount).toBeGreaterThan(0);

		const nodes = await service.listNodes();
		expect(nodes.some((n) => n.type === "Person")).toBe(true);
		expect(nodes.some((n) => n.type === "Knowledge")).toBe(true);
	});

	it("is idempotent — second seed is a no-op", async () => {
		const repo = createInMemoryGraphRepository();
		const service = createPersistentGraphService(repo, {
			companyId: "demo-corp",
		});

		const first = await seedDemoGraph(service);
		const second = await seedDemoGraph(service);

		expect(first.seeded).toBe(true);
		expect(second.seeded).toBe(false);
		expect(second.nodeCount).toBe(first.nodeCount);
	});
});
