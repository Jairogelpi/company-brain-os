import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	outputFileTracingRoot: process.cwd(),
	// pg (and its pgpass dep) use node's fs/path; keep them external so the
	// instrumentation worker boot doesn't drag them into the webpack bundle.
	serverExternalPackages: ["pg"],
	experimental: {
		viewTransition: true,
	},
};

export default nextConfig;
