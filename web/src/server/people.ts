import { getGraphService } from "@/server/graph";
import { listCompanyUsers } from "@/server/users";

export type CompanyPerson = {
	id: string;
	name: string;
	source: "graph";
	mappedUserId?: string;
};

/**
 * Canonical graph Person nodes, annotated with their explicit app-user mapping.
 * User IDs are never returned as graph IDs: that old shortcut allowed pickers to
 * reference nodes that did not exist and made independent review name-based.
 */
export async function listCompanyPeople(
	companyId: string,
): Promise<CompanyPerson[]> {
	const graph = getGraphService(companyId);
	const [nodes, users] = await Promise.all([
		graph.listNodes(),
		listCompanyUsers(companyId),
	]);

	const userByPerson = new Map(users
		.filter((user) => user.personNodeId)
		.map((user) => [user.personNodeId!, user.id]));
	const people: CompanyPerson[] = [];
	for (const n of nodes) {
		if (n.type !== "Person") continue;
		people.push({
			id: n.id,
			name: n.name,
			source: "graph",
			mappedUserId: userByPerson.get(n.id),
		});
	}
	return people.sort((a, b) => a.name.localeCompare(b.name));
}
