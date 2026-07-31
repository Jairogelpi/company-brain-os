import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
		coverage: {
				provider: "v8",
				include: ["src/domain/assertions.ts"],
				thresholds: {
					lines: 95,
					functions: 95,
					branches: 95,
					statements: 95,
				},
			},
			include: ["src/domain/assertions.test.ts"],
		},
	}),
);
