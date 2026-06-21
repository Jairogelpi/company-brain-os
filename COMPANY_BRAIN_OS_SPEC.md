# Company Brain OS — Especificación Técnica (SDD + TDD)

**Versión:** 3.0
**Estado:** Especificación de ingeniería lista para construir
**Alcance de este documento:** diseño de software (SDD) + plan de pruebas (TDD) + stack recomendado
**Principio rector:** el grafo es la única fuente de verdad; la documentación es una consecuencia, no el objetivo.

**Cambios v3 respecto a v2:**
- **Time-to-first-alarm** como corazón del onboarding (nueva fase F0.5): el primer valor llega en ~10 minutos vía entrevista de IA, no construyendo el grafo a mano. Responde a la pregunta que decide si la empresa existe: *¿por qué un empresario dedicaría 20 horas a construir esto?*
- **Knowledge Confidence (0–100)** incorporado al núcleo como atributo derivado de cada `Knowledge`.
- **Timeline universal** por nodo, como vista del `event_log` que ya existe.
- **AI Organizational Consultant** y **Company Simulator** elevados a motores propios (fase de expansión): recomiendan, no deciden.
- **Company Genome** (reglas no escritas, valores, políticas) modelado como tipo de `Knowledge` dentro del grafo, NO como capa o producto separado — preserva la única fuente de verdad.

---

## 0. Resumen ejecutivo

Company Brain OS construye un gemelo digital del conocimiento de una empresa como un **grafo vivo**. El empresario lo construye de dos formas simultáneas —hablándole a una IA y manipulando un canvas visual— sobre una única fuente de verdad. El sistema calcula automáticamente la fragilidad organizativa (bus factor, dependencias, cobertura, **confianza**) y permite **accionarla**: cuando algo es crítico o no está documentado, el empresario lanza una **misión de documentación** a un empleado, que aporta conocimiento (vídeo, audio, imagen, documento, diagrama), y el sistema lo conecta al grafo y recalcula el riesgo.

El primer contacto no es construir nada: es una **entrevista de IA de ~10 minutos** que devuelve la primera alarma real ("si Pedro falta, paras producción"). El grafo se construye como subproducto de responder preguntas, no como tarea previa.

El producto se sostiene sobre un bucle único de valor:

```
entrevista IA  →  ver fragilidad  →  lanzar misión  →  empleado aporta conocimiento
      ↑                                                          ↓
   medir mejora  ←──────────  riesgo baja  ←──────  conocimiento se vuelve activo
```

---

## 1. Objetivos y no objetivos

### 1.1 Objetivos
1. Modelar cualquier empresa del mundo con un esquema universal pequeño (6 tipos de nodo, 7 relaciones).
2. Permitir edición del grafo por dos vías que comparten una única verdad: lenguaje natural (IA) y canvas visual.
3. Calcular en vivo métricas de fragilidad: bus factor, dependency score, knowledge coverage, resilience.
4. Detectar riesgos automáticamente (experto único, proceso sin respaldo, dependencia de proveedor/cliente).
5. Convertir un riesgo en una **misión** asignable a un empleado, con responsable, prioridad y fecha límite.
6. Capturar conocimiento del empleado en múltiples formatos (audio, vídeo, imagen, documento, pantalla, diagrama) con fricción mínima.
7. Transformar el conocimiento capturado en artefactos útiles (SOP, checklist, FAQ, tarjeta de conocimiento) conectados al grafo.
8. Permitir crear diagramas y esquemas de forma fácil, derivados del grafo o dibujados a mano.
9. Simular el impacto de perder una persona, proceso, activo o proveedor.
10. Reducir el riesgo de forma medible cuando se completan misiones (el grafo se recalcula).

### 1.2 No objetivos (v1–v2)
- No es un ERP, CRM, ni gestor documental tradicional.
- No vigila ni monitoriza a los empleados de forma pasiva.
- No conecta automáticamente con sistemas externos en v1 (decisión de producto: la barrera de entrada de las PYME es no saber conectar nada). Las integraciones quedan para v3+.
- La IA nunca inventa la realidad organizativa: toda inferencia es una propuesta que el humano confirma.
- No promete sustituir la formación presencial; la organiza y la protege.

