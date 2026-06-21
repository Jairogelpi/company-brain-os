"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
	LayoutDashboard,
	ScanLine,
	Inbox,
	Users,
	BookOpen,
	GitBranch,
	Dna,
	SlidersHorizontal,
	Share2,
	Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: ReactNode };

function Icon({ children }: { children: ReactNode }) {
	return <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{children}</span>;
}

const NAV_ITEMS: Item[] = [
	{ href: "/", label: "Dashboard", icon: <Icon><LayoutDashboard /></Icon> },
	{ href: "/capture", label: "Capture", icon: <Icon><ScanLine /></Icon> },
	{ href: "/inbox", label: "Inbox", icon: <Icon><Inbox /></Icon> },
	{ href: "/people", label: "People", icon: <Icon><Users /></Icon> },
	{ href: "/knowledge", label: "Knowledge", icon: <Icon><BookOpen /></Icon> },
	{ href: "/graph", label: "Graph", icon: <Icon><GitBranch /></Icon> },
	{ href: "/genome", label: "Genome", icon: <Icon><Dna /></Icon> },
	{ href: "/simulator", label: "Simulator", icon: <Icon><SlidersHorizontal /></Icon> },
	{ href: "/succession", label: "Succession", icon: <Icon><Share2 /></Icon> },
	{ href: "/settings", label: "Settings", icon: <Icon><Settings /></Icon> },
];

export default function Sidebar() {
	const pathname = usePathname();
	const [inboxCount, setInboxCount] = useState(0);

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
		<aside className="sidebar-desktop fixed left-0 top-0 z-30 flex h-full w-60 flex-col border-r bg-background">
			<div className="flex h-16 items-center gap-2.5 border-b px-5">
				<span
					aria-hidden
					className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-[13px] font-semibold text-background"
				>
					◐
				</span>
				<span className="text-[17px] font-medium leading-none tracking-tight">
					Company Brain
				</span>
			</div>

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
								className={cn(
									"group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
									isActive
										? "bg-secondary font-medium text-foreground"
										: "text-muted-foreground hover:bg-secondary hover:text-foreground",
								)}
							>
								<span
									className={cn(
										"absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-foreground transition-opacity",
										isActive ? "opacity-100" : "opacity-0",
									)}
								/>
								<span
									className={cn(
										isActive ? "text-foreground" : "text-muted-foreground",
									)}
								>
									{item.icon}
								</span>
								{item.label}
								{item.href === "/inbox" && inboxCount > 0 && (
									<span className="ml-auto rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold leading-none text-background">
										{inboxCount}
									</span>
								)}
							</Link>
						);
					})}
				</div>
			</nav>

			<div className="border-t px-5 py-4">
				<div className="eyebrow">Company Brain OS</div>
				<div className="mt-1 text-[11px] text-muted-foreground">
					Knowledge-risk intelligence · v0.10
				</div>
			</div>
		</aside>
	);
}
