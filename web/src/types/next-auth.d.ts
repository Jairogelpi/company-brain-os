import type { UserRole } from "@/auth/permissions";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			role: UserRole;
			companyId: string;
			validationDomains: string[];
		} & DefaultSession["user"];
	}

	interface User {
		role?: UserRole;
		companyId?: string;
		validationDomains?: string[];
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id?: string;
		role?: UserRole;
		companyId?: string;
		validationDomains?: string[];
	}
}
