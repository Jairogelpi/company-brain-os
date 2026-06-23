# Despliegue — prueba real en producción

Company Brain OS se despliega con `docker-compose.prod.yml`, que levanta tres
servicios: **postgres** (pgvector), un **migrate** de una sola pasada
(migraciones + seed) y la **app** Next.js (`next start`, salida `standalone`).

## Requisitos

- Un host con Docker + Docker Compose (VPS, o tu máquina con un dominio/puerto
  accesible).
- Tres secretos (el compose se niega a arrancar sin ellos).

## 1. Variables de entorno

Crea un `.env` **en la raíz del repo** (junto a `docker-compose.prod.yml`).
Está cubierto por `.gitignore`, no se commitea.

```bash
# Obligatorios
DB_PASSWORD=<contraseña-fuerte-de-postgres>
AUTH_SECRET=<openssl rand -base64 32>
SEED_PASSWORD=<contraseña-de-los-usuarios-demo>

# Opcionales
STORAGE_DRIVER=disk            # "disk" (def.) o "s3"
# TRANSCRIPTION_PROVIDER=...   # sin esto, la transcripción degrada a "unavailable"
# OPENCODE_API_KEY=...         # sin esto, los playbooks usan heurísticas (sin LLM)
```

Genera el secreto de auth con:
```bash
openssl rand -base64 32      # o:  cd web && npx auth secret
```

## 2. Arrancar

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Esto, en orden:
1. Arranca Postgres y espera a que esté `healthy`.
2. Corre `db:migrate` + `db:seed` (crea la empresa demo y 4 usuarios).
3. Arranca la app en el puerto **3000**.

Comprueba el estado:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

## 3. Entrar

Abre `http://<host>:3000`. Logins sembrados (contraseña = `SEED_PASSWORD`):

- `admin@companybrain.os`  (owner)
- `maria@companybrain.os`
- `pedro@companybrain.os`
- `laura@companybrain.os`

## 4. Recorrido de prueba sugerido

1. Login → dashboard (debe mostrar exposición €, riesgos).
2. `/capture` → responde la entrevista → **Confirm & save** → revisa `/people`.
3. `/inbox` → sube un CSV/TXT o pega texto → revisa propuestas → aprueba.
4. `/simulator` → marca una persona → mira el riesgo nuevo y el coste €.
5. `/succession` → elige persona + último día → genera playbook → guarda →
   transiciones de estado → Copy Markdown.

## Notas / limitaciones conocidas

- **Worker de transcripción:** arranca solo en boot (runtime Node). Sin
  `TRANSCRIPTION_PROVIDER` configurado, los jobs degradan a "unavailable" —
  no fallan, simplemente no transcriben. Para apagarlo en dev:
  `TRANSCRIPTION_WORKER_DISABLED=1`.
- **IA de playbooks:** sin `OPENCODE_API_KEY`, la sucesión usa heurísticas
  deterministas (sin enriquecimiento LLM).
- **tldraw** (`/graph`, `/canvas`): muestra marca de agua "get a license for
  production" hasta poner una licencia de tldraw. Cosmético, no bloquea.
- **HTTPS / dominio:** el compose expone HTTP en :3000. Para producción real,
  pon un reverse proxy (Caddy / Nginx / Traefik) con TLS delante. `AUTH_TRUST_HOST`
  ya está en `true` para funcionar detrás de proxy.
- **Subidas:** se guardan en el volumen `uploads`. Para S3/R2, pon
  `STORAGE_DRIVER=s3` + credenciales (`npm i @aws-sdk/client-s3` ya resuelto en
  build), ver `web/.env.example`.

## Parar / reiniciar

```bash
docker compose -f docker-compose.prod.yml down        # conserva volúmenes (datos)
docker compose -f docker-compose.prod.yml down -v     # BORRA datos y uploads
```
