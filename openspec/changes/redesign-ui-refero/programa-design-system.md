# Programa — Design System Reference

> Source of truth for the redesign-ui-refero change. Swiss design studio aesthetic: monochrome + one highlighter yellow signal.

## Quick decision context

- **Light + Dark** both required. Programa spec is light-only; dark variant is DERIVED (invert canvas to near-black, keep #fbff2b accent, swap ink/paper roles, soften fog to a dark-elevated surface).
- **shadcn/ui** stays as component backbone. Programa tokens map to the shadcn `--background/--foreground/--primary/--card/--border/--input/--ring/--radius` contract via Tailwind v4 `@theme`.
- **Font:** Inter via `next/font` (closest free substitute for Neue Haas Grotesk Text). Replaces Geist.
- **Icons:** `lucide-react` (replaces inline SVGs).
- **Legacy `dashboard/page.tsx`:** DELETE (replaced by `(app)/` routes). `canvas/page.tsx`: keep, restyle container only.
- **Hero animation:** login + register screens get a graph-construction animation (nodes/edges building up the knowledge graph) as the hero visual on the split-screen panel.

## Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Ink Black | `#1a1a1a` | `--color-ink-black` | Primary text, all borders, icon strokes, logo, dividers, button outlines |
| Paper White | `#ffffff` | `--color-paper-white` | Page canvas, card surfaces, text on dark fills, inputs |
| Fog Gray | `#f4f4f4` | `--color-fog-gray` | Soft section bg, alternate surface, quiet card fill |
| Ash Gray | `#a3a3a3` | `--color-ash-gray` | Muted secondary text, inactive links, placeholders, tertiary metadata |
| Highlighter Yellow | `#fbff2b` | `--color-highlighter-yellow` | Primary action bg, focus highlights, tag fills — single chromatic accent |

## Typography

**Typeface:** Neue Haas Grotesk Text → **substitute: Inter** (next/font), weights 400 + 500 only.

- Tracking: -0.03em at all sizes
- Sizes: 14 / 16 / 17 / 20 / 24 / 42px
- Line height: 1.10 (display/heading), 1.20 (heading-sm), 1.40 (body/caption/subheading)

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 14px | 1.4 | -0.42px | `--text-caption` |
| body-sm | 16px | 1.4 | -0.48px | `--text-body-sm` |
| subheading | 20px | 1.4 | -0.6px | `--text-subheading` |
| heading-sm | 24px | 1.2 | -0.72px | `--text-heading-sm` |
| heading | 42px | 1.1 | -1.26px | `--text-heading` |

## Spacing & Shapes

- **Base unit:** 6px. Scale: 6 / 12 / 24 / 36 / 48 / 96
- **Radius:** 10px (nav, buttons, inputs), 16px (cards, info banners)
- **Layout:** 1200px max-width, 111px left margin, 96px section gap, 16px card padding, 12px element gap

## Surfaces & Elevation

- Surface 0 canvas `#ffffff`, Surface 1 fog card `#f4f4f4`, Surface 2 accent fill `#fbff2b`
- **NO shadows.** Elevation = surface color shift (white → fog) + 1px ink border. Lines define form, not light.

## Hard constraints (Do's / Don'ts)

**Do:**

- Use `#fbff2b` + 1px `#1a1a1a` border EXCLUSIVELY for the single primary action per screen
- -0.03em tracking everywhere, two weights only (400, 500)
- 10px radius for buttons/nav/inputs, 16px for cards/banners
- 6px spacing grid — every gap a multiple of 6
- `#f4f4f4` as the ONLY mid-surface between white and yellow
- Hierarchy via weight (400 vs 500), never color or size variation

**Don't:**

- No drop shadows, glow, or blur
- No `#fbff2b` on more than one element per viewport
- No second accent color
- No `#a3a3a3` for body copy (2.5:1 contrast fail)
- No radius > 16px
- No eyebrow/subtitle above 42px page headings

## shadcn token mapping (proposal must define exact values)

Light:

- `--background` = paper white, `--foreground` = ink black, `--primary` = highlighter yellow, `--primary-foreground` = ink black, `--border` = ink black (hairline), `--input` = ink black, `--ring` = highlighter yellow, `--card` = paper white, `--muted` = fog gray, `--muted-foreground` = ash gray, `--radius` = 10px

Dark (to derive in design phase):

- `--background` = near-black (e.g. `#0e0e0e`), `--foreground` = paper white, `--primary` = highlighter yellow (kept), `--border` = softened ink (e.g. `#2a2a2a`), `--card` = elevated dark surface, `--muted` = dark fog, `--muted-foreground` = dimmed ash

## Hero animation spec (login + register)

A graph-construction animation on the split-screen hero panel: nodes (person/knowledge/process) appear one by one with edges (MASTERS/DEPENDS_ON/REQUIRES) drawing between them, building up a small knowledge graph. Lightweight, loopable, respects `prefers-reduced-motion`. SVG or canvas-based (not tldraw — too heavy for a landing hero). Yellow accent pulses on the "most critical" node when the graph completes — ties the visual to the product's risk-detection story.
