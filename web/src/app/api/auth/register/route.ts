import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { companies, users } from "@/db/schema";
import {
	normalizeSignupBody,
	PASSWORD_BCRYPT_ROUNDS,
	validateSignup,
	type SignupBody,
} from "@/auth/signup-validation";
import { checkDistributedRateLimit } from "@/lib/rate-limiter";

export const runtime = "nodejs";

type UniqueViolation = {
	code?: string;
	constraint?: string;
};

function uniqueViolationField(error: unknown): "email" | "slug" | null {
	const err = error as UniqueViolation;
	if (err.code !== "23505") return null;
	if (
		err.constraint === "users_email_unique" ||
		err.constraint === "users_email_idx"
	) {
		return "email";
	}
	if (
		err.constraint === "companies_slug_unique" ||
		err.constraint === "companies_slug_idx" ||
		err.constraint === "companies_pkey"
	) {
		return "slug";
	}
	return null;
}

function conflict(field: "email" | "slug") {
	return NextResponse.json({ error: "Conflict", field }, { status: 409 });
}

function invalid(field: string) {
	return NextResponse.json({ error: "Invalid signup", field }, { status: 422 });
}

export async function POST(req: Request) {
	const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	const client = forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
	try {
		const limit = await checkDistributedRateLimit(`signup:${client}`, 5, 3);
		if (!limit.allowed) {
			return NextResponse.json(
				{ error: "Too many signup attempts" },
				{ status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
			);
		}
	} catch {
		return NextResponse.json({ error: "Signup temporarily unavailable" }, { status: 503 });
	}
	let raw: unknown;
	try {
		raw = await req.json();
	} catch {
		return invalid("email");
	}

	const validation = validateSignup(raw);
	if (validation) return invalid(validation.field);
	const body = normalizeSignupBody(raw as SignupBody);
	const db = createDb();

	const existingEmail = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, body.email))
		.limit(1);
	if (existingEmail.length > 0) return conflict("email");

	const existingSlug = await db
		.select({ id: companies.id })
		.from(companies)
		.where(eq(companies.slug, body.slug))
		.limit(1);
	if (existingSlug.length > 0) return conflict("slug");

	try {
		const user = await db.transaction(async (tx) => {
			await tx.insert(companies).values({
				id: body.slug,
				name: body.companyName,
				slug: body.slug,
			});

			const passwordHash = await hash(body.password, PASSWORD_BCRYPT_ROUNDS);
			const [created] = await tx
				.insert(users)
				.values({
					id: `user-${globalThis.crypto.randomUUID()}`,
					email: body.email,
					name: body.email.split("@")[0] || body.email,
					passwordHash,
					companyId: body.slug,
					role: "owner",
					validationDomains: ["*"],
				})
				.returning();
			return created;
		});

		return NextResponse.json(
			{
				id: user.id,
				email: user.email,
				role: user.role,
				companyId: user.companyId,
			},
			{ status: 201 },
		);
	} catch (error) {
		const field = uniqueViolationField(error);
		if (field) return conflict(field);
		throw error;
	}
}
