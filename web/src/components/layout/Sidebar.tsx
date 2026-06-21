"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Item = { href: string; label: string; icon: ReactNode };

const I = (d: string) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		className="h-[18px] w-[18px]"
	>
		<path d={d} />
	</svg>
);

const NAV_ITEMS: Item[] = [
	{ href: "/", label: "Dashboard", icon: I("M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7V11h-7v9Zm0-16v5h7V4h-7Z") },
	{ href: "/capture", label: "Capture", icon: I("M5 6h14M5 11h14M5 16h8M16.5 18.5l2 2 3.5-4") },
	{ href: "/inbox", label: "Inbox", icon: I("M4 13h4l2 3h4l2-3h4M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5") },
	{ href: "/people", label: "People", icon: I("M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z") },
	{ href: "/knowledge", label: "Knowledge", icon: I("M4 5.5C4 4.7 4.7 4 5.5 4H20v15H6a2 2 0 0 0-2 2V5.5ZM6 19h14") },
	{ href: "/graph", label: "Graph", icon: I("M7.5 8.5l3 7m6-7-3 7M6 8a1.6 1.6 0 1 0 0-.1M18 8a1.6 1.6 0 1 0 0-.1M12 18a1.6 1.6 0 1 0 0-.1") },
	{ href: "/genome", label: "Genome", icon: I("M7 4c0 6 10 10 10 16M17 4c0 6-10 10-10 16M8 7h8M8 17h8") },
	{ href: "/simulator", label: "Simulator", icon: I("M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z") },
	{ href: "/succession", label: "Succession", icon: I("M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c0-2.5 2.5-4 6-4M15 8h6m-3-3 3 3-3 3M17 19c0-1.7-1-3-2.5-3.5") },
	{ href: "/settings", label: "Settings", icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 12h2m12 0h2M12 4v2m0 12v2") },
];

export default function Sidebar() {
	const pathname = usePathname();
	const [inboxCount, setInboxCount] = useState(0);

	// Pending review count for the Inbox badge. Refreshes on navigation.
	useEffect(() => {
		let active = true;
		fetch("/api/inbox")
			.then((r) => (r.ok ? r.json() : { count: 0 }))
			.then((d) => active && setInboxCount(d.count ?? 0))
			.catch(() => {});
		return () => {
			active = false;
		};
	}, [pathname]);

	return (
		<aside className="sidebar-desktop fixed left-0 top-0 z-30 flex h-full w-60 flex-col border-r bg-[var(--paper)]/70 backdrop-blur-sm">
			{/* Wordmark */}
			<div className="flex h-16 items-center gap-2.5 border-b px-5">
				<span
					aria-hidden
					className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--ink)] text-[13px] font-semibold text-[var(--paper)]"
				>
					◐
				</span>
				<span className="font-display text-[17px] font-semibold leading-none">
					Company Brain
				</span>
			</div>

			{/* Nav */}
			<nav className="flex-1 px-3 py-5">
				<div className="eyebrow px-2 pb-2">Navigate</div>
				<div className="space-y-0.5">
					{NAV_ITEMS.map((item) => {
						const isActive =
							pathname === item.href ||
							(item.href !== "/" && pathname.startsWith(item.href));
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
									isActive
										? "bg-[var(--surface)] font-medium text-[var(--ink)] shadow-[0_1px_2px_rgba(26,22,19,0.05)]"
										: "text-[var(--ink-2)] hover:bg-[var(--surface)]/60 hover:text-[var(--ink)]"
								}`}
							>
								<span
									className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--cobalt)] transition-opacity ${
										isActive ? "opacity-100" : "opacity-0"
									}`}
								/>
								<span
									className={
										isActive ? "text-[var(--cobalt)]" : "text-[var(--ink-3)]"
									}
								>
									{item.icon}
								</span>
								{item.label}
								{item.href === "/inbox" && inboxCount > 0 && (
									<span className="ml-auto rounded-full bg-[var(--cobalt)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
										{inboxCount}
									</span>
								)}
							</Link>
						);
					})}
				</div>
			</nav>

			{/* Footer */}
			<div className="border-t px-5 py-4">
				<div className="eyebrow">Company Brain OS</div>
				<div className="mt-1 text-[11px] text-[var(--ink-3)]">
					Knowledge-risk intelligence · v0.10
				</div>
			</div>
		</aside>
	);
}
