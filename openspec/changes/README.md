# Change proposals — monetization roadmap (PIVOTED)

> Pivot after the PYME Chaos Reality review (viability of the original "maintain a
> living knowledge graph daily" pitch ≈ 2.6/10). That pitch fails because the
> input data doesn't exist, the company won't maintain it, and Excel + WhatsApp
> cover 80%. What survives: **done-for-you + sold at the moment of pain.**

## The three rules this roadmap now obeys

1. **Zero work from the client.** Generate the map from data they already have.
   Never ask employees to document themselves (the key person sabotages that).
2. **Sell at the moment of pain (a resignation), not as prevention.** SMEs don't
   buy low-frequency insurance proactively; they pay when someone is leaving.
3. **Target 20–50 employees** with real complexity and ideally a recent painful
   departure. Below ~15, Excel wins — don't fight there.

## What this means for the pitch

- ❌ Frozen: "a living knowledge graph your team keeps updated daily."
- ✅ New: "**Key-person risk audit** — we map who-knows-what from your existing
  data, put a € figure on it, and the day someone resigns you get a 24-hour
  transfer plan."

## The four changes, re-roled

| Order | Change | New role | Reality check |
|---|--------|----------|---------------|
| **1 (foundation)** | [add-passive-capture](./add-passive-capture) | Zero-effort auto-map from existing data; human only approves | Beats Chaos CEO ("llega hecho") and Excel Defender ("yo no puedo autogenerar el mapa") |
| **2 (wedge / entry product)** | [add-succession-playbook](./add-succession-playbook) | The thing you sell — triggered by a resignation; 24h transfer plan = day-one value | Passes Chaos CEO: real result at the exact moment of pain |
| **3 (sales engine)** | [add-bus-factor-simulator](./add-bus-factor-simulator) | One-time/annual **audit** artifact (the demo that closes), not a daily dashboard | The visceral "if Pedro goes" moment |
| **4 (sales engine)** | [add-financial-risk-exposure](./add-financial-risk-exposure) | Puts € on the audit and the playbook | The number a CFO reacts to |

## Status (2026-06-21) — all four shipped ✅

- ✅ **#1 passive capture** — auto-map (CSV + transcript), durable review inbox, badge.
- ✅ **#2 succession playbook** — generator + persisted missions + transitions + export.
- ✅ **#3 bus-factor simulator** — `/simulator`: multi-select departure → orphaned knowledge, halted processes, cascade, € impact. Entry point on Person detail.
- ✅ **#4 financial exposure** — € on dashboard / risk / person; wired into #2 and #3.

All built SDD + TDD, verified live against a seeded dev DB (292 tests).

## Build sequence (technical) vs sell sequence (GTM)

- **Build:** #1 auto-map → #4 € model → #2 playbook + #3 simulator (both consume
  #1 and #4).
- **Sell:** lead with #2 (the resignation wedge); #3 + #4 are the audit/demo that
  gets you in the door; #1 is the magic that makes it zero-effort.

Dependencies are soft — each degrades gracefully (e.g. simulator shows structural
impact without euros if #4 isn't shipped).
