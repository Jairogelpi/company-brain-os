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

function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
}

export function normalizeSignupBody(body: { email: string; password: string; companyName: string }): SignupBody {
	const companyName = body.companyName.trim();
	return {
		email: body.email.trim().toLowerCase(),
		password: body.password,
		companyName,
		slug: slugify(companyName),
	};
}

export function validateSignup(body: unknown): SignupValidationError | null {
	if (!body || typeof body !== "object") return { field: "email" };
	const input = body as Partial<Record<string, unknown>>;
	const email = typeof input.email === "string" ? input.email.trim() : "";
	const password = typeof input.password === "string" ? input.password : "";
	const companyName =
		typeof input.companyName === "string" ? input.companyName.trim() : "";
	const slug = typeof input.slug === "string" ? input.slug.trim() : "";

	if (!EMAIL_RE.test(email)) return { field: "email" };
	if (password.length < 8) return { field: "password" };
	if (!companyName) return { field: "companyName" };
	if (slug && !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])$/.test(slug)) {
		return { field: "slug" };
	}
	return null;
}