---

## 2. Modelo de dominio universal

### 2.1 Tipos de nodo (6, cerrados)

| Tipo | Qué representa | Atributos clave |
|------|----------------|-----------------|
| `Person` | Quien aporta valor: empleado, socio, consultor, cliente/proveedor clave si se modela como individuo | `name`, `role`, `email`, `unit_id`, `criticality` |
| `Knowledge` | Un saber transmisible: receta, fórmula, procedimiento, criterio, **y también regla no escrita / valor / política (Genome)** | `name`, `domain`, `knowledge_type` (técnico/proceso/regla/valor/política), `criticality`, `documented` (bool), `validation_state`, `confidence` (0–100, derivado) |
| `Process` | Una actividad: vender, fabricar, facturar | `name`, `domain`, `criticality` |
| `Asset` | Algo que la empresa posee/usa: producto, servicio, máquina, software, documento, marca, cuenta cliente, contrato de proveedor | `name`, `asset_type`, `criticality` |
| `Unit` | Agrupación organizativa: departamento, equipo, sede | `name`, `unit_type` |
| `Risk` | Fragilidad detectada (normalmente generado por el sistema) | `name`, `severity`, `status`, `source_node_id` |

**Regla de oro:** lo específico de cada sector vive en **atributos** (`asset_type: máquina`, `domain: producción`), nunca en tipos nuevos. Esto es lo que hace el modelo universal.

**Company Genome (ADN organizativo):** las reglas no escritas, valores y políticas ("nunca fabricamos una muestra sin pago previo") son el conocimiento más valioso y difícil de transmitir, pero **no necesitan una capa propia**. Se modelan como nodos `Knowledge` con `knowledge_type ∈ {regla, valor, política}`. Así heredan todo gratis: pueden tener bus factor (¿cuántos las conocen?), confianza, misiones de documentación y timeline. Darles datos separados rompería la única fuente de verdad — precisamente el error que este diseño evita. El "Genome" es por tanto una **vista filtrada** del grafo (`knowledge_type` cultural), no un almacén.

### 2.2 Tipos de relación (7, cerrados)

| Relación | De → A | Atributos | Para qué sirve |
|----------|--------|-----------|----------------|
| `MASTERS` (domina) | Person → Knowledge | `level` (0–5) | Base del cálculo de bus factor |
| `LEARNS` (aprende) | Person → Knowledge | `level`, `started_at` | El sustituto en formación; reduce el riesgo |
| `REQUIRES` (requiere) | Process → Knowledge \| Process → Asset | — | Qué hace falta para que el proceso funcione |
| `EXECUTES` (ejecuta) | Person → Process | — | Quién opera qué |
| `PRODUCES` (produce) | Process → Asset | — | Qué genera la actividad |
| `DEPENDS_ON` (depende de) | cualquiera → cualquiera | `strength` | Comodín de dependencia |
| `BELONGS_TO` (pertenece a) | Person \| Process \| Asset → Unit | — | Estructura organizativa |

### 2.3 Escala de niveles de conocimiento (0–5)
`0` No conoce · `1` Observó · `2` Participó · `3` Ejecuta · `4` Enseña · `5` Experto.
Solo cuenta como "sustituto real" un nivel ≥ 3.

### 2.4 Invariantes del modelo (se prueban en TDD)
- Toda arista conecta tipos permitidos por su definición (`REQUIRES` no puede salir de una `Person`).
- La IA nunca crea tipos fuera del catálogo; si algo no encaja, mapea al más cercano + atributo.
- Ningún nodo se borra físicamente: se marca `archived` (logs inmutables, principio de auditoría).
- El canvas no guarda estado de datos propio: solo posiciones de render; los datos viven en el grafo.

---

## 3. Métricas (definiciones formales)

Todas son consultas sobre el grafo. Se recalculan al cambiar el grafo.

