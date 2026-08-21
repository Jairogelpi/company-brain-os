"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

type NotificationItem = {
	id: string;
	title: string;
	body: string;
	actionUrl: string | null;
	createdAt: string;
	readAt: string | null;
};

export default function NotificationBell() {
	const [items, setItems] = useState<NotificationItem[]>([]);
	const [open, setOpen] = useState(false);

	async function load() {
		const response = await fetch("/api/notifications", { cache: "no-store" });
		if (!response.ok) return;
		const data = await response.json() as { items?: NotificationItem[] };
		setItems(data.items ?? []);
	}

	useEffect(() => {
		void load();
	}, []);

	async function markRead(id: string) {
		setItems((current) => current.map((item) => (
			item.id === id ? { ...item, readAt: new Date().toISOString() } : item
		)));
		await fetch("/api/notifications", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ id }),
		});
	}

	const unread = items.filter((item) => item.readAt === null).length;
	return (
		<div style={{ position: "relative" }}>
			<button
				type="button"
				aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
				aria-expanded={open}
				onClick={() => {
					setOpen((value) => !value);
					if (!open) void load();
				}}
				className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-border bg-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
			>
				<Bell size={18} />
				{unread > 0 && (
					<span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-foreground px-1 text-center text-[10px] font-semibold leading-4 text-background">
						{Math.min(unread, 99)}
					</span>
				)}
			</button>
			{open && (
				<div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
					<div className="border-b border-border px-4 py-3 text-sm font-semibold">Notifications</div>
					<div className="max-h-96 overflow-y-auto">
						{items.length === 0 ? (
							<p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
						) : items.map((item) => {
							const content = (
								<>
									<div className="text-sm font-medium text-foreground">{item.title}</div>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
								</>
							);
							const className = `block border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary ${item.readAt ? "" : "bg-secondary/50"}`;
							return item.actionUrl ? (
								<Link key={item.id} href={item.actionUrl} className={className} onClick={() => {
									setOpen(false);
									void markRead(item.id);
								}}>{content}</Link>
							) : (
								<button key={item.id} type="button" className={`${className} w-full`} onClick={() => void markRead(item.id)}>{content}</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
