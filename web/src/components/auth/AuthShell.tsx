import type { ReactNode } from "react";

const CAPABILITIES = ["People", "Knowledge", "Processes", "Risk"];

function Brand({ className = "" }: { className?: string }) {
	return (
		<div className={`flex items-center gap-2.5 ${className}`}>
			<span className="flex h-7 w-7 items-center justify-center rounded-md bg-background text-[13px] font-semibold text-foreground">
				◐
			</span>
			<span className="text-lg font-medium tracking-tight">Company Brain</span>
		</div>
	);
}

/**
 * Full-bleed split layout for the auth screens. The dark brand panel fills the
 * left half on desktop (lg+) and is hidden on mobile, where the form takes the
 * whole viewport. No decorative graph — a typographic, editorial treatment with
 * a single highlighter-yellow signal, per the "Programa" design system.
 */
export default function AuthShell({
	eyebrow,
	title,
	subtitle,
	footer,
	children,
}: {
	eyebrow: string;
	title: ReactNode;
	subtitle: string;
	footer: string;
	children: ReactNode;
}) {
	return (
		<div className="grid min-h-screen lg:grid-cols-2">
			{/* Brand panel — desktop only */}
			<aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 text-background lg:flex xl:p-16">
				{/* oversized glyph watermark for depth */}
				<span
					aria-hidden
					className="pointer-events-none absolute -bottom-32 -right-24 select-none text-[34rem] leading-none text-background/[0.04]"
				>
					◐
				</span>

				<Brand className="relative" />

				<div className="relative max-w-xl rise">
					<div className="eyebrow text-background/50">{eyebrow}</div>
					<h1 className="mt-5 text-[clamp(2.5rem,3.8vw,3.75rem)] font-normal leading-[1.04] tracking-tight text-balance">
						{title}
					</h1>
					<p className="mt-6 max-w-md text-[15px] leading-relaxed text-background/60">
						{subtitle}
					</p>

					{/* capability rail — replaces the old graph */}
					<ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3">
						{CAPABILITIES.map((cap) => (
							<li
								key={cap}
								className="flex items-center gap-2 text-[13px] tracking-tight text-background/70"
							>
								<span className="h-1.5 w-1.5 rounded-full bg-primary" />
								{cap}
							</li>
						))}
					</ul>
				</div>

				<div className="relative eyebrow text-background/40">{footer}</div>
			</aside>

			{/* Form panel */}
			<main className="flex flex-col justify-center bg-background px-6 py-12 sm:px-10 lg:px-16 xl:px-24">
				<div className="mx-auto w-full max-w-md rise">
					<Brand className="mb-12 lg:hidden" />
					{children}
				</div>
			</main>
		</div>
	);
}