- **Bus Factor de un Knowledge** = nº de `Person` con `MASTERS.level ≥ 3` sobre ese nodo. `1` = crítico; `0` = ya perdido.
- **Knowledge Confidence (0–100)** = índice de fiabilidad de un `Knowledge`, derivado de: nº de expertos (más = mayor), estado de validación, antigüedad de la última actualización (decae con el tiempo) y uso/refuerzo reciente. Un conocimiento crítico con confianza 22 es una alarma distinta a uno con 95; el Risk Engine pondera por confianza, no solo por bus factor.
- **Knowledge Coverage** = % de `Knowledge` con `criticality=alta` que tienen bus factor ≥ 2.
- **Dependency Score de una Person** = nº de `Knowledge`/`Process` críticos donde es el único con nivel ≥ 3.
- **Process Resilience** = mínimo bus factor entre todos los `Knowledge` que el proceso `REQUIRES`.
- **Transfer Velocity** = ritmo de subida de nivel en relaciones `LEARNS` (Δnivel / tiempo).
- **Organizational Health** = índice compuesto (0–100) ponderando coverage, resilience y nº de riesgos abiertos.
- **Company IQ** = madurez: % del grafo con conocimiento documentado y validado.

---

## 4. Onboarding — Time-to-First-Alarm (el corazón de la adopción)

Responde al riesgo número 1 del proyecto: *¿por qué un empresario dedicaría 20 horas a construir el grafo?* La respuesta: **no se le pide construir nada.** El primer valor llega en ~10 minutos y el grafo se construye como subproducto de una conversación.

### 4.1 Principio
El objetivo no es "30 minutos para el primer valor" sino **time-to-first-alarm casi cero**. Construir nodos es trabajo; contestar "¿quién es indispensable aquí?" es una conversación que el dueño *quiere* tener. La misma IA que hace el onboarding es la que luego lanza misiones y recomienda.

### 4.2 Flujo
```
1. El dueño no ve un canvas vacío: ve a la IA haciéndole preguntas.
2. Entrevista guiada (~10 min), adaptada al sector:
     - "¿Quién es la persona que si falta mañana tienes un problema serio?"
     - "¿Qué hace exactamente que nadie más sepa hacer?"
     - "Si esa persona se fuera, ¿quién es el segundo que más se acerca?"
     - "¿Qué proceso para la empresa si se rompe?"
     - "¿Hay alguna regla que todos respetan pero nadie tiene escrita?"  (← captura Genome)
3. Por detrás, cada respuesta crea nodos y aristas (Person, Knowledge, Process, MASTERS...).
4. Al minuto ~10, primera alarma real con nombre y apellido:
     "Si Pedro falta, paras producción: nadie más sabe configurar la llenadora."
5. Ese susto ES el producto. A partir de ahí el dueño quiere seguir.
6. El canvas aparece DESPUÉS, ya poblado, para refinar — no como punto de partida.
```

### 4.3 Regla de diseño
El onboarding es una fase del producto (F0.5), no un paso previo desechable. Es lo que decide si alguien llega siquiera a usar el canvas. Toda operación de la entrevista sigue siendo una **propuesta** que el humano confirma (Human Controlled Truth).

---

## 5. Bloque — Sistema de Misiones de Documentación

Este es el bloque que conecta "ver el riesgo" con "resolverlo", y el que alimenta el sistema con contenido real.

### 4.1 Flujo end-to-end de una misión

```
1. El sistema detecta un Risk (ej: Knowledge "configurar llenadora", bus factor 1, no documentado)
2. El empresario pulsa "Resolver" sobre ese riesgo
3. Se abre el compositor de misión, pre-rellenado por la IA:
     - Objetivo: "Documentar y transferir: configurar llenadora"
     - Asignado a: Pedro (el experto) + Laura (sustituta sugerida)
     - Tipo de aporte sugerido: vídeo del proceso + audio explicativo
     - Prioridad: Alta · Fecha límite: 15 días
4. El empresario ajusta y envía → notificación al empleado (email/push/enlace)
5. El empleado abre una vista ULTRA simple (sin login complejo, enlace mágico):
     - "Explica cómo configuras la llenadora"
     - Botones grandes: Grabar vídeo · Grabar audio · Subir foto · Subir documento · Dibujar
6. Sube el contenido. La IA lo procesa:
     - transcribe audio/vídeo, hace OCR de imágenes, extrae texto de documentos
     - genera un artefacto (SOP/checklist/tarjeta) en borrador
     - propone a qué nodo del grafo conectarlo
7. El empresario (o un validador) revisa y aprueba → el Knowledge pasa a documented=true, validation_state=validated
8. El grafo se recalcula: si además Laura sube a nivel 3, el bus factor sube y el Risk se cierra
9. Se registra todo en el log inmutable de la misión
```

