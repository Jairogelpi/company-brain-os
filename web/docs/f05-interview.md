# F0.5 Adaptive interview engine

F0.5 implements the deterministic core behind Time-to-First-Alarm. It does not call an AI model and it does not persist data. It turns owner answers into typed graph operation proposals that a future human-confirmation flow can apply to the F0 graph model.

## Contract

Source: `src/domain/interview.ts`.

The engine models:

1. `PERSONA_CLAVE` — "¿Quién es la persona que si falta mañana tienes un problema serio?"
2. `CONOCIMIENTO` — "¿Qué hace exactamente que nadie más sepa hacer?"
3. `SUSTITUTO` — "Si se fuera, ¿quién es el segundo que más se acerca? ¿Cuánto se acerca?"
4. `PROCESO` — "¿Qué para la empresa si se rompe?"
5. `REGLA_NO_ESCRITA` — "¿Hay algo que todos respetan pero nadie tiene escrito?"

Every session keeps:

- current question;
- asked questions;
- answers;
- collected facts;
- graph operation proposals;
- detected alarms.

Only one current question exists per turn.

## Deepen vs widen policy

The engine deepens when an answer signals fragility:

- one named key person;
- `solo`, `único`, `nadie más`, or no substitute;
- critical process language such as `se para producción`, `problema serio`, `crítico`;
- undocumented knowledge.

The engine widens when an answer signals coverage:

- several people know it;
- substitute level is `>= 3`;
- the knowledge is documented/manual/SOP/validated.

## First-alarm rule

An alarm is generated only when all are true:

- critical `Knowledge` was captured;
- exactly one expert is implied through `MASTERS level=5`;
- no real substitute exists (`LEARNS level < 3` or explicit no substitute);
- documentation was explicitly checked and is missing.

The alarm message uses the person and knowledge names:

```text
Si Pedro falta, hay una fragilidad crítica: nadie más domina configurar la llenadora crítica.
```

## Graph operation proposals

The engine proposes operations compatible with the F0 graph model:

- `create_node` for `Person`, `Knowledge`, and `Process`;
- `create_edge` for `MASTERS`, `LEARNS`, and `REQUIRES`;
- `update_node` for documentation status.

These are proposals only. Future F1/F3 code must validate and persist them after human confirmation.

## Out of scope

This slice intentionally does not add:

- real AI API calls;
- auth;
- database persistence;
- canvas interaction;
- missions;
- media capture.

## Verification

Run from `web/`:

```bash
npm test -- --run
npm run build
npm run db:generate
```
