# Spec — redesign-ui-refero

> Programa Swiss design system as single source of truth. shadcn/ui as component backbone, tokens mapped via Tailwind v4 `@theme`. Domain: `ui-design-system` (no prior canonical spec — full new spec).

## Requirements

### Requirement: Token layer via @theme

The system MUST define a Tailwind v4 `@theme` block in `web/src/app/globals.css` mapping Programa tokens to the shadcn contract for both light and `.dark` variants: `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--border`, `--input`, `--ring`, `--muted`, `--muted-foreground`, `--radius`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--secondary`, `--secondary-foreground`. Light values: paper `#ffffff`, ink `#1a1a1a`, primary `#fbff2b`, border/input ink, muted fog `#f4f4f4`, muted-foreground ash `#a3a3a3`, radius `10px`. Dark variant MUST invert canvas to near-black (`#0e0e0e`), keep `#fbff2b` primary, soften borders to `#2a2a2a`, swap ink/paper roles. The legacy bespoke vars (`--paper`, `--ink`, `--cobalt`, `--gold`) MUST be removed or aliased to the new contract.

#### Scenario: shadcn component reads token

- GIVEN globals.css has the `@theme` block
- WHEN a shadcn `Button` renders
- THEN its background resolves to `--primary` (`#fbff2b` light / `#fbff2b` dark) without hardcoded hex

### Requirement: Banned utility exclusion

No redesigned page or component under `web/src/app` MAY use raw `slate-*` or `blue-*` Tailwind utilities. The single shadcn `button.tsx` MUST NOT hardcode `slate-950`/`slate-200`.

#### Scenario: grep finds no banned utilities in app routes

- GIVEN the redesign is complete
- WHEN `grep -rE "slate-[0-9]|blue-[0-9]" web/src/app web/src/components/ui` runs
- THEN it returns zero matches (excluding tldraw internals and `canvas/GraphCanvas` mapping colors which are out of scope)

### Requirement: Inter via next/font

The system MUST load Inter through `next/font/google` with weights 400 and 500 only, tracking `-0.03em` applied site-wide. Geist font vars MUST be removed from root `layout.tsx`.

#### Scenario: font swap

- GIVEN root `layout.tsx`
- WHEN it renders
- THEN the `--font-inter` CSS variable is set and `font-feature-settings` tracking is `-0.03em`

### Requirement: lucide-react icons in Sidebar

`Sidebar.tsx` MUST use `lucide-react` icons for all nav items, replacing inline SVG path strings.

#### Scenario: no inline SVG paths in Sidebar

- GIVEN `Sidebar.tsx`
- WHEN inspected
- THEN every nav icon imports from `lucide-react` and no `<path d=…>` strings remain

### Requirement: shadcn component install set

The system MUST install shadcn components: card, input, label, textarea, select, dialog, sheet, tabs, table, badge, dropdown-menu, command, sonner, tooltip, separator, avatar, skeleton, scroll-area, progress, switch. `button` MUST be rewired to tokens. `Toaster` (sonner) MUST mount in a client root.

#### Scenario: component files present

- GIVEN `web/src/components/ui/`
- WHEN listed
- THEN all 20 component files exist and import token CSS vars (no hardcoded slate/blue)

### Requirement: Single-accent discipline

`#fbff2b` MUST appear on at most one primary action per viewport. No drop shadows, glow, or blur in redesigned CSS. Radius MUST be 10px (buttons/inputs/nav) or 16px (cards/banners). Every spacing gap MUST be a multiple of 6px. No second accent color. `#a3a3a3` MUST NOT be used for body copy.

#### Scenario: yellow count per viewport

- GIVEN any redesigned page
- WHEN rendered in light or dark
- THEN at most one element has `#fbff2b` background/fill

### Requirement: Light + dark mode

Both light and dark themes MUST render every redesigned page without contrast failures. `.dark` class on `<html>` toggles the dark token set.

#### Scenario: dark toggle

- GIVEN `document.documentElement.classList` adds `dark`
- WHEN a Card renders
- THEN its background resolves to the dark `--card` value and foreground remains readable

### Requirement: Hero graph animation

Login and register split-screen panels MUST display an SVG graph-construction animation: nodes appear, edges draw, yellow pulse on the critical node, loopable. When `prefers-reduced-motion: reduce` is set, the animation MUST render a static completed graph and not animate.

#### Scenario: reduced motion

- GIVEN the user agent sets `prefers-reduced-motion: reduce`
- WHEN the login hero renders
- THEN the graph is shown in its completed state with no rAF/transition running

### Requirement: Legacy dashboard deleted

`web/src/app/dashboard/page.tsx` MUST be deleted. `(app)/` routes remain the canonical app surface.