### 4.2 Entidades de misión

| Entidad | Campos |
|---------|--------|
| `Mission` | `id`, `objective`, `target_node_id`, `assignees[]`, `priority`, `due_date`, `status` (open/in_progress/submitted/validated/closed), `created_by`, `created_at` |
| `Contribution` | `id`, `mission_id`, `author_id`, `media_type` (audio/video/image/document/screen/drawing/chat), `storage_url`, `transcript`, `ocr_text`, `created_at` |
| `Artifact` | `id`, `contribution_ids[]`, `type` (SOP/checklist/FAQ/manual/quick_guide/knowledge_card/diagram), `content`, `linked_node_id`, `validation_state` |

### 4.3 Creación fácil de diagramas y esquemas
- **Derivados del grafo:** un botón "Generar diagrama" sobre cualquier nodo produce automáticamente organigrama, flujo de proceso, mapa de dependencias o ruta de formación, recorriendo el grafo. No se dibuja: se proyecta.
- **Dibujados a mano:** el mismo canvas (tldraw) permite al empleado esbozar un esquema libre que se guarda como `Artifact type=diagram` y se cuelga del nodo.
- **Asistidos por IA:** el empleado describe un proceso en texto/audio y la IA propone un flujo que el empresario ajusta en el canvas.

### 4.4 Captura universal (fricción mínima)
Una sola pantalla para el empleado, sin jerga, enlace mágico sin contraseña:
`Explicar` (audio/vídeo) · `Mostrar` (imagen/vídeo) · `Adjuntar` (documento) · `Grabar pantalla` · `Dibujar` · `Conversar` (chat guiado por IA que hace las preguntas correctas según el sector).

---

## 6. Motores de inteligencia (Consultant, Simulator, Timeline)

Tres motores que se apoyan en el grafo + métricas ya existentes. Confidence y Timeline entran en el núcleo (baratos, multiplicadores); Consultant y Simulator son motores propios en fase de expansión.

### 6.1 Timeline universal (núcleo)
Cada nodo tiene historia completa, como **vista del `event_log` append-only que ya existe** — no es almacén nuevo. Ejemplo para un `Knowledge`: creado por Paco (2024) → modificado por Laura (2025) → validado por Calidad (2026) → retirado (2027). Coste casi nulo, valor alto: convierte el log de auditoría en narrativa de cada activo de conocimiento.

### 6.2 AI Organizational Consultant (expansión)
Evolución del Risk Engine que **recomienda, no decide** (respeta Human Controlled Truth). Responde:
- "¿Qué debería documentar este mes?" → ordena nodos por (criticidad × fragilidad × valor), datos que ya existen.
- "¿Qué aprendizaje genera más ROI?" → conocimiento crítico con bus factor 1 y un aprendiz cercano.
- "¿Dónde invierto en formación?" → unidades con menor resilience.
Es una capa de lectura sobre grafo + métricas, no un motor de datos nuevo.

### 6.3 Company Simulator (expansión, profundiza F11)
Motor de "¿qué pasa si...?" que recorre el grafo:
- "¿Qué pasa si Paco se jubila?" → procesos afectados, productos afectados, clientes afectados, facturación en riesgo, tiempo estimado de recuperación.
- También: pérdida de proveedor, máquina o departamento.
El resultado es un informe de impacto operativo + financiero + organizativo, derivado de recorrer `DEPENDS_ON`, `REQUIRES`, `EXECUTES`, `PRODUCES`.

---

## 7. Arquitectura del sistema (SDD)

### 5.1 Vista de capas

