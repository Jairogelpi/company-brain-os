"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLang } from "@/components/auth/LanguageContext";

type ProfileData = {
	id: string;
	email: string;
	name: string;
	role: string;
	companyId: string;
	position: string | null;
	department: string | null;
	salary: number | null;
	workingHours: number | null;
	contractType: string | null;
	startDate: string | null;
	phone: string | null;
	bio: string | null;
	createdAt: string;
};

const fieldStyle: React.CSSProperties = {
	width: "100%",
	height: 44,
	padding: "0 14px",
	fontFamily: "inherit",
	fontSize: 14,
	color: "var(--color-foreground)",
	background: "var(--color-background)",
	border: "1.5px solid var(--color-border)",
	borderRadius: 10,
	outline: "none",
	boxSizing: "border-box",
	transition: "border-color .2s, box-shadow .2s",
};

const labelStyle: React.CSSProperties = {
	display: "block",
	fontSize: 12,
	fontWeight: 600,
	color: "var(--text-2)",
	marginBottom: 6,
	textTransform: "uppercase",
	letterSpacing: "0.05em",
};

const groupStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 4,
};

export default function ProfilePage() {
	const { data: session } = useSession();
	const { t } = useLang();
	const router = useRouter();
	const [profile, setProfile] = useState<ProfileData | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!session?.user?.id) return;
		fetch(`/api/users/${session.user.id}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.error) {
					toast.error(data.error);
					return;
				}
				setProfile(data);
				setForm({
					name: data.name ?? "",
					position: data.position ?? "",
					department: data.department ?? "",
					salary: data.salary?.toString() ?? "",
					workingHours: data.workingHours?.toString() ?? "",
					contractType: data.contractType ?? "",
					startDate: data.startDate?.split("T")[0] ?? "",
					phone: data.phone ?? "",
					bio: data.bio ?? "",
				});
			})
			.catch(() => toast.error("Failed to load profile"))
			.finally(() => setLoading(false));
	}, [session?.user?.id]);

	const update = (field: string) => (value: string) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	};

	const handleSave = async () => {
		if (!profile) return;
		setSaving(true);
		const body: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(form)) {
			if (key === "salary" || key === "workingHours") {
				body[key] = val ? Number(val) : null;
			} else {
				body[key] = val || null;
			}
		}

		const res = await fetch(`/api/users/${profile.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			toast.error(err.error ?? "Save failed");
		} else {
			toast.success("Profile updated");
		}
		setSaving(false);
	};

	if (loading) {
		return (
			<div className="p-10 text-sm text-muted-foreground">{t.loading}</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl px-8 py-10 rise">
			<div className="eyebrow">{t.profile}</div>
			<h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em]">
				{form.name || profile?.email}
			</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				{profile?.email} · {profile?.role} · {profile?.companyId}
			</p>

			<Card className="mt-8">
				<CardContent className="p-8 grid gap-6 sm:grid-cols-2">
					<div style={groupStyle}>
						<label style={labelStyle}>{t.fullName}</label>
						<input
							style={fieldStyle}
							value={form.name ?? ""}
							onChange={(e) => update("name")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>

					<div style={groupStyle}>
						<label style={labelStyle}>{t.position}</label>
						<input
							style={fieldStyle}
							value={form.position ?? ""}
							placeholder="CEO, Developer..."
							onChange={(e) => update("position")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>

					<div style={groupStyle}>
						<label style={labelStyle}>{t.department}</label>
						<input
							style={fieldStyle}
							value={form.department ?? ""}
							placeholder="Engineering, Sales..."
							onChange={(e) => update("department")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>

					<div style={groupStyle}>
						<label style={labelStyle}>{t.contractType}</label>
						<input
							style={fieldStyle}
							value={form.contractType ?? ""}
							placeholder="Indefinido, Temporal..."
							onChange={(e) => update("contractType")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>

					<div style={groupStyle}>
						<label style={labelStyle}>{t.salary}</label>
						<input
							style={fieldStyle}
							type="number"
							value={form.salary ?? ""}
							placeholder="50000"
							onChange={(e) => update("salary")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>

					<div style={groupStyle}>
						<label style={labelStyle}>{t.workingHours}</label>
						<input
							style={fieldStyle}
							type="number"
							value={form.workingHours ?? ""}
							placeholder="40"
							onChange={(e) => update("workingHours")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>

					<div style={groupStyle}>
						<label style={labelStyle}>{t.startDate}</label>
						<input
							style={fieldStyle}
							type="date"
							value={form.startDate ?? ""}
							onChange={(e) => update("startDate")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>

					<div style={groupStyle}>
						<label style={labelStyle}>{t.phone}</label>
						<input
							style={fieldStyle}
							value={form.phone ?? ""}
							placeholder="+34..."
							onChange={(e) => update("phone")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>

					<div style={{ ...groupStyle, gridColumn: "1 / -1" }}>
						<label style={labelStyle}>{t.bio}</label>
						<textarea
							style={{ ...fieldStyle, height: 100, padding: "12px 14px", resize: "vertical" }}
							value={form.bio ?? ""}
							placeholder={t.bioPlaceholder}
							onChange={(e) => update("bio")(e.target.value)}
							onFocus={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
							onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
						/>
					</div>
				</CardContent>
			</Card>

			<div style={{ display: "flex", gap: 12, marginTop: 24 }}>
				<Button onClick={handleSave} disabled={saving}>
					{saving ? t.saving : t.save}
				</Button>
				<button
					onClick={() => router.push("/")}
					style={{
						fontFamily: "inherit",
						fontSize: 14,
						padding: "0 16px",
						background: "transparent",
						border: "1.5px solid var(--color-border)",
						borderRadius: 10,
						color: "var(--text-2)",
						cursor: "pointer",
						height: 44,
					}}
				>
					{t.cancel}
				</button>
			</div>
		</div>
	);
}
