"use client";

import Sidebar from "@/components/layout/Sidebar";
import GlobalSearch from "@/components/layout/GlobalSearch";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ReactNode } from "react";

function AppContent({ children }: { children: ReactNode }) {
	const { user, logout } = useAuth();

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<div className="main-content ml-60 flex flex-1 flex-col">
				{/* Top bar with search + user */}
				<div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-[var(--paper)]/70 px-8 backdrop-blur-md">
					<div className="flex-1" />
					<div className="flex items-center gap-5">
						<GlobalSearch />
						<div className="flex items-center gap-3 border-l border-[var(--hairline)] pl-5">
							<div className="text-right leading-tight">
								<div className="text-[13px] font-medium text-[var(--ink)]">
									{user?.name ?? "—"}
								</div>
								<div className="eyebrow">{user?.role ?? ""}</div>
							</div>
							<div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] font-display text-sm font-semibold text-[var(--paper)]">
								{user?.name?.charAt(0).toUpperCase() ?? "?"}
							</div>
							<button
								onClick={logout}
								className="rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 text-[11px] text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink)]"
							>
								Sign out
							</button>
						</div>
					</div>
				</div>
				{/* Page content */}
				<div className="flex-1">{children}</div>
			</div>
		</div>
	);
}

export default function AppLayout({ children }: { children: ReactNode }) {
	return <AppContent>{children}</AppContent>;
}