#### Scenario: file absent

- GIVEN the change is applied
- WHEN `ls web/src/app/dashboard/page.tsx`
- THEN it does not exist

### Requirement: Canvas container restyle

`canvas/page.tsx` container MUST be restyled (Card + legend via tokens). tldraw internals and `GraphCanvas` mapping colors MUST remain untouched.

#### Scenario: tldraw internals unchanged

- GIVEN `canvas/GraphCanvas.tsx` and `tldraw` assets
- WHEN diffed
- THEN only the page container and legend wrapper changed

### Requirement: All (app) pages redesigned

Every page under `(app)/` — dashboard, people, people/[id], knowledge, graph, simulator, succession, inbox, genome, capture, settings — plus login and register MUST be rebuilt on shadcn primitives driven by Programa tokens.

#### Scenario: page uses Card primitive

- GIVEN `(app)/dashboard/page.tsx`
- WHEN inspected
- THEN metric surfaces render via `Card` and risk severity via `Badge` from `components/ui`

## Acceptance criteria

1. `globals.css` contains a `@theme` block mapping all shadcn contract vars for light + `.dark`; legacy `--paper`/`--ink`/`--cobalt`/`--gold` removed or aliased.
2. `grep -rE "slate-[0-9]|blue-[0-9]" web/src/app web/src/components/ui` returns zero matches (excluding tldraw internals + `GraphCanvas` mapping).
3. Inter loaded via `next/font/google`, weights 400+500, tracking `-0.03em`; Geist removed from root layout.
4. `Sidebar.tsx` imports all icons from `lucide-react`; no inline `<path d=…>`.
5. All 20 listed shadcn components present in `components/ui/`; `button` rewired to tokens; `Toaster` mounted in a client root.
6. No `box-shadow` / `drop-shadow` / `blur` utilities in redesigned CSS; radii only 10px or 16px; spacing gaps multiples of 6px.
7. `#fbff2b` appears on at most one primary action per viewport across all redesigned pages (manual review per page).
8. Light and dark mode both render every redesigned page; `.dark` toggle swaps token set.
9. Hero animation plays + loops on login and register; static completed graph under `prefers-reduced-motion`.
10. `web/src/app/dashboard/page.tsx` deleted.
11. `canvas/page.tsx` container restyled; tldraw internals and `GraphCanvas` mapping unchanged.
12. All 12 `(app)` pages + login + register rebuilt on shadcn primitives.
13. `npm --prefix web run typecheck` passes with zero errors.
14. `npm --prefix web run test` — existing suite still passes (no behavioral change).

## Non-goals

- tldraw internal theme/assets/canvas-mapping colors.
- Backend, domain logic, API routes, auth flow.
- New pages or product features.
- Mobile-responsive overhaul beyond existing 768px sidebar behavior.
- Replacing tldraw or tesseract.js.
- Neue Haas Grotesk Text (Inter is the free substitute).

## Test plan

**Automatable (programmatic contract):**

- T1: Vitest unit test asserting `globals.css` `@theme` exports `--primary: #fbff2b` for `:root` and `.dark` (parse CSS, assert token presence).
- T2: Vitest test asserting no `slate-`/`blue-` utility classes in `components/ui/**` source (grep-based assertion).
- T3: Component test on `Sidebar` rendering each nav item with a `lucide-react` icon (no `<path>` in output HTML).
- T4: Component test on the hero animation component: with `prefers-reduced-motion` stubbed to `reduce`, asserts no `requestAnimationFrame` is scheduled and the completed graph nodes/edges are present in one render.
- T5: Component test asserting `Toaster` is mounted in the client root tree.
- T6: Snapshot/className test on `Button` asserting `bg-primary` resolves via token (no `slate-` class).
- T7: `npm --prefix web run typecheck` — zero errors.
- T8: `npm --prefix web run test` — existing suite green, new tests green.

**Manual (visual inspection):**

- M1: Per-page review that `#fbff2b` appears on at most one primary action per viewport (light + dark).
- M2: Per-page review of no-shadows, 10/16px radii, 6px spacing grid adherence.
- M3: Dark-mode contrast review (ash `#a3a3a3` not used for body copy; borders `#2a2a2a` readable).
- M4: Hero animation plays, loops, and static-under-reduced-motion confirmed in a real browser.
- M5: `canvas/page.tsx` container restyle verified; tldraw internals untouched (diff review).

**Honesty note:** T1–T6 cover the programmatic contract (tokens, banned utilities, icons, reduced-motion, Toaster, button wiring). Single-accent-per-viewport (M1), spacing grid (M2), dark contrast (M3), and browser-rendered animation (M4) are not reliably automatable and require manual review.
