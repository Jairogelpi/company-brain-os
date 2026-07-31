"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import GlobalSearch from "@/components/layout/GlobalSearch";
import { useAuth } from "@/components/auth/AuthProvider";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { Sun, Moon, Menu } from "lucide-react";
import LangToggle from "@/components/ui/LangToggle";
import { cn } from "@/lib/utils";
import { useLang } from "@/components/auth/LanguageContext";
import type { ReactNode } from "react";

function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const isDark = mounted ? theme === "dark" : false;
	return (
		<button
			onClick={() => setTheme(isDark ? "light" : "dark")}
			aria-label="Toggle theme"
			style={{
				width: 38, height: 38,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				border: "1px solid var(--color-border)",
				background: "transparent",
				color: "var(--text-2)",
				borderRadius: 10,
				cursor: "pointer",
				flexShrink: 0,
				transition: "background .15s, color .15s",
			}}
			onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hover-bg)"; e.currentTarget.style.color = "var(--color-foreground)"; }}
			onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; }}
		>
			{mounted ? (isDark ? <Sun size={18} /> : <Moon size={18} />) : <Moon size={18} />}
		</button>
	);
}

function AppContent({ children }: { children: ReactNode }) {
	const { user, logout } = useAuth();
	const { t } = useLang();
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);

	return (
		<div className="flex min-h-screen" style={{ background: "var(--color-background)", viewTransitionName: "app-shell" }}>
			<Sidebar
				collapsed={sidebarCollapsed}
				mobileOpen={mobileNavOpen}
				onMobileClose={() => setMobileNavOpen(false)}
			/>

			{/* Main area */}
			<div className={cn("flex flex-1 flex-col min-w-0", sidebarCollapsed ? "main-content-collapsed" : "main-content")} style={{ viewTransitionName: "app-main" }}>
				{/* Top bar */}
				<header
					style={{
						position: "sticky",
						top: 0,
						zIndex: 20,
						height: 64,
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 12,
						padding: "0 20px",
						borderBottom: "1px solid var(--color-border)",
						background: "var(--topbar-surface)",
						backdropFilter: "blur(18px)",
						WebkitBackdropFilter: "blur(18px)",
					}}
				>
					{/* Left: hamburger + theme toggle */}
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<button
							onClick={() => {
								if (window.innerWidth < 1024) {
									setMobileNavOpen((v) => !v);
								} else {
									setSidebarCollapsed((v) => !v);
								}
							}}
							aria-label="Toggle navigation"
							style={{
								width: 38, height: 38,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								border: "1px solid var(--color-border)",
								background: "transparent",
								color: "var(--text-2)",
								borderRadius: 10,
								cursor: "pointer",
								flexShrink: 0,
								transition: "background .15s, color .15s",
							}}
							onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hover-bg)"; e.currentTarget.style.color = "var(--color-foreground)"; }}
							onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; }}
						>
							<Menu size={18} />
						</button>
						<ThemeToggle />
						<LangToggle />
					</div>

					{/* Right: search + user */}
					<div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
						{/* Search — hidden on mobile */}
						<div className="topbar-search">
							<GlobalSearch />
						</div>

						{/* Divider */}
						<div
							className="topbar-divider"
							style={{
								height: 26,
								width: 1,
								background: "var(--color-border)",
								flexShrink: 0,
							}}
						/>

						{/* User info + avatar — clickable to profile */}
						<Link
							href="/profile"
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								minWidth: 0,
								textDecoration: "none",
								color: "inherit",
							}}
						>
							{/* Name + role — hidden on small mobile */}
							<div className="topbar-user-name" style={{ textAlign: "right", lineHeight: 1.25 }}>
								<div style={{ fontSize: 14, fontWeight: 550, color: "var(--color-foreground)", whiteSpace: "nowrap" }}>
									{user?.name ?? "—"}
								</div>
								<div
									className="eyebrow"
									style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--text-3)" }}
								>
									{user?.role ?? ""}
								</div>
							</div>

							{/* Avatar */}
							<div
								style={{
									width: 34, height: 34,
									borderRadius: "50%",
									background: "var(--logo-bg)",
									color: "var(--logo-fg)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 14,
									fontWeight: 600,
									flexShrink: 0,
								}}
							>
								{user?.name?.charAt(0).toUpperCase() ?? "?"}
							</div>
						</Link>

						{/* Sign out */}
						<button
							onClick={logout}
							style={{
								fontFamily: "var(--font-geist-mono, monospace)",
								fontSize: 11,
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								padding: "8px 12px",
								border: "1px solid var(--color-border)",
								background: "transparent",
								color: "var(--text-2)",
								borderRadius: 9,
								cursor: "pointer",
								transition: "color .15s, border-color .15s",
								whiteSpace: "nowrap",
								flexShrink: 0,
							}}
							onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-foreground)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
							onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-2)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
						>
							{t.signOut}
						</button>
					</div>
				</header>

				<div className="flex-1 min-w-0">{children}</div>
			</div>
			<Toaster />
		</div>
	);
}

export default function AppLayout({ children }: { children: ReactNode }) {
	return <AppContent>{children}</AppContent>;
}
