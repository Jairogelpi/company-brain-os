# Tasks — redesign-ui-refero

> Strict TDD (`openspec/config.yaml`). Each PR gates on `npm --prefix web run typecheck` + `npm --prefix web run test`. Sequence RED → GREEN → TRIANGULATE → REFACTOR where tests apply. Sliced per design.md §Review workload slicing.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1800–2400 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3a → PR3b → PR4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

## PR1 — Tokens + font + button rewire (~350 lines)

- [ ] RED: add `web/src/app/globals.css.test.ts` (T1) asserting `:root` `--primary: #fbff2b` + `.dark` `--primary: #fbff2b` present in `@theme`.
- [ ] RED: add `web/src/components/ui/button.test.tsx` (T6) asserting Button className contains `bg-primary` and no `slate-` class.
- [ ] RED: add `web/src/components/ui/__grep.test.ts` (T2) asserting no `slate-[0-9]`/`blue-[0-9]` in `components/ui/**` source.
- [ ] `npm --prefix web install lucide-react cmdk sonner next-themes @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-separator @radix-ui/react-avatar @radix-ui/react-scroll-area @radix-ui/react-switch @radix-ui/react-progress @radix-ui/react-label` (adds to `web/package.json`).
- [ ] Edit `web/src/app/globals.css`: drop Cold Editorial vars (`--paper`, `--paper-2`, `--surface`, `--ink`, `--ink-2`, `--ink-3`, `--hairline`, `--hairline-strong`, `--cobalt`, `--cobalt-ink`, `--risk`, `--positive`, `--gold`, `--radius: 14px`).
- [ ] Edit `web/src/app/globals.css`: write `@theme inline` block with light `:root` values from design.md token table (background `#ffffff`, foreground `#1a1a1a`, card `#ffffff`, popover, primary `#fbff2b`, secondary `#f4f4f4`, muted-foreground `#a3a3a3`, accent, destructive `#b91c1c`, border `#1a1a1a`, input, ring `#fbff2b`, radius `10px`/`--radius-sm 10px`/`--radius-md 10px`/`--radius-lg 16px`/`--radius-xl 16px`, raw `--color-ink-black`/`--color-paper-white`/`--color-fog-gray`/`--color-ash-gray`/`--color-highlighter-yellow`, type scale, `--tracking -0.03em`).
- [ ] Edit `web/src/app/globals.css`: write `.dark` override block with dark values from design.md table (background `#0e0e0e`, foreground `#f4f4f4`, card `#161616`, popover `#161616`, primary `#fbff2b` kept, secondary `#1f1f1f`, muted-foreground `#7a7a7a`, accent `#1f1f1f`, destructive `#f87171`, border `#2a2a2a`, input `#2a2a2a`, ring `#fbff2b`).
- [ ] Edit `web/src/app/globals.css` `body`: set `font-family: var(--font-inter)`, `letter-spacing: -0.03em`, `background: var(--color-background)`, `color: var(--color-foreground)`; remove radial-gradient atmosphere + grain `::before`.
- [ ] Edit `web/src/app/globals.css`: remove `.panel` shadow, `.tick-left` cobalt bar, `.eyebrow` mono, `.font-display`, `.numerals`; thin `.rise` fade (no cobalt).
- [ ] Edit `web/src/app/globals.css`: keep `@media (max-width:768px)` sidebar-hide; repoint scrollbar thumb to `--color-border`/`--color-ash-gray`; `::selection` → `rgba(251,255,43,0.3)` on `--color-ink-black`.
- [ ] Edit `web/src/app/layout.tsx`: replace `Geist`/`Geist_Mono` imports with `Inter` from `next/font/google` (weights 400,500; `variable: "--font-inter"`); apply `inter.variable` on `<body>`; remove `--font-geist-*`.
- [ ] Edit `web/src/components/ui/button.tsx`: replace `bg-slate-950 text-slate-50` → `bg-primary text-primary-foreground`; `border-slate-200 bg-white` → `border-border bg-background`; `ring-slate-900` → `ring-ring`; drop `shadow-sm`.
- [ ] Edit `web/src/components/ui/button.tsx`: add `variant: "ghost"`, `"destructive"`, `"link"` to cva variants.
- [ ] GREEN: run `npm --prefix web run test` — T1/T6/T2 pass.
- [ ] REFACTOR: verify no `slate-`/`blue-` remain in `button.tsx`; re-run T2.
- [ ] Gate: `npm --prefix web run typecheck` + `npm --prefix web run test` both green.

## PR2 — shadcn component install + Sidebar/GlobalSearch (~450 lines)

