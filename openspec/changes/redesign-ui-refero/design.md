# Design — redesign-ui-refero

> Programa Swiss design system → shadcn/ui contract via Tailwind v4 `@theme`. Light + derived dark. Inter font, lucide icons, SVG hero animation, legacy cleanup. 14 acceptance criteria in `spec.md`.

## Token architecture

Rewrite `web/src/app/globals.css`. Drop the bespoke Cold Editorial vars (`--paper`, `--paper-2`, `--surface`, `--ink`, `--ink-2`, `--ink-3`, `--hairline`, `--hairline-strong`, `--cobalt`, `--cobalt-ink`, `--risk`, `--positive`, `--gold`, `--radius: 14px`) and the layered background gradients, grain overlay, `.panel` shadow, `.tick-left` cobalt bar, `.eyebrow` mono, `.font-display`, `.numerals`, `.rise` (kept as a thin fade, no cobalt). Replace with a Tailwind v4 `@theme inline` block that emits CSS custom properties the shadcn contract reads, plus raw `--color-*` Programa tokens for direct use.

`@theme inline` maps tokens to Tailwind utility names (`--color-background` → `bg-background`, `--color-primary` → `bg-primary text-primary`, `--color-border` → `border-border`, `--radius` → `rounded-lg`/`rounded-xl` scale). shadcn components already reference `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `ring-ring`, `rounded-lg`. The mapping keeps `--radius: 0.625rem` (10px) as the base; `rounded-md` = 10px, `rounded-xl` = 16px (card/banner) via explicit overrides in the `@theme` block: `--radius-sm: 10px`, `--radius-md: 10px`, `--radius-lg: 16px`, `--radius-xl: 16px`.

Light `:root` (Programa source of truth):

| shadcn var | value | Programa role |
|---|---|---|
| `--background` | `#ffffff` | paper white (canvas) |
| `--foreground` | `#1a1a1a` | ink black (text) |
| `--card` | `#ffffff` | paper white (Surface 0) |
| `--card-foreground` | `#1a1a1a` | ink |
| `--popover` / `--popover-foreground` | `#ffffff` / `#1a1a1a` | paper / ink |
| `--primary` | `#fbff2b` | highlighter yellow (single accent) |
| `--primary-foreground` | `#1a1a1a` | ink on yellow |
| `--secondary` | `#f4f4f4` | fog gray (Surface 1) |
| `--secondary-foreground` | `#1a1a1a` | ink |
| `--muted` | `#f4f4f4` | fog gray |
| `--muted-foreground` | `#a3a3a3` | ash gray — **muted/secondary text only, never body copy** |
| `--accent` / `--accent-foreground` | `#f4f4f4` / `#1a1a1a` | fog / ink (hover/quiet fill) |
| `--destructive` / `--destructive-foreground` | `#b91c1c` / `#ffffff` | risk red (kept for error surfaces, not a second accent) |
| `--border` | `#1a1a1a` | ink hairline (1px, no shadow elevation) |
| `--input` | `#1a1a1a` | ink |
| `--ring` | `#fbff2b` | yellow focus ring |
| `--radius` | `10px` | buttons/inputs/nav |
| `--color-ink-black` / `--color-paper-white` / `--color-fog-gray` / `--color-ash-gray` / `--color-highlighter-yellow` | `#1a1a1a` / `#ffffff` / `#f4f4f4` / `#a3a3a3` / `#fbff2b` | raw Programa tokens |
| `--text-caption/-body-sm/-subheading/-heading-sm/-heading` | 14/16/20/24/42px | typography scale |
| `--tracking` | `-0.03em` | global |

`body` uses `font-family: var(--font-inter)`, `letter-spacing: -0.03em`, `background: var(--color-background)`, `color: var(--color-foreground)`. Remove the radial-gradient atmosphere, grain `::before`, and `*{border-color:var(--hairline)}` (borders now token-driven per element). Keep the `@media (max-width:768px)` sidebar-hide rule and the scrollbar thumb (repoint to `--color-border`/`--color-ash-gray`). `::selection` → `rgba(251,255,43,0.3)` on `--color-ink-black`.

## Dark mode derivation

`.dark` override on `:root` scope. Programa is light-only; the dark variant inverts canvas to near-black, keeps `#fbff2b` as the only chromatic accent, softens borders (full ink hairline would be too loud on dark), and elevates cards by one surface step.

