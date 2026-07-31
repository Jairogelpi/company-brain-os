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
	ClipboardCheck,
	Settings,
	UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/components/auth/LanguageContext";

type Item = { href: string; key: string; icon: ReactNode };

const NAV_ITEMS: Item[] = [
	{ href: "/", key: "dashboard", icon: <LayoutDashboard size={18} /> },
	{ href: "/capture", key: "capture", icon: <ScanLine size={18} /> },
	{ href: "/inbox", key: "inbox", icon: <Inbox size={18} /> },
	{ href: "/people", key: "people", icon: <Users size={18} /> },
	{ href: "/knowledge", key: "knowledge", icon: <BookOpen size={18} /> },
	{ href: "/graph", key: "graph", icon: <GitBranch size={18} /> },
	{ href: "/genome", key: "genome", icon: <Dna size={18} /> },
	{ href: "/simulator", key: "simulator", icon: <SlidersHorizontal size={18} /> },
	{ href: "/succession", key: "succession", icon: <Share2 size={18} /> },
	{ href: "/profile", key: "profile", icon: <UserCircle size={18} /> },
	{ href: "/missions", key: "missions", icon: <ClipboardCheck size={18} /> },
	{ href: "/settings", key: "settings", icon: <Settings size={18} /> },
];

interface SidebarProps {
	collapsed?: boolean;
	mobileOpen?: boolean;
	onMobileClose?: () => void;
}

export default function Sidebar({ collapsed = false, mobileOpen = false, onMobileClose = () => {} }: SidebarProps) {
	const pathname = usePathname();
	const { t } = useLang();
	const [inboxCount, setInboxCount] = useState(0);

	useEffect(() => {
		onMobileClose();
	}, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		let active = true;
		fetch("/api/inbox")
			.then((r) => (r.ok ? r.json() : { count: 0 }))
			.then((d) => active && setInboxCount(d.count ?? 0))
			.catch(() => {});
		return () => { active = false; };
	}, [pathname]);

	const isCollapsed = collapsed && !mobileOpen;

	return (
		<>
			{/* Mobile overlay */}
			<div
				className="sidebar-overlay"
				onClick={onMobileClose}
				style={{
					position: "fixed",
					inset: 0,
					zIndex: 25,
					background: "rgba(0, 0, 0, 0.48)",
					backdropFilter: "blur(3px)",
					WebkitBackdropFilter: "blur(3px)",
					opacity: mobileOpen ? 1 : 0,
					pointerEvents: mobileOpen ? "auto" : "none",
					transition: "opacity 0.25s ease",
				}}
			/>

			<aside
				className={cn(
					"sidebar-desktop fixed left-0 top-0 z-30 flex h-full flex-col",
					mobileOpen && "sidebar-open",
				)}
				style={{
					width: isCollapsed ? 64 : 256,
					transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
					background: "var(--sidebar-surface)",
					borderRight: "1px solid var(--color-border)",
				}}
			>
				{/* Logo */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						padding: isCollapsed ? "18px 0 22px" : "18px 20px 22px",
						justifyContent: isCollapsed ? "center" : "flex-start",
						whiteSpace: "nowrap",
						overflow: "hidden",
					}}
				>
					<svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
						<circle cx="15" cy="15" r="11" stroke="var(--color-foreground, #e8edf3)" strokeWidth="1.6" opacity="0.9" />
						<circle cx="11" cy="12" r="2" fill="var(--color-foreground, #e8edf3)" />
						<circle cx="19.5" cy="11" r="1.5" fill="var(--color-foreground, #e8edf3)" />
						<circle cx="17" cy="19" r="2.4" fill="var(--color-foreground, #e8edf3)" />
						<line x1="11" y1="12" x2="19.5" y2="11" stroke="var(--color-foreground, #e8edf3)" strokeWidth="0.9" opacity="0.6" />
						<line x1="11" y1="12" x2="17" y2="19" stroke="var(--color-foreground, #e8edf3)" strokeWidth="0.9" opacity="0.6" />
						<line x1="19.5" y1="11" x2="17" y2="19" stroke="var(--color-foreground, #e8edf3)" strokeWidth="0.9" opacity="0.6" />
					</svg>
					{!isCollapsed && (
						<span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-foreground)" }}>
							Company Brain
						</span>
					)}
				</div>

				{/* Nav label */}
				{!isCollapsed && (
					<div className="eyebrow" style={{ padding: "0 20px 10px", fontSize: 10, letterSpacing: "0.16em" }}>
						{t.navigate}
					</div>
				)}

				{/* Nav items */}
				<nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: isCollapsed ? "0 8px" : "0 10px", overflow: isCollapsed ? "visible" : "auto" }}>
					{NAV_ITEMS.map((item) => {
						const isActive =
							pathname === item.href ||
							(item.href !== "/" && pathname.startsWith(item.href));
						const label = String(t[item.key as keyof typeof t]);
						return (
							<div key={item.href} className="sidebar-nav-item" style={{ position: "relative" }}>
								<Link
									href={item.href}
									className={cn(
										"group flex items-center gap-3 rounded-[10px] py-[9px] text-[14px] font-[450] no-underline transition-colors",
										isActive
											? "text-foreground"
											: "text-muted-foreground hover:bg-secondary hover:text-foreground",
									)}
									style={{
										...(isActive ? { background: "var(--active-bg)", color: "var(--color-foreground)" } : {}),
										paddingLeft: isCollapsed ? 0 : 11,
										justifyContent: isCollapsed ? "center" : "flex-start",
									}}
								>
									<span
										className={cn(
											"flex-shrink-0 transition-colors",
											isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
										)}
										style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18 }}
									>
										{item.icon}
									</span>
									{!isCollapsed && (
										<span style={{ flex: 1, whiteSpace: "nowrap" }}>
											{label}
										</span>
									)}
									{!isCollapsed && item.href === "/inbox" && inboxCount > 0 && (
										<span
											style={{
												fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
												fontSize: 10,
												fontWeight: 600,
												background: "var(--color-foreground)",
												color: "var(--color-background)",
												borderRadius: 999,
												padding: "2px 7px",
												lineHeight: 1.3,
											}}
										>
											{inboxCount}
										</span>
									)}
								</Link>
								{/* Tooltip for collapsed mode */}
								{isCollapsed && (
									<div className="sidebar-tooltip">
										{label}
										{item.href === "/inbox" && inboxCount > 0 && (
											<span style={{ marginLeft: 6, fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, fontWeight: 600 }}>
												({inboxCount})
											</span>
										)}
									</div>
								)}
							</div>
						);
					})}
				</nav>

				{/* Footer */}
				{!isCollapsed ? (
					<div style={{ borderTop: "1px solid var(--color-border)", padding: "14px 20px" }}>
						<div className="eyebrow" style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 11, letterSpacing: "0.12em" }}>
							COMPANY BRAIN OS
						</div>
						<div style={{ marginTop: 5, fontSize: 12, color: "var(--text-3)" }}>
							{t.osSub}
						</div>
					</div>
				) : (
					<div style={{ borderTop: "1px solid var(--color-border)", padding: "14px 0", display: "flex", justifyContent: "center" }}>
						<div
							className="eyebrow"
							style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 9, letterSpacing: "0.08em", writingMode: "vertical-lr", textOrientation: "mixed", transform: "rotate(180deg)" }}
						>
							CBOS
						</div>
					</div>
				)}
			</aside>
		</>
	);
}
