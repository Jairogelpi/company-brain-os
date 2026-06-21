# Motor Universal de Entrevista Adaptativa

**Parte de:** Company Brain OS — fase F0.5 (Onboarding / Time-to-First-Alarm)
**Función:** un único motor de conversación que construye el grafo y produce la primera alarma para CUALQUIER empresa, sin guiones por sector.

---

## 1. El principio que lo hace universal

No se pregunta sobre el sector. Se pregunta sobre la **estructura de fragilidad**, que es idéntica en toda empresa:

- alguien indispensable (bus factor 1)
- un proceso sin respaldo
- una dependencia única (proveedor, cliente, máquina, conocimiento)
- una regla que todos siguen pero nadie escribió (Genome)

El sector solo cambia las **palabras** (fórmula vs. contrato vs. receta), nunca la **estructura**. Por eso un solo motor vale para la fábrica de perfume, el bufete y la panadería: la IA dirige por la estructura y deja que el vocabulario del sector emerja de las respuestas del dueño.

> Regla de oro: el guion es universal; el vocabulario es emergente.

---

## 2. Cómo dirige la conversación la IA

La entrevista NO es una lista fija de preguntas. Es una **máquina de estados de exploración** que persigue un objetivo: encontrar la primera fragilidad crítica lo antes posible.

### 2.1 Objetivo de la sesión
Llegar en ≤10 minutos a al menos una alarma real con nombre propio:
> "Si [Persona] falta, [consecuencia]: nadie más sabe [Knowledge]."

### 2.2 Las 5 sondas universales (en orden de impacto)
La IA siempre arranca por la sonda de mayor impacto y profundiza donde huele fragilidad:

```
S1  PERSONA CLAVE   → "¿Quién es la persona que si falta mañana tienes un problema serio?"
S2  CONOCIMIENTO    → "¿Qué hace exactamente que nadie más sepa hacer?"
S3  SUSTITUTO       → "Si se fuera, ¿quién es el segundo que más se acerca? ¿Cuánto se acerca?"
S4  PROCESO         → "¿Qué para la empresa si se rompe?"
S5  REGLA NO ESCRITA→ "¿Hay algo que todos respetan pero nadie tiene escrito?"  (Genome)
```

### 2.3 Regla de profundización (lo que la hace inteligente)
Tras cada respuesta, la IA decide entre **profundizar** o **ampliar**:

- Si la respuesta revela bus factor 1 (un solo nombre, sin sustituto) → **profundiza** ahí: "¿Está escrito en algún sitio? ¿Alguien lo ha visto hacerlo?" Está cerca de una alarma, va a por ella.
- Si la respuesta está cubierta (varias personas, documentado) → **amplía**: pasa a la siguiente sonda. No pierde tiempo donde no hay riesgo.

Esto es lo que sustituye al guion por sector: no preguntas predefinidas, sino una **política de hacia dónde llevar la conversación** según lo que va apareciendo.

---

## 3. Traducción de lenguaje a grafo (vocabulario emergente)

Cada respuesta se mapea al esquema universal 6+7. El sector vive en atributos, nunca en tipos:

| El dueño dice (sector) | La IA crea (universal) |
|------------------------|------------------------|
| "Pedro configura la llenadora" | Person(Pedro) —MASTERS lvl5→ Knowledge("configurar llenadora", domain=producción) |
| "Solo el socio firma los contratos grandes" (bufete) | Person(socio) —MASTERS→ Knowledge("criterio contratos", knowledge_type=regla) |
| "La masa madre la lleva siempre María" (panadería) | Person(María) —MASTERS→ Knowledge("masa madre", domain=producción) |
| "Nunca damos muestra sin pago" | Knowledge("no muestra sin pago", knowledge_type=regla) ← Genome |

La IA infiere el tipo por la *función* de lo dicho, no por palabras clave del sector. "Lo lleva siempre X" → experto único. "Nunca hacemos Y" → regla. "Sin Z no funciona" → dependencia.

---

## 4. Detección de la primera alarma (condición de éxito)

La sesión dispara su primer "wow" en cuanto el grafo en construcción cumple:

```
existe Knowledge K tal que:
   criticality(K) = alta            (lo dijo el dueño: "para la empresa")
   bus_factor(K) = 1                (un solo experto, sin sustituto ≥ nivel 3)
   documented(K) = false            (no está escrito)
→ generar Risk(severity=crítico)
→ devolverlo al dueño con nombre propio
```

Ese es el momento que justifica las 20 horas: el dueño ve un riesgo que no sabía que tenía, en menos de 10 minutos, sin haber construido nada.

---

## 5. Adaptación de tono y ritmo (no de contenido)

La IA adapta CÓMO pregunta, no QUÉ estructura busca:
- Detecta el sector por las primeras respuestas y usa su vocabulario al repreguntar (dice "la fórmula" si es perfumería, "el expediente" si es un bufete) → genera confianza.
- Ajusta el ritmo: si el dueño da respuestas ricas, profundiza; si da respuestas cortas, ofrece opciones ("¿es más bien producción, ventas o administración?").
- Nunca abruma: una pregunta por turno, lenguaje llano, cero jerga técnica.

---

## 6. Cierre de la entrevista

La sesión termina (no se eterniza) cuando se cumple lo primero de:
- Se han recorrido las 5 sondas y hay ≥1 alarma → muestra el mapa de riesgos inicial.
- El dueño quiere parar → guarda el grafo parcial, agenda continuar.
- Se alcanzan ~12–15 min → corta con valor en mano, propone seguir construyendo en el canvas (ya poblado).

Después del onboarding, la misma IA queda disponible para seguir ampliando el grafo por chat y para lanzar misiones. La entrevista no es un evento único: es el primer uso de un compañero permanente.

---

## 7. Tests test-first del motor

```
TEST arranca_por_mayor_impacto:
  nueva sesión → primera pregunta es S1 (persona clave), no una aleatoria

TEST profundiza_ante_fragilidad:
  respuesta = un solo nombre sin sustituto
  → siguiente pregunta indaga documentación/sustituto del MISMO nodo, no cambia de tema

TEST amplia_cuando_esta_cubierto:
  respuesta = "eso lo saben tres personas y está en un manual"
  → siguiente pregunta pasa a la sonda siguiente, no insiste

TEST vocabulario_emergente_no_cambia_estructura:
  inputs de perfumería, bufete y panadería que describen un experto único
  → los tres generan la MISMA estructura (Person—MASTERS→Knowledge, bus_factor=1)

TEST primera_alarma:
  secuencia de respuestas que describe experto único no documentado en proceso crítico
  → se genera Risk crítico con nombre de persona antes del cierre

TEST no_inventa_tipos:
  "tenemos una forma especial de tratar al cliente VIP"
  → Knowledge(knowledge_type=regla|conocimiento), nunca un tipo nuevo
```

---

## 8. Por qué esto es el foso defensivo

Cualquiera puede copiar un canvas o un grafo. Lo difícil de copiar es un motor de entrevista que, sin guiones, lleve a cualquier empresario del mundo desde "no sé por dónde empezar" hasta "no sabía que tenía este riesgo" en 10 minutes. El valor no está en las preguntas —están aquí escritas— sino en la **política de profundización** afinada con miles de conversaciones reales: saber cuándo apretar y cuándo soltar. Eso mejora con cada empresa que entra y no se puede clonar mirando la pantalla.
