/**
 * Multi-company service — create and manage company tenants.
 */

export interface Company {
	id: string;
	name: string;
	slug: string;
	createdAt: string;
}

const companies = new Map<string, Company>();

export class CompanySlugConflictError extends Error {
	constructor(
		readonly slug: string,
		readonly existingId: string,
	) {
		super(`Company slug already exists: ${slug}`);
		this.name = "CompanySlugConflictError";
	}
}

export function createCompany(name: string): Company {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);
	if (!slug) {
		throw new Error("Company name must produce a non-empty slug");
	}
	const id = `company-${slug}`;

	if (companies.has(id)) {
		throw new CompanySlugConflictError(slug, id);
	}

	const company: Company = {
		id,
		name,
		slug,
		createdAt: new Date().toISOString(),
	};

	companies.set(id, company);
	return company;
}

export function getCompany(id: string): Company | undefined {
	return companies.get(id);
}

export function listCompanies(): Company[] {
	return [...companies.values()];
}

export function companyExists(id: string): boolean {
	return companies.has(id);
}
