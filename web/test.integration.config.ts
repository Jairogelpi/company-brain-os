import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		include: ["src/**/*.integration.test.ts"],
		environment: "node",
		testTimeout: 120_000,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
