# Proposal — redesign-ui-refero

## Problem statement

The current UI is inconsistent. `globals.css` defines a bespoke "Cold Editorial" token set (`--paper`, `--ink`, `--hairline`, `--cobalt`, `--radius: 14px`) but those tokens are **not mapped into Tailwind v4 `@theme`**, so shadcn components cannot read them. Pages therefore mix raw `slate-*` utilities with inline `var(--…)` references, producing two parallel styling dialects. Only **one** shadcn component (`button`) is installed and it hardcodes `slate-950`/`slate-200`, ignoring tokens entirely. A legacy `dashboard/page.tsx` diverges completely (`bg-slate-50`/`slate-950`) and parallels the `(app)/` route group. No `lucide-react`, no `sonner`, no dark mode, no `@theme` contract — the component layer is effectively absent.

## Proposed solution

Adopt the **Programa design system** as the single source of truth: Swiss monochrome (ink `#1a1a1a`, paper `#ffffff`, fog `#f4f4f4`, ash `#a3a3a3`) with one highlighter-yellow accent `#fbff2b`, no shadows, 10/16px radii, 6px grid, Inter via `next/font` (400/500 only, tracking `-0.03em`), `lucide-react` icons. Map Programa tokens to the shadcn contract (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--input`, `--ring`, `--radius`, etc.) via a Tailwind v4 `@theme` block in `globals.css`. Install the full shadcn component set (card, input, label, textarea, select, dialog, sheet, tabs, table, badge, dropdown-menu, command, sonner, tooltip, separator, avatar, skeleton, scroll-area, progress, switch) so every page uses token-driven primitives. Derive a dark variant (canvas → near-black `#0e0e0e`, keep `#fbff2b` accent, soften borders to `#2a2a2a`). Add an SVG-based graph-construction hero animation on the login + register split-screen panel (nodes/edges build up, yellow pulse on the critical node, `prefers-reduced-motion` respected). Delete legacy `dashboard/page.tsx`; keep `canvas/page.tsx` and restyle its container `Card` + legend only.

## Scope

**In:** `globals.css` token + `@theme` rewrite; dark-mode token derivation; Inter font swap; `lucide-react` adoption; full shadcn component install; redesign of every page under `(app)/` (dashboard, people, people/[id], knowledge, graph, simulator, succession, inbox, genome, capture, settings) plus login and register; graph hero animation; `canvas/page.tsx` container restyle; deletion of legacy `dashboard/page.tsx`.

**Out:** tldraw internals/assets/theme; backend, domain, API routes, auth flow; new pages or features; mobile-responsive overhaul beyond the existing 768px sidebar behavior; replacing tldraw or tesseract.js.

## Success criteria

1. Every page renders from the Programa token set via `@theme` — no raw `slate-*` or `blue-*` utilities remain in redesigned pages.
2. Light **and** dark mode both work end-to-end; `#fbff2b` is the only chromatic accent and appears on at most one primary action per viewport.
3. Hero animation plays on login + register, loops cleanly, and renders a static completed graph when `prefers-reduced-motion` is set.
4. `npm --prefix web run typecheck` passes with zero errors.
5. `npm --prefix web run test` — existing 29-file / ~290-test suite still passes (no behavioral change).
6. Legacy `dashboard/page.tsx` is deleted; `(app)/` routes remain the canonical app surface.

## Risks

- **Diff size:** This is the largest change in the batch. It **will exceed the 500-changed-line review budget** and almost certainly requires **chained PRs** (token/font/`@theme` + shadcn install as PR 1; page redesigns as PR 2…N; animation + dark mode as a final PR). Task breakdown must slice along these seams.
- **Dark-mode derivation:** Programa spec is light-only; the near-black canvas, softened borders, and dark-fog muted surface must be hand-derived and checked for the `#a3a3a3`-on-dark contrast constraint.
- **shadcn CLI on Tailwind v4:** shadcn's registry assumes Tailwind v3 in places; CLI install against `@import "tailwindcss"` + `@theme` must be verified per component and may need manual token wiring.
- **`#fbff2b` discipline:** single-accent rule is easy to violate across many pages; needs a lint/review pass.
- **Animation perf:** SVG graph build-up must stay lightweight on the auth route (no tldraw load).

## Review workload note

**Flag:** This change **will exceed 500 changed lines**. Per `protect_review_workload`, the tasks phase must split it into chained PRs with each slice under the 500-line budget. Do not attempt a single mega-PR.