```
┌─────────────────────────────────────────────────────────┐
│ Cliente (Next.js + React)                                │
│  ├─ Canvas (tldraw) ──┐                                  │
│  ├─ Chat IA          ─┼─ ambos editan el MISMO grafo     │
│  ├─ Panel de riesgo   │                                  │
│  ├─ Compositor de misiones                               │
│  └─ Vista empleado (captura universal, enlace mágico)    │
└───────────────┬─────────────────────────────────────────┘
                │  tRPC / API tipada
┌───────────────▼─────────────────────────────────────────┐
│ Backend (Next.js API routes / Edge + Node runtime)       │
│  ├─ Graph Service     (CRUD de nodos/aristas = verdad)   │
│  ├─ AI Extraction Svc (texto → operaciones de grafo)     │
│  ├─ Metrics Engine    (bus factor, coverage, health)     │
│  ├─ Risk Engine       (detección de fragilidad)          │
│  ├─ Mission Service    (misiones, asignación, estado)    │
│  ├─ Capture/Ingest Svc (media → transcripción/OCR)       │
│  └─ Artifact Builder   (contenido → SOP/checklist/card)  │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│ Datos                                                    │
│  ├─ PostgreSQL + Apache AGE  (grafo = única verdad)      │
│  ├─ pgvector                 (búsqueda semántica)        │
│  ├─ Object storage (S3/R2)   (media subida)             │
│  └─ Event log (append-only)  (auditoría inmutable)       │
└──────────────────────────────────────────────────────────┘
```

### 5.2 La regla arquitectónica que evita el fallo clásico
**Una sola fuente de verdad: el grafo en Postgres+AGE.** El chat y el canvas son dos *editores* del mismo grafo, no dos almacenes. El canvas solo persiste posiciones de render (x,y) por nodo; jamás duplica los datos. La IA emite **operaciones** (`create_node`, `create_edge`, `update_level`), nunca reescribe el grafo entero — así nunca pisa lo que el usuario hizo a mano.

### 5.3 Contrato de la IA de extracción
- Entrada: mensaje del usuario + snapshot mínimo del grafo relevante (no todo el grafo).
- Salida: lista de operaciones tipadas validadas contra el esquema 6+7. Toda operación es una **propuesta** hasta confirmación (principio Human Controlled Truth).
- Si algo no encaja en el catálogo: mapear al tipo más cercano + atributo; nunca crear tipo nuevo.

### 5.4 Sincronización en tiempo real
Cambios en el grafo → eventos → el canvas y los paneles se redibujan. Para multi-usuario: capa de sincronización en vivo (ver stack). Last-write-wins a nivel de propiedad, con el log de eventos como verdad reconstruible.

---

## 8. Stack tecnológico recomendado (moderno, útil, barato)

Criterio: máximo apalancamiento, coste casi cero hasta tener tracción, sin lock-in caro.

### 6.1 Frontend
- **Next.js 15 (App Router) + React + TypeScript** — un solo repo, SSR + API juntas, despliegue gratis/barato.
- **tldraw** — canvas extensible con tus propios tipos de nodo; API de estado limpia para sincronizar con el grafo. Mejor que Excalidraw para construir un editor con esquema propio.
- **Tailwind CSS + shadcn/ui** — UI rápida y consistente, sin coste.
- **TanStack Query** — caché y estado de servidor.

### 6.2 Backend / API
- **tRPC** — API totalmente tipada extremo a extremo sobre Next.js, sin escribir contratos REST a mano.
- **Drizzle ORM** — ligero, tipado, control fino del SQL (necesario para mezclar SQL relacional + consultas de grafo AGE). Más barato en complejidad que Prisma para este caso.

### 6.3 Datos (la decisión clave)
- **PostgreSQL + Apache AGE** (extensión de grafos sobre Postgres) — **una sola base de datos** para grafo + relacional. Evita mantener Neo4j aparte. Consultas openCypher cuando convenga.
- **pgvector** (misma Postgres) — embeddings para "¿quién sabe esto?" y búsqueda semántica del conocimiento.
- Proveedor gestionado barato: **Neon** o **Supabase** (free tier generoso, escala por uso). Supabase suma auth + storage + realtime en el mismo sitio, lo que reduce piezas.
- **Cloudflare R2** o **Supabase Storage** para media (R2 sin coste de egreso = más barato a escala).

