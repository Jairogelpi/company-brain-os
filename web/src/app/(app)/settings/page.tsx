"use client";

import { useAuth } from "@/components/auth/AuthProvider";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div>
			<div className="eyebrow">{label}</div>
			<div className="mt-1 text-sm font-medium text-[var(--ink)]">{value}</div>
		</div>
	);
}

export default function SettingsPage() {
	const { user } = useAuth();

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-[var(--hairline)] pb-6">
				<div className="eyebrow">Account</div>
				<h1 className="mt-2 font-display text-4xl font-normal tracking-tight">
					Settings
				</h1>
			</div>

			<div className="mt-8 max-w-3xl space-y-6">
				{/* Profile */}
				<div className="panel p-6">
					<div className="eyebrow">Profile</div>
					<div className="mt-4 grid gap-5 md:grid-cols-2">
						<Row label="Name" value={user?.name ?? "—"} />
						<Row label="Email" value={user?.email ?? "—"} />
						<Row
							label="Role"
							value={
								<span
									className="rounded-full border px-2 py-0.5 text-xs"
									style={{ borderColor: "var(--cobalt)", color: "var(--cobalt-ink)" }}
								>
									{user?.role ?? "—"}
								</span>
							}
						/>
						<Row label="Company" value={user?.companyId ?? "—"} />
					</div>
				</div>

				{/* Validation scopes */}
				{(user?.role === "owner" || user?.role === "validator") && (
					<div className="panel p-6">
						<div className="eyebrow">Validation scopes</div>
						<p className="mt-1.5 text-xs text-[var(--ink-2)]">
							Domains this user can validate knowledge in.
						</p>
						<div className="mt-4">
							{user.validationDomains.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{user.validationDomains.map((domain) => (
										<span
											key={domain}
											className="rounded-full border px-3 py-1 text-xs font-medium"
											style={{
												borderColor: "var(--positive)",
												color: "var(--positive)",
											}}
										>
											{domain}
										</span>
									))}
								</div>
							) : (
								<p className="text-sm text-[var(--ink-3)]">
									No validation scopes assigned.
								</p>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