- [ ] RED: add `web/src/components/layout/sidebar.test.tsx` (T3) rendering each `NAV_ITEMS` entry and asserting no `<path d=` in output HTML; icons come from `lucide-react`.
- [ ] RED: add `web/src/components/layout/toaster-mount.test.tsx` (T5) asserting `Toaster` (sonner) renders in `(app)/layout.tsx` client tree.
- [ ] From `web/` run `npx shadcn@latest add card input label textarea select dialog sheet tabs table badge dropdown-menu command sonner tooltip separator avatar skeleton scroll-area progress switch` (creates 20 files in `web/src/components/ui/`).
- [ ] Re-apply PR1 `globals.css` `@theme` block if CLI regenerated it (diff `globals.css`; restore Programa tokens).
- [ ] Edit `web/src/components/layout/Sidebar.tsx`: delete `I(d)` inline-SVG helper + `NAV_ITEMS[].icon` `<path d=…>` strings.
- [ ] Edit `web/src/components/layout/Sidebar.tsx`: import `LayoutDashboard, ScanLine, Inbox, Users, BookOpen, Share2, Dna, SlidersHorizontal, GitBranch, Settings` from `lucide-react`; set each `icon: <X className="h-[18px] w-[18px]" />`.
- [ ] Edit `web/src/components/layout/Sidebar.tsx`: replace cobalt active tick + `var(--…)` with token classes (`bg-background`/`text-foreground`/`border-border`); use `Badge` for inbox count (ink bg, paper text — not yellow).
- [ ] Edit `web/src/components/layout/GlobalSearch.tsx`: replace custom search with shadcn `Command` palette; preserve `OrganizationMemory` in-memory search logic; replace raw `slate-50`/`blue-400` with tokens; use `Search`/`CornerDownLeft` lucide icons.
- [ ] Edit `web/src/app/(app)/layout.tsx`: top bar — wire `Command` (GlobalSearch), user `Avatar` + `DropdownMenu` (signout), mount `<Toaster />` from sonner here (client root).
- [ ] Edit `web/src/app/(app)/layout.tsx`: remove backdrop-blur + raw `var(--paper)`; use `bg-background`/`border-border`.
- [ ] GREEN: run T3 + T5; run full suite.
- [ ] REFACTOR: grep `<path d=` in `web/src/components` (excluding `canvas/GraphCanvas.tsx`) → zero.
- [ ] Gate: typecheck + test green.

## PR3a — (app) pages part 1: dashboard/people/knowledge/graph (~480 lines)

- [ ] Edit `web/src/app/(app)/dashboard/page.tsx`: rebuild metric surfaces on `Card`; risk severity → `Badge`; risk list → `Table`; coverage → `Progress`; remove `slate-*`/`blue-*`; single yellow only on primary CTA.
- [ ] Edit `web/src/app/(app)/people/page.tsx`: people list on `Table` + `Avatar` + `Badge`; remove raw color utilities.
- [ ] Edit `web/src/app/(app)/people/[id]/page.tsx`: detail layout via `Card` sections, `Badge`, `Separator`, shadcn `Input` (replacing `CostInput` styling); token classes.
- [ ] Edit `web/src/app/(app)/knowledge/page.tsx`: bus-factor on `Card` + `Progress` + `Badge`.
- [ ] Edit `web/src/app/(app)/graph/page.tsx`: wrap `GraphCanvas` container in `Card`; legend → `Badge` row; page bg `bg-background`, text `text-foreground`. DO NOT touch `GraphCanvas.tsx`/mapping.
- [ ] GREEN: run full suite (no behavioral change); typecheck.
- [ ] TRIANGULATE: per-page grep `slate-[0-9]|blue-[0-9]` in edited files → zero.
- [ ] Gate: typecheck + test green.

## PR3b — (app) pages part 2: simulator/succession/inbox/genome/capture/settings (~480 lines)

- [ ] Edit `web/src/app/(app)/simulator/page.tsx`: `Card` + `Tabs` + shadcn slider-style control + `Table`; preserve `useSearchParams`; remove `slate-*`.
- [ ] Edit `web/src/app/(app)/succession/page.tsx`: playbooks on `Card` + `Avatar` + `Badge`; token classes.
- [ ] Edit `web/src/app/(app)/inbox/page.tsx`: queue on `Table`; proposal review `Dialog`; approve/reject `Button`; remove raw colors.
- [ ] Edit `web/src/app/(app)/genome/page.tsx`: `Card` grid + `Badge` + `Progress`; replace inline `CATEGORY_TINT` map with token-driven `Badge` variants (ink/fog/yellow — yellow only on the single critical-genome card).
- [ ] Edit `web/src/app/(app)/capture/page.tsx`: `Card` + `Textarea` + `Button` + `Progress` (OCR progress); token classes.
- [ ] Edit `web/src/app/(app)/settings/page.tsx`: `Card` + `Tabs` + `Input` + `Switch` + `Select`; remove `slate-*`.
- [ ] GREEN: run full suite; typecheck.
- [ ] TRIANGULATE: per-page grep `slate-[0-9]|blue-[0-9]` → zero.
- [ ] Gate: typecheck + test green.