> Nota de riesgo de stack: AGE no está en todos los Postgres gestionados. Si el proveedor elegido no lo soporta, alternativa pragmática: modelar el grafo en **tablas relacionales normales** (`nodes`, `edges`) — para grafos de tamaño PYME (cientos/miles de nodos) el rendimiento es de sobra y eliminas la dependencia de AGE. AGE aporta sobre todo consultas de caminos complejas; al principio puede no hacer falta.

### 6.4 IA
- **Claude (Anthropic API)** para extracción texto→grafo, generación de artefactos y el chat guiado. Modelo económico (Haiku/Sonnet) para extracción de alto volumen, modelo potente solo para generación de artefactos complejos. Routing económico = controlar coste de tokens.
- **Transcripción audio/vídeo:** Whisper (open source, self-host barato) o un endpoint gestionado de bajo coste.
- **OCR de imágenes/documentos:** Tesseract (gratis) o el propio modelo multimodal para casos difíciles.
- **Embeddings:** modelo de embeddings barato → pgvector.

### 6.5 Tiempo real y colaboración
- **Supabase Realtime** (si ya usas Supabase) o **Liveblocks** / **PartyKit** para colaboración en el canvas. Empezar con Realtime de Supabase para no añadir piezas.

### 6.6 Infra y operación
- **Vercel** para el front+API (free/pro barato).
- **Inngest** o colas simples para trabajos en segundo plano (transcribir, generar artefactos, recalcular métricas) — free tier suficiente al inicio.
- **Auth:** Supabase Auth o Auth.js. Enlaces mágicos sin contraseña para empleados (clave de la fricción mínima).

### 6.7 Resumen del stack
```
Next.js 15 · React · TypeScript · Tailwind · shadcn/ui · tldraw · tRPC · Drizzle
PostgreSQL (+AGE opcional) · pgvector · Supabase (DB+Auth+Storage+Realtime) o Neon+R2
Claude API · Whisper · Tesseract · Inngest · Vercel
```
Coste estimado en fase temprana: dominado por tokens de IA; infraestructura cercana a cero hasta tener clientes de pago.

---

## 9. Modelo de datos relacional (esqueleto)

```sql
-- Nodos (única verdad de datos)
nodes(id, company_id, type, name, attributes JSONB, criticality,
      archived BOOLEAN DEFAULT false, created_at, updated_at)

-- Aristas
edges(id, company_id, type, from_node_id, to_node_id, attributes JSONB,
      archived BOOLEAN DEFAULT false, created_at, updated_at)

-- Render del canvas (NO datos: solo posición/estilo)
node_layout(node_id, company_id, x, y, color, collapsed)

-- Misiones
missions(id, company_id, objective, target_node_id, priority, due_date,
         status, created_by, created_at)
mission_assignees(mission_id, person_id)

-- Aportaciones de conocimiento
contributions(id, mission_id, author_id, media_type, storage_url,
              transcript, ocr_text, created_at)

-- Artefactos generados
artifacts(id, type, content JSONB, linked_node_id, validation_state, created_at)
artifact_sources(artifact_id, contribution_id)

-- Log inmutable (append-only, nunca UPDATE/DELETE)
event_log(id, company_id, actor_id, event_type, payload JSONB, created_at)

-- Embeddings
node_embeddings(node_id, embedding vector(1536))

-- Roles y validación delegable (F13): el dueño de una empresa de 50 personas
-- no puede aprobar cada SOP; el rol validador se delega por unidad/dominio
memberships(user_id, company_id, role)  -- owner | validator | contributor | viewer
validation_scopes(user_id, company_id, domain)  -- qué dominios puede validar un validador
```

---

## 10. Plan de construcción por fases (alineado con tu roadmap)