| shadcn var | dark value | rationale / contrast |
|---|---|---|
| `--background` | `#0e0e0e` | near-black canvas (Surface 0 dark) |
| `--foreground` | `#f4f4f4` | paper-as-text on near-black — contrast ≈ 16.8:1 (AAA) |
| `--card` | `#161616` | Surface 1 dark — subtle elevation off canvas |
| `--card-foreground` | `#f4f4f4` | 15.4:1 on card |
| `--popover` / `--popover-foreground` | `#161616` / `#f4f4f4` | matches card |
| `--primary` | `#fbff2b` | **kept** — yellow reads on dark |
| `--primary-foreground` | `#1a1a1a` | ink on yellow (13.9:1) |
| `--secondary` | `#1f1f1f` | dark fog (Surface 1 alt) |
| `--secondary-foreground` | `#f4f4f4` | |
| `--muted` | `#1f1f1f` | dark fog |
| `--muted-foreground` | `#7a7a7a` | softer than ash — 4.2:1 on `#0e0e0e`, 4.0:1 on `#161616`; AA for large/secondary text, used for placeholders/inactive only — **not body copy** |
| `--accent` / `--accent-foreground` | `#1f1f1f` / `#f4f4f4` | dark fog / paper |
| `--destructive` / `--destructive-foreground` | `#f87171` / `#0e0e0e` | lighter red for dark |
| `--border` | `#2a2a2a` | softened ink — visible on `#0e0e0e` (ΔL≈0.014) and `#161616`; hairline reads without screaming |
| `--input` | `#2a2a2a` | matches border |
| `--ring` | `#fbff2b` | yellow focus ring kept |
| `--radius` | `10px` | unchanged |

Body copy in dark = `--foreground` (`#f4f4f4`), never `--muted-foreground`. `#a3a3a3` (ash) is banned for body in **both** themes per spec; dark body uses paper-white. Border `#2a2a2a` hairline defines form without light — consistent with Programa "lines define form, not light."

## Component install plan

Install via shadcn CLI from `web/`:

```
npx shadcn@latest add card input label textarea select dialog sheet tabs table badge dropdown-menu command sonner tooltip separator avatar skeleton scroll-area progress switch
```

**Tailwind v4 compatibility:** shadcn CLI's registry now emits Tailwind v4-compatible components (token classes like `bg-primary`, `text-muted-foreground`, `border-border`, `focus-visible:ring-ring`). `components.json` already has `cssVariables: true`, `baseColor: slate` (the slate baseColor only seeds the initial `@theme`; we overwrite `globals.css` with Programa values, so the slate seed is irrelevant after token rewrite). Where the CLI regenerates `globals.css`, we re-apply our Programa `@theme` block — install components first, then write the final `globals.css` last. Manual wiring risks:

- **`button.tsx`:** rewire — replace `bg-slate-950 text-slate-50` → `bg-primary text-primary-foreground`, `border-slate-200 bg-white` → `border-border bg-background`, `ring-slate-900` → `ring-ring`. Add `variant: "ghost"`, `"destructive"`, `"link"` to match the install set; drop `shadow-sm` (no shadows).
- **`select`/`dialog`/`sheet`/`dropdown-menu`** require `@radix-ui/react-select`, `react-dialog`, `react-tabs`, `react-dropdown-menu`, `react-tooltip`, `react-separator`, `react-avatar`, `react-scroll-area`, `react-switch`, `react-progress`, `react-label`, `react-slot` (already present). `command` requires `cmdk`. `sonner` requires `sonner` + `next-themes` (for dark `theme="system"`). Run `npm i cmdk sonner @radix-ui/react-{dialog,tabs,select,dropdown-menu,tooltip,separator,avatar,scroll-area,switch,progress,label}` and `lucide-react` from `web/`.
- If a CLI component imports `tailwindcss-animate` (v3 plugin) — replace keyframes with inline `@keyframes` in `globals.css` (Tailwind v4 has no plugin loader for it).

## Font migration

`web/src/app/layout.tsx`: replace `Geist`/`Geist_Mono` imports with `Inter` from `next/font/google`:

```ts
import { Inter } from "next/font/google";
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400","500"] });
```

Apply `inter.variable` on `<body>`. Set `letter-spacing: -0.03em` in `globals.css` `body` rule (global tracking). Remove `--font-geist-sans`/`--font-geist-mono` references (Sidebar `.font-display`/`.eyebrow`/`.numerals` classes are deleted in token rewrite — Sidebar is rebuilt anyway). `.eyebrow` (mono, uppercase) is removed; replaced by `text-caption` token + `uppercase tracking-wide` utilities where needed.

## Icon migration

