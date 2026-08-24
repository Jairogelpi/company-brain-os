import { describe, expect, it } from "vitest";
import { hydrateGraphService } from "./hydrate-graph";

describe("hydrateGraphService", () => {
	it("requires an explicit organization context", () => {
		expect(() => hydrateGraphService([], [], "")).toThrow("Organization context is required");
	});
});
