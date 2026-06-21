import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
	oxc: false,
	test: {
		include: ["src/**/*.test.ts"],
		exclude: ["src/**/*.integration.test.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
