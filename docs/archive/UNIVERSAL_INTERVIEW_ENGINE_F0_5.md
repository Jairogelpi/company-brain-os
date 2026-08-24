# Universal Adaptive Interview Engine — F0.5 archive

> Historical design note. This is not the current product contract. The accepted ontology and governance model live in [`../product/COMPANY_BRAIN_OS_V4.md`](../product/COMPANY_BRAIN_OS_V4.md). The ≤10-minute time-to-first-alarm target described here remains a pilot hypothesis, not a demonstrated commercial result.

## Original design intent

The early onboarding concept used one adaptive conversation engine across industries. Rather than branching by sector, it searched for recurring structures of operational fragility:

- one indispensable person
- a critical process without backup
- a unique supplier/system/knowledge dependency
- an unwritten rule that materially affects operations

The sector was expected to change vocabulary, not the underlying dependency structure.

## Exploration policy

The interview prioritized five probes:

1. **Key person** — who creates serious operational exposure if unavailable?
2. **Knowledge** — what does that person know or do that others cannot?
3. **Backup** — who is the nearest substitute and at what competency?
4. **Process** — what operational flow stops or degrades if the dependency fails?
5. **Unwritten rule** — what important rule is followed but not formally captured?

The intended adaptive behavior was:

- deepen when an answer reveals a single expert, weak backup or undocumented critical knowledge
- broaden when the current dependency is already covered
- use the organization’s own vocabulary while preserving the same canonical domain structure

## Early first-alarm hypothesis

The original concept attempted to surface an initial warning when a critical knowledge dependency had a bus factor of one and insufficient documentation/backup evidence. In later architecture this concept evolved substantially: canonical assertions require human approval, documentation alone cannot close person dependency, and verified transfer requires competency, access, evidence and independent review.

## Test ideas retained from the original design

- start with the highest-impact dependency probe
- deepen when fragility is detected
- broaden when sufficient redundancy is already present
- map different industry vocabulary to the same canonical relationship structure
- surface an explainable first risk without inventing unsupported entity types
- keep the interview adaptive without allowing AI output to become canonical truth automatically

## Why this file is archived

The early design contained useful product intuition but predated the current evidence-ledger governance model. In particular, claims such as achieving a useful result in ≤10 minutes must be measured in real pilots before being presented as demonstrated outcomes.

For current behavior use:

- [Company Brain OS v4](../product/COMPANY_BRAIN_OS_V4.md)
- [Canonical ledger architecture](../architecture/CANONICAL_LEDGER.md)
- [Pedro → Laura acceptance proof](../demo/PEDRO_LAURA.md)
- [Release scorecard](../RELEASE_SCORECARD.md)
