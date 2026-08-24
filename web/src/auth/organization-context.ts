export function requireOrganizationId(value: string | null | undefined): string {
	if (!value?.trim()) throw new Error("Organization context is required");
	return value;
}
