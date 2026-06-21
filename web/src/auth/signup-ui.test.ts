import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
function read(path: string): string {
	return readFileSync(join(root, "src", path), "utf8");
}

describe("signup UI wiring", () => {
	it("allows /register through authConfig public routes", () => {
		const config = read("auth/config.ts");
		expect(config).toContain('pathname === "/register"');
	});

	it("login page links to register", () => {
		const login = read("components/auth/LoginPage.tsx");
		expect(login).toContain('href="/register"');
	});

	it("register route renders RegisterPage", () => {
		const page = read("app/register/page.tsx");
		expect(page).toContain("RegisterPage");
	});

	it("RegisterPage links back to login and posts to register endpoint", () => {
		const register = read("components/auth/RegisterPage.tsx");
		expect(register).toContain('href="/login"');
		expect(register).toContain('/api/auth/register');
	});
});