`Sidebar.tsx`: delete the `I(d)` inline-SVG helper and the `NAV_ITEMS[].icon` `<path d=…>` strings. Import from `lucide-react`: `LayoutDashboard, ScanLine, Inbox, Users, BookOpen, Share2, Dna, SlidersHorizontal, GitBranch, Settings`. Each `NAV_ITEMS` entry: `icon: <LayoutDashboard className="h-[18px] w-[18px]" />`. Apply to `GlobalSearch` (replace inline search SVG with `Search`/`CornerDownLeft`), `LoginPage` arrow (→) → `ArrowRight`, and any other nav surfaces. Grep for `<path d=` in `web/src/components` (excluding `GraphCanvas.tsx` tldraw mapping) must return zero.

## Hero graph animation architecture

**SVG-based** (not canvas, not tldraw — auth route must stay lightweight). New component `web/src/components/auth/GraphHero.tsx` ("use client"), rendered on the left split-screen panel of `LoginPage` and the new `RegisterPage`.

Structure:

- `<svg viewBox="0 0 600 600">` with 6–8 hardcoded nodes (person/knowledge/process circles, `r=14`, `stroke=currentColor`/ink, `fill=--color-card`) and 6–10 edges (`<line>` or `<path>`, `stroke=--color-foreground` at 0.4 opacity).
- One node is the "critical" node (id `critical`), `fill=--color-primary` (`#fbff2b`) — the single accent per viewport (the login form's primary button must then be `outline`/`ghost` variant on this screen, or the yellow moves to the button and the critical node uses a 1px ink ring + "critical" label; **decision: yellow lives on the critical node in the hero, the login submit button is `variant="default"` with ink background + paper foreground — single-accent rule satisfied**).
- **Node appear:** staggered `opacity 0→1` + `transform scale(0.6→1)` via CSS transition keyed off a `step` state incremented by `requestAnimationFrame` (each node's delay = index × 120ms).
- **Edge draw:** `stroke-dasharray` animation — set `pathLength=1`, `stroke-dasharray=1`, `stroke-dashoffset=1→0` transition (250ms ease) triggered when both endpoints are visible.
- **Yellow pulse:** on the critical node, a `<circle>` overlay animated `r: 14→22`, `opacity: 0.6→0`, looping every 1.6s after the graph completes.
- **Loop strategy:** after full build (~2.5s), hold 1.5s, then reset `step=0` and replay. Use a single `requestAnimationFrame` loop with timestamp deltas; cancel on unmount.
- **`prefers-reduced-motion`:** check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` on mount. If set, render all nodes + edges at final state immediately, no rAF, no pulse (static completed graph). No CSS transitions either (add `motion-safe:` prefixes or conditional className).
- Container `<div className="bg-foreground text-background">` (ink panel, paper text) — replaces the current `bg-[var(--ink)] text-[var(--paper)]` block; the radial-gradient manifesto overlay is removed (Programa: no gradients/glows).

## Per-page redesign plan

| Page | shadcn primitives | key changes |
|---|---|---|
| `login/page.tsx` + `LoginPage` | `Card`, `Input`, `Label`, `Button` (outline/ink), `GraphHero` | split-screen: ink panel + `GraphHero`; form in `Card`; submit = ink button (yellow on hero) |
| `register/page.tsx` (new, or reuse LoginPage pattern) | `Card`, `Input`, `Label`, `Button`, `GraphHero` | same hero, register form |
| `(app)/layout.tsx` | `Avatar`, `DropdownMenu`, `Command`, `Toaster` mount | top bar: `Command` palette (GlobalSearch), user `Avatar` + `DropdownMenu` (signout); `Toaster` mounted here (client root) |
| `Sidebar.tsx` | `Badge`, lucide icons, token classes | ink wordmark, lucide nav, `Badge` for inbox count (ink bg, paper text — not yellow) |
| `(app)/dashboard/page.tsx` | `Card` grid, `Badge` (risk severity), `Table` (risk list), `Progress` (coverage) | no `slate-*`, single yellow on primary CTA only |
| `people/page.tsx` | `Table`, `Avatar`, `Badge` | list on `Table` |
| `people/[id]/page.tsx` | `Card` sections, `Badge`, `Separator`, `Input` (CostInput→shadcn) | detail layout |
| `knowledge/page.tsx` | `Card`, `Progress`, `Badge` | bus-factor |
| `graph/page.tsx` | `Card` (container), `Badge` (legend) | `GraphCanvas` untouched |
| `simulator/page.tsx` | `Card`, `Tabs`, `Slider`, `Table` | `useSearchParams` preserved |
| `succession/page.tsx` | `Card`, `Avatar`, `Badge` | playbooks |
| `inbox/page.tsx` | `Table`, `Dialog`, `Button` (approve/reject) | proposal review |
| `genome/page.tsx` | `Card` grid, `Badge`, `Progress` | replace inline `CATEGORY_TINT` with token-driven `Badge` variants (ink/fog/yellow — yellow only on the single critical-genome card) |
| `capture/page.tsx` | `Card`, `Textarea`, `Button`, `Progress` | OCR progress |
| `settings/page.tsx` | `Card`, `Tabs`, `Input`, `Switch`, `Select` | |

## Legacy cleanup

- **Delete** `web/src/app/dashboard/page.tsx` (legacy monolithic canvas+chat+insights). `(app)/` routes are canonical. Also remove any link pointing to `/dashboard` (Sidebar already routes `/` → `(app)/page.tsx`).
- **`web/src/app/canvas/page.tsx`:** keep the tldraw demo. Restyle **only** the page container (wrap `GraphCanvas` in `Card`, legend in `Badge` row, page bg → `bg-background`, text → `text-foreground`). Remove raw `slate-*`/`color:"blue"` from the page wrapper. `GraphCanvas.tsx` and its `nodeToShape`/`edgeToShape` mapping colors are **out of scope** — diff must show zero changes there.

## Tradeoffs

- **Programa light-only → derived dark:** dark values are hand-derived, not spec-blessed. Mitigated by contrast math above; M3 manual contrast review covers residual risk.
- **shadcn CLI on Tailwind v4:** registry has improved v4 support but edge cases remain (animate plugin, baseColor seed). Mitigated by installing components first, then overwriting `globals.css` last; manual rewire of `button.tsx`.
- **SVG animation perf:** SVG with <20 elements + rAF is trivial on modern browsers; cheaper than canvas/d3/tldraw. Acceptable for the auth route.
- **Yellow single-accent discipline across 14 pages:** enforced by M1 manual review per page; no reliable automated check.
- **`#a3a3a3` body-copy ban:** automated grep can't distinguish body vs muted usage; M3 covers it.

## Risks & mitigations

- **Diff > 500 lines:** see review slicing below; chained PRs.
- **Toaster in client root:** must mount in `(app)/layout.tsx` (client) — not root `layout.tsx` (RSC). `sonner`'s `Toaster` is a client component.
- **`register/page.tsx` may not exist yet:** spec lists it; if absent, create a minimal register route mirroring login (in scope per "login and register").
- **`GlobalSearch` → `Command`:** the in-memory `OrganizationMemory` search logic moves into a `Command`-driven palette; behavior preserved.

## Out of scope

tldraw internals/assets/mapping colors; backend/domain/API/auth logic; new product features; mobile overhaul beyond 768px sidebar; replacing tldraw or tesseract.js; Neue Haas Grotesk Text (Inter substitute).

## Review workload slicing

Forecast: ~1800–2400 changed lines total. Split into 4 chained PRs, each ≤ 500 lines:

- **PR1 — Tokens + font + button rewire:** `globals.css` rewrite (light + dark `@theme`), `layout.tsx` Inter swap, `button.tsx` token rewire, remove legacy helper classes, `lucide-react` + Radix deps added to `package.json`. (~350 lines.) Unblocks all subsequent PRs.
- **PR2 — shadcn component install + Sidebar/GlobalSearch:** all 20 component files via CLI, `Sidebar.tsx` lucide + `Badge` + token classes, `GlobalSearch` → `Command`, `(app)/layout.tsx` top bar (`Avatar`/`DropdownMenu`/`Toaster`). (~450 lines.)
- **PR3 — (app) pages redesign:** dashboard, people, people/[id], knowledge, graph, simulator, succession, inbox, genome, capture, settings — shadcn primitives, remove `slate-*`/`blue-*`, token-driven `Badge`/`Card`/`Table`/`Progress`/`Tabs`. If > 500 lines, split into PR3a (dashboard/people/knowledge/graph) + PR3b (simulator/succession/inbox/genome/capture/settings). (~480 lines per half.)
- **PR4 — Hero animation + login/register + legacy cleanup:** `GraphHero.tsx`, `LoginPage` + `register/page.tsx` rebuild, delete `dashboard/page.tsx`, restyle `canvas/page.tsx` container. (~400 lines.)

Each PR runs `npm --prefix web run typecheck` + `npm --prefix web run test` as the gate. PR1 also gates the T1/T2/T6 token/button tests; PR2 gates T3 (lucide Sidebar) + T5 (Toaster); PR4 gates T4 (reduced-motion). Banned-utility grep (spec AC #2) runs on the final PR.
