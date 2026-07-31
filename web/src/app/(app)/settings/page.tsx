"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div>
			<div className="eyebrow">{label}</div>
			<div className="mt-1 text-sm font-medium text-foreground">{value}</div>
		</div>
	);
}

export default function SettingsPage() {
	const { user } = useAuth();

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-border pb-6">
				<div className="eyebrow">Account</div>
				<h1 className="text-[44px] font-semibold tracking-[-0.045em]">Settings</h1>
			</div>

			<div className="mt-8 max-w-3xl space-y-6">
				<Card className="p-6">
					<CardContent className="p-0">
						<div className="eyebrow">Profile</div>
						<div className="mt-4 grid gap-5 md:grid-cols-2">
							<Row label="Name" value={user?.name ?? "—"} />
							<Row label="Email" value={user?.email ?? "—"} />
							<Row
								label="Role"
								value={<Badge variant="secondary">{user?.role ?? "—"}</Badge>}
							/>
							<Row label="Company" value={user?.companyId ?? "—"} />
						</div>
					</CardContent>
				</Card>

				{(user?.role === "owner" || user?.role === "validator") && (
					<Card className="p-6">
						<CardContent className="p-0">
							<div className="eyebrow">Validation scopes</div>
							<p className="mt-1.5 text-xs text-muted-foreground">
								Domains this user can validate knowledge in.
							</p>
							<div className="mt-4">
								{user.validationDomains.length > 0 ? (
									<div className="flex flex-wrap gap-2">
										{user.validationDomains.map((domain) => (
											<Badge key={domain} variant="secondary">
												{domain}
											</Badge>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">
										No validation scopes assigned.
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
