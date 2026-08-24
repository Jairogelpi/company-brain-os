# Production deployment

`docker-compose.prod.yml` runs PostgreSQL/pgvector, one-shot migrations, one-shot least-privilege role provisioning, ClamAV, the Next.js application and a separate worker. Production never runs the demo seed.

## Requirements

- Docker Engine and Docker Compose.
- A TLS reverse proxy and domain.
- Persistent encrypted storage or an S3-compatible bucket.
- URL-safe secrets. Avoid reserved URL characters in database passwords because Compose constructs database URLs.

## 1. Environment

Create `.env` beside `docker-compose.prod.yml`:

```bash
DB_PASSWORD=<openssl rand -hex 32>
APP_DB_PASSWORD=<openssl rand -hex 32>
AUTH_SECRET=<openssl rand -base64 48>
APP_BASE_URL=https://brain.example.com

# Optional providers
STORAGE_DRIVER=disk              # use s3 for multi-host production
TRANSCRIPTION_PROVIDER=none      # whisper-cpp, cloud or none
NOTIFICATION_EMAIL_WEBHOOK_URL=https://mailer.example.com/company-brain
NOTIFICATION_EMAIL_WEBHOOK_TOKEN=<provider token>
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

The database owner is used only by migrations and role provisioning. The app and worker connect as `company_brain_app`, which cannot bypass RLS.

For S3-compatible storage, also set `S3_BUCKET`, `S3_REGION`, optional `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

## 2. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 migrate provision-app-role clamav app worker
```

ClamAV may need several minutes on first boot to download signatures. The app waits for it to become healthy; uploads then fail closed if scanning becomes unavailable.

## 3. First organization

Open the TLS URL and register the first owner. No company, user or sample graph is created automatically. `npm run db:seed` is strictly a local demonstration command.

## 4. Release verification

Before exposing the deployment:

1. Confirm the app uses `company_brain_app`, not `postgres`.
2. Run the smoke sequence in [the production runbook](docs/operations/PRODUCTION_RUNBOOK.md).
3. Verify a normal upload succeeds and the EICAR test signature is rejected in a controlled environment.
4. Verify backup/restore for both database and object storage.
5. Map each assessor/reviewer login to a distinct canonical Person in Settings and verify self-assessment/review is rejected.
6. Assign a mission and confirm the in-app notification plus provider-acknowledged email delivery.
7. Confirm HTTPS, secure cookies, request-size limits and security headers at the proxy.

## 5. Operations

```bash
docker compose -f docker-compose.prod.yml logs -f app worker
docker compose -f docker-compose.prod.yml restart app worker
docker compose -f docker-compose.prod.yml down       # preserves volumes
```

`docker compose ... down -v` permanently deletes database, upload and antivirus volumes; use it only for an intentionally disposable environment.

See [PRODUCTION_RUNBOOK.md](docs/operations/PRODUCTION_RUNBOOK.md) for backup, restore, incident response and rollback.
