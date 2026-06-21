export type SignupField = "email" | "password" | "companyName" | "slug";

export type SignupValidationError = {
	field: SignupField;
};

export type SignupBody = {
	email: string;
	password: string;
	companyName: string;
	slug: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function normalizeSignupBody(body: SignupBody): SignupBody {
	return {
		email: body.email.trim().toLowerCase(),
		password: body.password,
		companyName: body.companyName.trim(),
		slug: body.slug.trim(),
	};
}

export function validateSignup(body: unknown): SignupValidationError | null {
	if (!body || typeof body !== "object") return { field: "email" };
	const input = body as Partial<Record<keyof SignupBody, unknown>>;
	const email = typeof input.email === "string" ? input.email.trim() : "";
	const password = typeof input.password === "string" ? input.password : "";
	const companyName =
		typeof input.companyName === "string" ? input.companyName.trim() : "";
	const slug = typeof input.slug === "string" ? input.slug.trim() : "";

	if (!EMAIL_RE.test(email)) return { field: "email" };
	if (password.length < 8) return { field: "password" };
	if (!companyName) return { field: "companyName" };
	if (!SLUG_RE.test(slug)) return { field: "slug" };
	return null;
}
