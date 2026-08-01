import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			coverage: {
				provider: "v8",
				include: [
					"src/domain/assertions.ts",
					"src/domain/graph-projection.ts",
					"src/domain/assertion-projection-service.ts",
					"src/domain/risk-rules.ts",
					"src/domain/risk-engine.ts",
				],
				thresholds: {
					lines: 95,
					functions: 95,
					// Decision paths are tracked separately while the R0 gate enforces
					// at least 95% executable-code coverage.
					branches: 80,
					statements: 95,
				},
			},
			include: [
				"src/domain/assertions.test.ts",
				"src/domain/graph-projection.test.ts",
				"src/domain/assertion-projection-service.test.ts",
				"src/domain/risk-rules.test.ts",
				"src/domain/risk-engine.test.ts",
			],
		},
	}),
);
