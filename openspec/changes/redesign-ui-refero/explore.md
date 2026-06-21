# Explore — redesign-ui-refero

## Current UI inventory (every page + component, current style)

Design language: "Cold Editorial" (globals.css) — silver-grey paper `#f4f5f7`, cool ink, single cobalt signal `#1d4ed8`, red for risk only. Custom CSS vars (`--paper`, `--ink`, `--hairline`, `--cobalt`, `--risk`, `--gold`, `--radius: 14px`). Helper classes: `.panel`, `.panel-flat`, `.tick-left`, `.eyebrow`, `.font-display`, `.numerals`, `.rise`. Fonts: Geist Sans + Geist Mono (`next/font`). **Tailwind 4** (`@import "tailwindcss"`) with **no `@theme` mapping** of tokens to Tailwind — pages mix raw `slate-*` utilities AND `var(--…)` inline (inconsistent).

**Pages (`web/src/app`):**

- `layout.tsx` (RSC): wraps `AuthProvider`, sets Geist font vars.
- `login/page.tsx` (RSC + Suspense) → `LoginPage` client. Split-screen manifesto + form, `var(--ink)`/`var(--paper)` gradients. Most polished page.
- `(app)/layout.tsx` (client): `Sidebar` + top bar (`GlobalSearch`, user avatar, signout). `var(--paper)`/backdrop-blur.
- `(app)/page.tsx` Dashboard (client): metrics cards, risk list, exposure totals.
- `(app)/people/page.tsx`, `people/[id]/page.tsx` (client): list + detail, `CostInput`, risk exposure.
- `(app)/knowledge/page.tsx` (client): bus-factor analysis.
- `(app)/graph/page.tsx` (client): `GraphCanvas` + hydrate.
- `(app)/simulator/page.tsx` (client, ~188 lines): impact sim, `useSearchParams`.
- `(app)/succession/page.tsx` (client): playbooks.
- `(app)/inbox/page.tsx` (client): proposal review queue.
- `(app)/genome/page.tsx` (client): genome report w/ `CATEGORY_TINT` inline colors.
- `(app)/capture/page.tsx` (client): OCR capture (tesseract.js).
- `(app)/settings/page.tsx` (client): settings.
- `canvas/page.tsx` (client): standalone tldraw demo — raw `slate-*` + Tailwind color keywords (`color:"blue"`).
- `dashboard/page.tsx` (client, **legacy**): monolithic canvas+chat+insights+AI+memory. Uses `bg-slate-50`/`slate-950` — **does NOT follow Cold Editorial tokens**. Parallel to the `(app)` route group.

**Components (`web/src/components`):**

- `ui/button.tsx` — **ONLY shadcn component installed**; hardcoded `slate-950`/`slate-200` (NOT token-driven). 2 variants, 2 sizes.
- `layout/Sidebar.tsx` — custom nav, 10 items, cobalt active tick, inbox badge via `/api/inbox`.
- `layout/GlobalSearch.tsx` — custom search w/ in-memory `OrganizationMemory`; raw `slate-50`/`blue-400`.
- `auth/AuthProvider.tsx` (`SessionProvider` + `useAuth`), `auth/LoginPage.tsx`.
- `interview/InterviewChat.tsx` (+ `.test.ts`).
- `insights/InsightsPanel.tsx`, `AIConsultantPanel.tsx`, `MemoryPanel.tsx`.
- `CostInput.tsx`, `useGraph.ts` (data hook).
- `canvas/GraphCanvas.tsx` — tldraw wrapper, `nodeToShape`/`edgeToShape` mapping.

`components.json`: shadcn **new-york**, `rsc: true`, `baseColor: slate`, `cssVariables: true`, css = `src/app/globals.css`.

`package.json` UI deps: `@radix-ui/react-slot` (only Radix pkg), `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss 4.3.1`, `tldraw 5.1.1`, `tesseract.js`. **No** `@radix-ui/react-dialog/tabs/select/dropdown-menu/…`, no `lucide-react`, no `sonner`, no `cmdk`.

## Refero / 21st.dev / shadcn research