| Fase | Entrega | Gate de salida |
|------|---------|----------------|
| F0 | Repo, esquema 6+7 (con `knowledge_type` y `confidence`), migraciones, CI | Esquema validado por tests de invariantes |
| F0.5 | **Onboarding por entrevista de IA (time-to-first-alarm)** | Primera alarma real en ≤10 min sin construir grafo a mano |
| F1 | Graph Service + grafo como verdad + `event_log` | CRUD de nodos/aristas con auditoría |
| F2 | Canvas (tldraw) renderizando el grafo (ya poblado por onboarding) | Mover/crear/borrar nodo escribe en grafo |
| F3 | Chat IA → operaciones de grafo | Extracción tipada validada contra esquema |
| F4 | Sincronización doble vía (canvas ↔ chat) | Editar por una vía aparece en la otra |
| F5 | Metrics Engine (bus factor, **confidence**, coverage, health) + **Timeline** | Métricas correctas sobre casos de prueba |
| F6 | Risk Engine (detección automática, ponderada por confianza) | Riesgos detectados = casos esperados |
| F7 | **Sistema de misiones** (composición, asignación) | Misión creada desde un riesgo |
| F8 | **Captura universal** (media + transcripción/OCR) | Aporte sube, se transcribe, se conecta |
| F9 | **Artifact Builder** (SOP/checklist/card/diagrama) | Artefacto generado y enlazado al nodo |
| F10 | Cierre del bucle: misión completada → riesgo baja | Recalculo verificado end-to-end |
| F11 | **Company Simulator** (¿y si se va X?) — motor completo | Impacto operativo/financiero/organizativo correcto |
| F12 | **AI Organizational Consultant** + Wiki viva + capa estratégica | Recomendaciones correctas; wiki generada desde el grafo |
| F12.5 | **Company Genome** (vistas de `knowledge_type` regla/valor/política) | Reglas no escritas capturadas como Knowledge, con bus factor |
| F13 | Hardening: auth, permisos, **rol validador delegable**, multi-tenant, UX | Listo para piloto real |

---

## 11. Plan de pruebas (TDD)

Filosofía: escribir la prueba antes que el código. El núcleo (modelo, métricas, riesgo, misiones) se desarrolla 100% test-first porque es donde un error es invisible y caro.

### 9.1 Niveles de prueba
- **Unitarias:** invariantes del modelo, fórmulas de métricas, validación de operaciones de IA.
- **Integración:** chat→grafo, canvas→grafo, misión→aporte→recalculo.
- **End-to-end:** el bucle completo de valor sobre la empresa de ejemplo (fábrica de perfume).
- **De propiedad (property-based):** generar grafos aleatorios válidos y verificar que las métricas nunca producen estados imposibles (ej. bus factor negativo).

### 9.2 Casos test-first del modelo (ejemplos)
```
TEST modelo_rechaza_arista_invalida:
  crear REQUIRES de Person→Knowledge  → debe FALLAR (REQUIRES sale de Process)

TEST ia_no_inventa_tipos:
  input "Pedro tiene buena relación con el banco"
  → operaciones deben usar Knowledge("relación bancaria"), no un tipo nuevo

TEST borrado_es_archivado:
  borrar un nodo → archived=true, sigue en event_log, no DELETE físico
```

### 9.3 Casos test-first de métricas
```
TEST bus_factor_experto_unico:
  Knowledge K con un solo Person MASTERS level=5, ninguno LEARNS≥3
  → bus_factor(K) == 1  → riesgo CRÍTICO

TEST bus_factor_sube_con_sustituto:
  añadir Person LEARNS level=3 sobre K
  → bus_factor(K) == 2  → riesgo baja a aceptable

TEST coverage:
  3 Knowledge críticos, 1 con bus_factor≥2
  → knowledge_coverage == 33%

TEST confidence_decae_con_antiguedad:
  Knowledge validado hace 2 años, sin uso reciente, 1 experto
  → confidence < Knowledge equivalente validado este mes con 3 expertos

TEST riesgo_pondera_confianza:
  dos Knowledge con bus_factor=1; uno confidence=22, otro confidence=90
  → el de confidence=22 produce Risk de mayor severidad
```

### 9.3bis Casos test-first del onboarding (time-to-first-alarm)
```
TEST onboarding_produce_alarma:
  simular respuestas de entrevista que describen un experto único
  → al cerrar la entrevista existe al menos 1 Risk crítico con nombre de persona
  → tiempo simulado de la sesión ≤ objetivo

TEST onboarding_captura_genome:
  respuesta "hay una regla que todos respetan pero nadie escribió: no muestra sin pago"
  → se crea Knowledge(knowledge_type=regla), no un tipo nuevo

### 9.4 Casos test-first del Risk Engine
```
TEST detecta_proceso_sin_respaldo:
  Process P REQUIRES Knowledge K, bus_factor(K)=1
  → se genera Risk(severity=alto, source=K)

