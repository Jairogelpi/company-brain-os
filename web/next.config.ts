import type { NextConfig } from "next";

const scriptPolicy = process.env.NODE_ENV === "production"
	? "script-src 'self' 'unsafe-inline'"
	: "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const nextConfig: NextConfig = {
	output: "standalone",
	outputFileTracingRoot: process.cwd(),
	// pg (and its pgpass dep) use node's fs/path; keep them external so the
	// instrumentation worker boot doesn't drag them into the webpack bundle.
	serverExternalPackages: ["pg"],
	experimental: {
		viewTransition: true,
	},
	async headers() {
		return [{
			source: "/(.*)",
			headers: [
				{ key: "X-Content-Type-Options", value: "nosniff" },
				{ key: "X-Frame-Options", value: "DENY" },
				{ key: "Referrer-Policy", value: "no-referrer" },
				{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
				{ key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=()" },
				{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
				{
					key: "Content-Security-Policy",
					value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https: wss:`,
				},
			],
		}];
	},
};

export default nextConfig;