- **Refero (refero.design):** shadcn-style component library/marketplace — installable blocks & components via shadcn CLI registry URLs (copy-in, MIT-ish per component). Confirms installable, not just screenshots. **Open:** verify exact registry URL + license per block at proposal time (no web_search tool available here).
- **21st.dev:** AI dev agent + component marketplace; shadcn/React/Tailwind blocks + "magic UI" animated components, installable via CLI. Mixed licenses — verify per-block.
- **shadcn/ui:** foundation already configured (new-york/slate/cssVariables). Use as the token/component backbone; Refero/21st add blocks on top.
**Recommendation:** shadcn/ui as token/component backbone; pull specific Refero/21st blocks for dashboards, cards, command palette, tables — **not** a wholesale theme swap.

## Design system gaps (tokens, components, fonts)

- **Tokens:** globals.css has bespoke Cold Editorial vars but **no Tailwind v4 `@theme` mapping** → shadcn components can't read `--primary`/`--card`/`--border`/`--radius`. Need an `@theme` block mapping tokens to the shadcn contract (`--background`, `--foreground`, `--primary`, `--card`, `--popover`, `--border`, `--input`, `--ring`, `--radius`, + dark variants). `--radius=14px` vs shadcn default `0.5rem`.
- **Components missing (needed across pages):** card, input, label, textarea, select, dialog, sheet, tabs, table, badge, dropdown-menu, command (for GlobalSearch), toast/sonner, tooltip, separator, avatar, skeleton, scroll-area, progress. Only `button` present.
- **Icons:** no `lucide-react` — Sidebar uses inline SVG path strings; adopt lucide for consistency.
- **Fonts:** Geist matches Refero/21st aesthetic — **keep**.
- **Dark mode:** `color-scheme: light` hardcoded; no `.dark` tokens. Decision needed.

## Per-page redesign notes

- `layout.tsx`: keep Geist; mount `Toaster` (sonner).
- `login`: align form to shadcn Input/Button + Card; keep manifesto panel.
- `(app)/layout`: rebuild top bar with shadcn `Avatar`, `DropdownMenu` (user menu), `Command` (GlobalSearch → command palette). Sidebar → shadcn Sidebar pattern (collapsible) or keep custom w/ lucide icons + `Badge`.
- Dashboard: `Card` grid, `Badge` risk severity, `Table` risk list, `Progress` coverage.
- people list: `Table` + `Avatar`; detail: `Card` sections, `Badge`, `Separator`, `Input` (CostInput → shadcn Input).
- knowledge: `Card` + `Progress` + `Badge`.
- graph: `GraphCanvas` container `Card`; legend → `Badge`.
- simulator: `Card` + `Tabs` + `Slider` + `Table`.
- succession: `Card` playbook + `Avatar` + `Badge`.
- inbox: `Table`/List + `Dialog` for proposal review + approve/reject `Button`.
- genome: `Card` grid + `Badge` + `Progress`; replace inline `CATEGORY_TINT` with token-driven variants.
- capture: `Card` + `Textarea` + `Button` + `Progress` (OCR).
- settings: `Card` + `Tabs` + `Input` + `Switch` + `Select`.
- `canvas/page.tsx` + legacy `dashboard/page.tsx`: **decide** — delete or restyle. They diverge from tokens (raw slate-*). Recommend deprecating `dashboard/page.tsx` in favor of `(app)` routes.

## RSC / tldraw boundary notes

- Root `layout.tsx` + `login/page.tsx` are RSC; everything under `(app)/` is `"use client"`. Redesign mostly touches client components — RSC boundaries preserved. `Toaster` must mount in a client root.
- **tldraw:** self-contained theme via `tldraw/tldraw.css` + its own assets. **Out of scope** to restyle tldraw internals; only restyle the container `Card`/legend. `canvas-mapping` colors are separate from app tokens.

## Out of scope

- tldraw internal theme/assets; backend/domain logic, API routes, auth flow; new pages/features; mobile-responsive overhaul beyond existing 768px sidebar hide; replacing Geist.

## Open questions for proposal

1. Source of truth: shadcn/ui tokens as backbone + Refero/21st blocks on top (recommended), OR full Refero theme adoption?
2. Dark mode: required now or light-only?
3. Brand/accent: keep cobalt `#1d4ed8` as `--primary`, or adopt Refero/21st default (often neutral/zinc + violet)?
4. Legacy `dashboard/page.tsx` + `canvas/page.tsx`: delete, redirect, or restyle?
5. License verification per Refero/21st block before install (mixed licenses).
6. `lucide-react` adoption (replaces inline SVGs) — confirm.
7. Component install scope — full shadcn set or minimal (card, input, dialog, tabs, table, badge, dropdown-menu, command, sonner, avatar)?