TEST detecta_proveedor_unico:
  Asset(asset_type=proveedor) con un solo DEPENDS_ON entrante crítico
  → Risk generado
```

### 9.5 Casos test-first del Sistema de Misiones (el bloque nuevo)
```
TEST crear_mision_desde_riesgo:
  pulsar "Resolver" sobre Risk R
  → Mission con target_node_id = R.source, assignee = experto, status=open

TEST aporte_se_conecta_al_nodo:
  empleado sube vídeo a Mission M
  → Contribution creada, transcrita, propuesta de enlace a target_node

TEST artefacto_generado:
  Contribution con transcripción
  → Artifact(type=SOP) en borrador, linked_node_id correcto

TEST cierre_de_bucle_baja_riesgo:
  misión validada + Laura sube a LEARNS level=3
  → bus_factor del Knowledge sube a 2
  → Risk pasa a status=closed
  → Organizational Health sube
  (este es el test END-TO-END que prueba que el producto funciona)
```

### 9.6 Cobertura objetivo
- Núcleo (modelo, métricas, riesgo, misiones): cobertura alta y obligatoria, test-first.
- UI/canvas: pruebas de integración de los flujos críticos, no cobertura exhaustiva.
- IA de extracción: suite de casos de oro (input→operaciones esperadas) que actúa como test de regresión cada vez que cambia el prompt o el modelo.

---

## 12. Riesgos del proyecto y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Alcance gigante (20 motores) hunde la entrega | Construir solo el bucle de valor primero (F0–F10); el resto es expansión. **No lanzar como tres productos simultáneos:** Genome, Consultant y Simulator son fases del mismo producto, no productos hermanos. Tres a la vez = no entregar ninguno |
| **El empresario no dedica 20h a construir el grafo (riesgo nº1)** | Onboarding por entrevista de IA (F0.5): primera alarma real en ≤10 min, el grafo se construye como subproducto de responder preguntas, no como tarea previa |
| El empleado no aporta conocimiento | Fricción cero: enlace mágico, botones grandes, la IA hace las preguntas; el aporte se pide vía misión concreta, no "documenta todo" |
| El grafo y el canvas se desincronizan | Una única verdad; el canvas solo guarda layout; IA emite operaciones, no reescribe |
| Coste de tokens se dispara | Routing económico: modelo barato para extracción, potente solo para artefactos |
| AGE no disponible en el Postgres gestionado | Fallback a tablas `nodes`/`edges` relacionales; rendimiento sobrado a escala PYME |
| La IA inventa estructura organizativa | Toda operación es propuesta hasta confirmación humana (Human Controlled Truth) |

---

## 13. Definition of Done global

El producto v3 está terminado cuando, sobre una empresa real de piloto:
1. En la primera sesión de ~10 minutos, sin construir nada a mano, el empresario recibe su primera alarma crítica real (time-to-first-alarm).
2. Construye y refina su grafo hablando y/o arrastrando, indistintamente.
3. El sistema detecta sus riesgos críticos sin que él los busque, ponderados por confianza.
4. Puede lanzar una misión de documentación a un empleado desde un riesgo.
5. El empleado aporta conocimiento en cualquier formato con fricción mínima.
6. El aporte se transcribe, se convierte en artefacto y se conecta al nodo correcto.
7. Al completarse la misión, el riesgo baja de forma medible y verificable.
8. Las reglas no escritas y valores (Genome) quedan capturados como Knowledge, con su propio bus factor.
9. Puede generar diagramas y la wiki desde el grafo, sin escribirlos.
10. Puede simular el impacto de perder a una persona clave (operativo, financiero, organizativo).
11. La validación se delega: un validador por dominio aprueba sin saturar al dueño.
12. Todo queda registrado en un log inmutable y auditable, con timeline por nodo.
```

**Tagline:** *"Don't document knowledge. Make it survive."*