## PR4 — Hero animation + login/register + legacy cleanup (~400 lines)

- [ ] RED: add `web/src/components/auth/graph-hero.test.tsx` (T4) stubbing `matchMedia('(prefers-reduced-motion: reduce)')` → `true`; assert no `requestAnimationFrame` scheduled and all nodes/edges present in one render (completed static graph).
- [ ] RED: extend T4 — reduced-motion OFF → assert rAF scheduled + step advances + pulse overlay present after mount.
- [ ] Create `web/src/components/auth/GraphHero.tsx` ("use client"): `<svg viewBox="0 0 600 600">` with 6–8 hardcoded nodes (`r=14`, `stroke=currentColor`, `fill=--color-card`) + 6–10 edges (`stroke=--color-foreground` opacity 0.4); one `critical` node `fill=--color-primary`.
- [ ] Edit `web/src/components/auth/GraphHero.tsx`: staggered node appear (opacity 0→1, scale 0.6→1, delay = idx×120ms) keyed off `step` state via single `requestAnimationFrame` loop with timestamp deltas; cancel on unmount.
- [ ] Edit `web/src/components/auth/GraphHero.tsx`: edge draw via `pathLength=1`, `stroke-dasharray=1`, `stroke-dashoffset=1→0` (250ms ease) when both endpoints visible; yellow pulse `<circle>` overlay `r:14→22`, `opacity:0.6→0` looping every 1.6s after graph completes; hold 1.5s then reset `step=0` and replay.
- [ ] Edit `web/src/components/auth/GraphHero.tsx`: `prefers-reduced-motion: reduce` branch — render all nodes+edges at final state, no rAF, no pulse, no CSS transitions (`motion-safe:` prefixes / conditional className).
- [ ] Edit `web/src/components/auth/LoginPage.tsx`: split-screen ink panel (`bg-foreground text-background`) hosting `<GraphHero />`; form in `Card` with shadcn `Input`/`Label`/`Button`; submit = `variant="default"` ink button (yellow stays on hero critical node); remove radial-gradient manifesto overlay.
- [ ] Create `web/src/app/register/page.tsx` (RSC + Suspense) mirroring login pattern; create register form component reusing `Card`/`Input`/`Label`/`Button` + `<GraphHero />`.
- [ ] Edit `web/src/app/login/page.tsx` if needed to keep RSC Suspense wrapper consistent with new LoginPage.
- [ ] Delete `web/src/app/dashboard/page.tsx` (legacy monolithic); verify no remaining links to `/dashboard` (Sidebar already routes `/` → `(app)/page.tsx`).
- [ ] Edit `web/src/app/canvas/page.tsx`: wrap `GraphCanvas` in `Card`; legend in `Badge` row; page bg `bg-background`, text `text-foreground`; remove raw `slate-*`/`color:"blue"` from page wrapper. DO NOT touch `GraphCanvas.tsx`/mapping.
- [ ] GREEN: run T4; run full suite.
- [ ] REFACTOR: verify `ls web/src/app/dashboard/page.tsx` → absent.
- [ ] Gate: typecheck + test green.

## Verify (typecheck, test, banned-utility grep across all PRs)

- [ ] Run `npm --prefix web run typecheck` → zero errors (AC #13).
- [ ] Run `npm --prefix web run test` → existing ~290 tests + new T1–T6 green (AC #14).
- [ ] Run `grep -rE "slate-[0-9]|blue-[0-9]" web/src/app web/src/components/ui` → zero matches excluding tldraw internals + `canvas/GraphCanvas.tsx` mapping (AC #2).
- [ ] Run `grep -rE "<path d=" web/src/components` excluding `canvas/GraphCanvas.tsx` → zero (AC #4).
- [ ] Manual M1–M5 review checklist per spec.md Test plan (yellow single-accent per viewport, no shadows, 10/16px radii, 6px grid, dark contrast, hero animation in browser, canvas diff review).
