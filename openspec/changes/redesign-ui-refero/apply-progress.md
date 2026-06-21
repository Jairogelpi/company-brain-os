# Apply Progress — redesign-ui-refero

## Status

Implemented across 4 PR-slice commits. Programa design system applied end-to-end.

## Implemented

### PR1 — Tokens + font + button (`51112d0`)

- `@theme inline` block with Programa raw palette (ink-black, paper-white, fog-gray, ash-gray, highlighter-yellow `#fbff2b`) and shadcn token contract (light).
- `.dark` override block (near-black canvas, kept yellow accent, softened border).
- Inter via `next/font` (weights 400/500, `--font-inter`), replacing Geist.
- `Button` rewired to tokens (`bg-primary`/`text-primary-foreground`/`ring-ring`), added `ghost`/`destructive`/`link` variants, no `slate-`.
- Tests: `globals.css.test.ts`, `button.test.ts`, `__grep.test.ts` (RED→GREEN).

### PR2 — shadcn components + sidebar + search + toaster (`a28425a`)

- 20 shadcn components added via `npx shadcn add` (card, input, label, textarea, select, dialog, sheet, tabs, table, badge, dropdown-menu, command, sonner, tooltip, separator, avatar, skeleton, scroll-area, progress, switch).
- `Sidebar` rewired to `lucide-react` icons; removed inline `<path d=>` helper and cobalt active tick (ink bar instead).
- `GlobalSearch` token-driven with `Search` lucide icon.
- `(app)/layout.tsx`: token top bar, `<Toaster />` mounted, backdrop-blur removed.
- Tests: `sidebar.test.ts`, `toaster-mount.test.ts`.

### PR3a — Dashboard/people/knowledge/graph (`85c9062`)

- Dashboard: metric `Card`s, `Progress`, risk `Badge`, single yellow CTA on seed button.
- People: `Card` grid + `Avatar` + `Badge`.
- Person detail: `Card` sections, `Avatar`, `Badge`, `Separator`.
- Knowledge: `Card` + `Progress` + `Badge` + `Input` search.
- Graph: `GraphCanvas` in `Card`, `Badge` legend, `bg-background`.

### PR3b — Simulator/succession/inbox/genome/capture/settings (`5c53709`)

- All six pages rebuilt on `Card`/`Badge`/`Button`/`Input`/`Textarea`/`Progress` with token classes.
- Genome `CATEGORY_TINT` replaced with monochrome bar classes; destructive red only for at-risk.
- Single yellow accent preserved per viewport (primary CTAs).

### PR4 — Hero animation + login/register + legacy cleanup

- `graph-hero-data.ts` pure module + tests for reveal steps (reduced-motion single static step; motion staggered with pulse).
- `GraphHero.tsx` SVG component: staggered node appear via `requestAnimationFrame`, edge draw, yellow pulse on critical node, `prefers-reduced-motion` branch.
- `LoginPage`/`RegisterPage`: split-screen ink panel hosting `<GraphHero />`, form in `Card` with `Input`/`Label`/`Button`; radial-gradient removed; behavior preserved (normalize + signIn post-register).
- `CostInput` migrated to tokens.
- Legacy `dashboard/page.tsx` deleted (no remaining `/dashboard` links).
- `canvas/page.tsx`: `Card` wrapper, `Badge` legend, `bg-background`.
- Legacy compat aliases removed from `globals.css`.

## Verification evidence

- `npm run typecheck`: passed (after clearing stale `.next/types`).
- `npm run test`: 45 passed files, 1 skipped, 369 passed tests, 3 skipped.
- Banned-utility grep `slate-[0-9]|blue-[0-9]` across `src/app` + `src/components/ui` excluding `canvas/GraphCanvas.tsx`: zero.
- Inline `<path d=` across `src/components` excluding `canvas/GraphCanvas.tsx`: zero.
- Legacy `var(--cobalt|risk|positive|gold|ink|paper|...)` across `src`: zero.
- `dashboard/page.tsx`: absent.

## Residual notes

- Canvas node/edge colors inside `GraphCanvas.tsx`/`canvas-mapping.ts` are tldraw domain colors (blue/orange/green/violet/grey/red) and were intentionally not touched per task scope.
- Hero animation is SVG/CSS-based (no tldraw on the landing hero), respects `prefers-reduced-motion`.
- Dark mode tokens derived per design.md (Programa spec is light-only); manual M1–M5 visual review still recommended in a browser.
