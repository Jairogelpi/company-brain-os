"use client";

import Sidebar from "@/components/layout/Sidebar";
import GlobalSearch from "@/components/layout/GlobalSearch";
import { useAuth } from "@/components/auth/AuthProvider";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

function AppContent({ children }: { children: ReactNode }) {
	const { user, logout } = useAuth();

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<div className="main-content ml-60 flex flex-1 flex-col">
				<div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background px-8">
					<div className="flex-1" />
					<div className="flex items-center gap-5">
						<GlobalSearch />
						<div className="flex items-center gap-3 border-l border-border pl-5">
							<div className="text-right leading-tight">
								<div className="text-[13px] font-medium text-foreground">
									{user?.name ?? "—"}
								</div>
								<div className="eyebrow">{user?.role ?? ""}</div>
							</div>
							<div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
								{user?.name?.charAt(0).toUpperCase() ?? "?"}
							</div>
							<button
								onClick={logout}
								className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
							>
								Sign out
							</button>
						</div>
					</div>
				</div>
				<div className="flex-1">{children}</div>
			</div>
			<Toaster />
		</div>
	);
}

export default function AppLayout({ children }: { children: ReactNode }) {
	return <AppContent>{children}</AppContent>;
}
