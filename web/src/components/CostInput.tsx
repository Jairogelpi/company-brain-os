"use client";

import { useState } from "react";

/**
 * Tiny number input that saves a single cost-model field to a node on blur.
 * Turns the financial exposure from "estimated" into a real figure.
 */
export function CostInput({
	nodeId,
	field,
	value,
	label,
	prefix,
	onSaved,
	disabled,
}: {
	nodeId: string;
	field: string;
	value: number | undefined;
	label: string;
	prefix?: string;
	onSaved?: () => void;
	disabled?: boolean;
}) {
	const [v, setV] = useState(value != null ? String(value) : "");
	const [saving, setSaving] = useState(false);

	const save = async () => {
		if (v === "" || Number(v) === value) return;
		setSaving(true);
		await fetch("/api/graph/node", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: nodeId, cost: { [field]: Number(v) } }),
		}).catch(() => {});
		setSaving(false);
		onSaved?.();
	};

	return (
		<label className="flex flex-col gap-1">
			<span className="eyebrow">{label}</span>
			<span className="flex items-center rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-sm focus-within:border-[var(--cobalt)]">
				{prefix && <span className="text-[var(--ink-3)]">{prefix}</span>}
				<input
					type="number"
					min={0}
					value={v}
					onChange={(e) => setV(e.target.value)}
					onBlur={save}
					disabled={disabled || saving}
					placeholder="—"
					className="w-20 bg-transparent outline-none placeholder:text-[var(--ink-3)] disabled:opacity-50"
				/>
			</span>
		</label>
	);
}
