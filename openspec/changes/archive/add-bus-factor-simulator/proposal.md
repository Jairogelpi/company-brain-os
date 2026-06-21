# Add Bus-Factor Simulator

## Why

The most persuasive moment in a sales demo is **visceral fear**. A dashboard
metric is abstract; watching your company break when one person disappears is
not. The domain already has the engine (`simulatePersonLeaving`,
`simulateMultipleLeaving`, `simulateDeepImpact` for cascades) but it is not
exposed anywhere in the product.

Competitors have nothing like this — their tools are passive repositories. An
interactive "what if they're hit by a bus" simulator that shows the cascade and
the euro impact in 30 seconds is a unique, shareable, deal-closing artifact.

## What Changes

- New page `/simulator` in the app shell: pick one or more people → see, live:
  - processes that halt,
  - knowledge left orphaned (no remaining expert),
  - the dependency cascade (second-order breakage),
  - total **€ impact** (reuses `add-financial-risk-exposure` cost model).
- A "Simulate departure" action on the People and Person-detail pages.
- Server reads the graph from the DB (scoped to tenant); simulation runs on the
  loaded snapshot — no writes, fully read-only.

## Impact

- Affected specs: `simulation` (new).
- Affected code: surface `src/domain/simulator.ts` +
  `src/domain/advanced-features.ts` (`simulateDeepImpact`); new `/simulator`
  page; reuse `useGraph` + financial-exposure.
- Depends on: [add-financial-risk-exposure] for the euro figure (degrades
  gracefully to impact-without-euros if not present).

## Positioning (post-pivot)

This is **not** a daily dashboard the SME maintains. It is the **audit / sales
artifact** — run once (or annually), or live in a sales meeting. Its job is to
create the visceral "if Pedro goes, here's what breaks and what it costs" moment
that gets you in the door and justifies the succession playbook (#2).

## PYME Reality Check

- **Chaos CEO:** doesn't have to *maintain* anything — he watches a 30-second
  what-if. Acceptable because it demands zero ongoing effort.
- **Excel Defender:** a spreadsheet cannot simulate a cascade (second-order
  breakage) or show it interactively. Clear win as a demo; weak as a daily tool —
  hence "audit artifact, not SaaS".

