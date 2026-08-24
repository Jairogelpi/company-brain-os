# Canonical demonstration: Pedro → Laura

## Scenario

Pedro alone can configure a critical production line. Laura has observed the work but is not yet a verified backup.

## Expected journey

| Stage | Evidence | Product result |
| --- | --- | --- |
| Discovery | Approved Pedro, Knowledge, criticality and `MASTERS(level=5)` assertions | Single-point-of-failure and undocumented-critical risks |
| Documentation | Reviewed procedure; `DOCUMENTED=true` | Documentation risk closes; person dependency remains |
| Identity binding | Each login is owner-mapped 1:1 to its canonical Person node | Stable tenant IDs replace name matching |
| Assessment | A mapped assessor observes Laura's run; competency 4/5; system access verified | Transfer verification is proposed with both user and Person identity |
| Independent review | The mapped reviewer Person is neither Laura nor the assessor Person | Verification becomes approved |
| Recalculation | Approved Laura `MASTERS(level=4)` assertion cites the verification evidence | Bus factor becomes 2; mission closes; exposure is mitigated |

## Executable evidence

```bash
cd web
npm run test:e2e
```

The test is `src/domain/canonical-pedro-laura.e2e.test.ts`. It also rebuilds the projection twice and asserts an identical hash, assertion provenance on all rows and no remaining risk for the target knowledge.

## Product invariant

Approving a document must never create a backup or close a single-person dependency. Display-name similarity must never establish reviewer independence. Any future change that reintroduces either behavior must fail CI.
