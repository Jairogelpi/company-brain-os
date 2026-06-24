import { getGraphService } from "@/server/graph";
import { listCompanyUsers } from "@/server/users";

export type CompanyPerson = {
	id: string;
	name: string;
	source: "graph" | "user";
};

/**
 * Combined, de-duplicated list of the company's people: Person nodes already
 * mapped into the graph + app user accounts. Used to populate person pickers in
 * the graph and the interview so people are chosen, not retyped. De-duped by
 * lower-cased name; existing graph nodes win (so picking one reuses its id).
 */
export async function listCompanyPeople(
	companyId: string,
): Promise<CompanyPerson[]> {
	const graph = getGraphService(companyId);
	const [nodes, users] = await Promise.all([
		graph.listNodes(),
		listCompanyUsers(companyId),
	]);

	const byName = new Map<string, CompanyPerson>();
	for (const n of nodes) {
		if (n.type !== "Person") continue;
		byName.set(n.name.trim().toLowerCase(), {
			id: n.id,
			name: n.name,
			source: "graph",
		});
	}
	for (const u of users) {
		const key = u.name.trim().toLowerCase();
		if (byName.has(key)) continue; // graph node already represents this person
		byName.set(key, { id: u.id, name: u.name, source: "user" });
	}

	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
