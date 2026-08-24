# Company Brain OS

> Operational continuity intelligence: detect concentrated knowledge risk, transfer capability, and prove the dependency went down.

[![CI](https://github.com/Jairogelpi/company-brain-os/actions/workflows/ci.yml/badge.svg)](https://github.com/Jairogelpi/company-brain-os/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-149ECA?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%7C%20RLS%20%7C%20pgvector-336791?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-production-2496ED?logo=docker)](https://www.docker.com/)

Company Brain OS maps critical knowledge, processes, systems and external relationships; derives explainable continuity risks; and turns each exposure into an evidence-backed mitigation mission. It is designed for organizations where operational knowledge is concentrated in a small number of people.

**Start here:** [Product contract](docs/product/COMPANY_BRAIN_OS_V4.md) · [Canonical demo](docs/demo/PEDRO_LAURA.md) · [Architecture](docs/architecture/CANONICAL_LEDGER.md) · [Security](docs/security/SAAS_SECURITY.md) · [Installation](#installation-and-setup) · [Documentation map](docs/README.md)

## Why it is different

Company Brain OS does not treat a document as proof that a dependency has been removed. A person-dependency risk only closes when the system can trace approved facts, required competency, access, evidence and independent review.

| Layer | Guarantee |
| --- | --- |
| Canonical truth | Approved assertion/evidence ledger; AI cannot approve facts |
| Read model | Deterministic, rebuildable graph with provenance |
| Risk engine | Versioned and explainable; exact facts and rules are retained |
| Mitigation | Mission workflow with artifact, competency, access and evidence checks |
| Transfer proof | Independent approval; self-review is rejected |
| Multi-tenancy | Organization-scoped RBAC, PostgreSQL RLS and tenant foreign keys |
| Production | Least-privilege DB role, separate worker, ClamAV, Docker and GHCR |

## Product loop

```text
Interview / import
       |
       v
Human review
       |
       v
Approved assertion ledger
       |
       v
Deterministic graph projection
       |
       v
Explainable risk
       |
       v
Mitigation mission
       |
       v
Capture + validate artifact
       |
       v
Assess competency + access + evidence
       |
       v
Independent approval
       |
       +-------------------------------> Approved assertion ledger
```

The ledger is canonical; the graph is a rebuildable read model. Human approval is required before proposed facts become canonical truth.

## Canonical executable proof: Pedro → Laura

The acceptance journey proves four product invariants:

1. Pedro starts as the only expert and the risk cites approved canonical assertions.
2. Approving a procedure removes the documentation gap, but does **not** falsely remove the person dependency.
3. Laura only becomes a valid backup after competency ≥3, required access, evidence and independent approval exist.
4. The mitigation closes, risk is recalculated, and repeated graph rebuilds produce the same hash.

```bash
cd web
npm ci
npm run test:e2e
```

Read the scenario and expected evidence in [docs/demo/PEDRO_LAURA.md](docs/demo/PEDRO_LAURA.md).

## What is implemented

- Adaptive Spanish/English continuity capture with deterministic fallback when AI is unavailable.
- Human Review Inbox: AI and imports propose; they never approve canonical truth.
- Governed assertion/evidence ledger; approved claims are versioned instead of silently overwritten.
- Deterministic graph projection with provenance on every node and relationship.
- Explainable, versioned risks with exact input facts and assertion references.
- Mitigation missions with contribution, artifact review and verified transfer.
- Non-destructive simulator, succession playbooks, knowledge assistant and executive metrics.
- Organization-scoped RBAC, PostgreSQL RLS, composite tenant foreign keys and non-owner production DB role.
- Expiring workspace invitations with hashed one-time tokens and durable delivery.
- Canonical User→Person mapping with explicit protections against self-assessment and self-review.
- Tenant-partitioned uploads, magic-byte validation, SHA-256 hashes, ClamAV scanning and distributed rate limiting.
- Separate production worker for transcription, proposal ingestion and durable notification delivery.

The accepted product contract is [Company Brain OS v4](docs/product/COMPANY_BRAIN_OS_V4.md).

## Architecture

| Concern | Implementation |
| --- | --- |
| Application | Next.js 16.3.2, React 19.2, strict TypeScript |
| Canonical truth | PostgreSQL assertion/evidence ledger |
| Read model | Deterministic nodes/edges projection |
| Isolation | Organization context, RLS, tenant FKs, RBAC/ABAC |
| Storage | Disk or S3-compatible object storage with tenant partitions |
| Upload security | Allow-list, signatures, ClamAV, hashes and safe disposition |
| Async work | Separate worker with durable PostgreSQL jobs/outbox and bounded retries |
| Delivery | Docker Compose, GitHub Actions and GHCR |

The graph is disposable. Rejected, expired, superseded and archived assertions cannot appear in it. See [Canonical Ledger Architecture](docs/architecture/CANONICAL_LEDGER.md).

# Installation and setup

Choose the path that matches how you want to run the project.

| Path | Best for | What you install locally |
| --- | --- | --- |
| **A. Full Docker Compose** | Fastest production-like setup | Git + Docker |
| **B. Fully local, no Docker** | Native development | Git + Node.js 22+ + npm 10+ + PostgreSQL 16 + pgvector |
| **C. Hybrid** | Recommended developer setup | Git + Node.js 22+ + npm 10+ + Docker; PostgreSQL runs in Docker |

All three paths end with the app at `http://localhost:3000`.

## A. Full Docker Compose

This is the shortest production-like path. The application, PostgreSQL/pgvector, migrations, least-privilege database role, ClamAV and worker all run in containers. You do **not** need Node.js or PostgreSQL installed on the host.

### 1. Prerequisites

- Git
- Docker Engine + Docker Compose, or Docker Desktop on Windows/macOS

Verify:

```bash
git --version
docker --version
docker compose version
```

### 2. Clone the repository

```bash
git clone https://github.com/Jairogelpi/company-brain-os.git
cd company-brain-os
```

### 3. Create the root `.env`

`docker-compose.prod.yml` requires four values before it can start:

```dotenv
DB_PASSWORD=<url-safe-random-secret>
APP_DB_PASSWORD=<different-url-safe-random-secret>
AUTH_SECRET=<different-random-secret>
APP_BASE_URL=http://localhost:3000

# Optional
STORAGE_DRIVER=disk
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

Use URL-safe secrets for the database passwords because Compose builds PostgreSQL URLs from them.

macOS/Linux secret example:

```bash
openssl rand -hex 32
```

Run it three times and use different values for `DB_PASSWORD`, `APP_DB_PASSWORD` and `AUTH_SECRET`.

Windows PowerShell secret example:

```powershell
function New-HexSecret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  ([Convert]::ToHexString($bytes)).ToLower()
}
New-HexSecret
```

Run `New-HexSecret` three times and save the values in `.env` at the repository root.

### 4. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The first boot can take longer because ClamAV downloads signatures before the app is considered healthy.

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
```

Inspect startup logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 migrate provision-app-role clamav app worker
```

### 5. First use

Open:

```text
http://localhost:3000
```

Register the first owner through the application. The production Compose path intentionally does **not** seed demo tenants or demo users.

### 6. Stop, restart and reset

Stop while preserving database/uploads:

```bash
docker compose -f docker-compose.prod.yml down
```

Restart app and worker:

```bash
docker compose -f docker-compose.prod.yml restart app worker
```

Follow live logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app worker
```

Destroy the disposable local environment completely:

```bash
docker compose -f docker-compose.prod.yml down -v
```

**Warning:** `down -v` permanently deletes PostgreSQL data, uploads and ClamAV volumes.

For an internet-facing deployment, do not expose this local configuration directly. Follow [DEPLOY.md](DEPLOY.md) for TLS, real domain, persistent storage/S3, backup/restore and production verification.

## B. Fully local setup — no Docker

Use this path when you want Node.js and PostgreSQL to run directly on your machine.

### 1. Prerequisites

- Git
- Node.js 22+
- npm 10+
- PostgreSQL 16
- pgvector installed for that PostgreSQL instance

Verify:

```bash
git --version
node --version
npm --version
psql --version
```

Install PostgreSQL 16 and pgvector using the packages appropriate for your operating system, then make sure the PostgreSQL service is running.

### 2. Clone and install dependencies

```bash
git clone https://github.com/Jairogelpi/company-brain-os.git
cd company-brain-os/web
npm ci
```

### 3. Create the database and enable pgvector

From a PostgreSQL administrator account:

```bash
psql -U postgres -c "CREATE DATABASE company_brain_os;"
psql -U postgres -d company_brain_os -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

If the database already exists, PostgreSQL will reject the first command; that is expected. The extension command is idempotent.

### 4. Create local environment configuration

macOS/Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

At minimum, set these values in `web/.env.local`:

```dotenv
DATABASE_URL=postgres://postgres:<your-postgres-password>@localhost:5432/company_brain_os
AUTH_SECRET=<random-secret>
AUTH_TRUST_HOST=true
SEED_PASSWORD=<demo-login-password>
STORAGE_DRIVER=disk
STORAGE_DIR=./uploads
MALWARE_SCAN_MODE=basic
```

`GEMINI_API_KEY` is optional. Without it, capture falls back to the fixed/deterministic interview path.

Important: Next.js reads `.env.local` automatically when the app starts. The standalone migration and seed scripts use the process environment, so if your PostgreSQL URL differs from the repository's default `postgres://postgres:postgres@localhost:5432/company_brain_os`, export it before running those scripts.

macOS/Linux:

```bash
export DATABASE_URL="postgres://postgres:<your-postgres-password>@localhost:5432/company_brain_os"
export SEED_PASSWORD="<demo-login-password>"
```

Windows PowerShell:

```powershell
$env:DATABASE_URL="postgres://postgres:<your-postgres-password>@localhost:5432/company_brain_os"
$env:SEED_PASSWORD="<demo-login-password>"
```

### 5. Migrate, seed and start

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:3000
```

The local seed creates these demo logins, all using `SEED_PASSWORD` (or `demo1234` if you deliberately leave it unset):

| User | Email | Role |
| --- | --- | --- |
| Admin | `admin@companybrain.os` | owner |
| María Validadora | `maria@companybrain.os` | validator |
| Pedro | `pedro@companybrain.os` | contributor |
| Laura | `laura@companybrain.os` | viewer |

Never use the demo seed or its default password in production.

## C. Hybrid development — app local, PostgreSQL in Docker

This is the recommended development path if you want hot local Next.js development without installing PostgreSQL/pgvector on your host.

### 1. Prerequisites

- Git
- Node.js 22+
- npm 10+
- Docker / Docker Desktop

### 2. Clone and install

```bash
git clone https://github.com/Jairogelpi/company-brain-os.git
cd company-brain-os/web
npm ci
```

### 3. Start PostgreSQL/pgvector only

macOS/Linux:

```bash
docker run --name company-brain-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=company_brain_os \
  -p 5432:5432 \
  -d pgvector/pgvector:pg16
```

Windows PowerShell:

```powershell
docker run --name company-brain-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=company_brain_os `
  -p 5432:5432 `
  -d pgvector/pgvector:pg16
```

If the container already exists after the first run:

```bash
docker start company-brain-postgres
```

### 4. Create `.env.local`

macOS/Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

The default database URL in `.env.example` already matches this container:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/company_brain_os
AUTH_SECRET=<random-local-secret>
AUTH_TRUST_HOST=true
SEED_PASSWORD=<demo-login-password>
STORAGE_DRIVER=disk
STORAGE_DIR=./uploads
MALWARE_SCAN_MODE=basic
```

### 5. Migrate, seed and run

macOS/Linux:

```bash
export SEED_PASSWORD="<demo-login-password>"
npm run db:migrate
npm run db:seed
npm run dev
```

Windows PowerShell:

```powershell
$env:SEED_PASSWORD="<demo-login-password>"
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000` and sign in using one of the demo accounts listed in the previous section.

## Verify the repository locally

With PostgreSQL available and the expected environment configured, reproduce the repository-controlled quality gate with:

```bash
cd web
npm ci
npm run verify:all
```

That command runs migrations, explicit demo/test seed, the full test suite, Pedro/Laura E2E, critical coverage, PostgreSQL tenant-isolation tests, TypeScript, the production build and the production dependency vulnerability gate.

For individual gates:

```bash
npm test -- --run
npm run test:e2e
npm run test:critical
npm run test:integration
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high
```

The permanent CI definition remains the source of truth: [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Troubleshooting setup

### Port 5432 is already in use

Check whether PostgreSQL or another container is already using it.

Docker:

```bash
docker ps
```

If you already have a suitable local PostgreSQL instance, use path B instead of starting another container.

### Port 3000 is already in use

Stop the process using port 3000, or run Next.js on another port:

```bash
npm run dev -- -p 3001
```

### `company-brain-postgres` already exists

Start the existing container:

```bash
docker start company-brain-postgres
```

Or remove a disposable one and recreate it:

```bash
docker rm -f company-brain-postgres
```

### PostgreSQL connection refused

Confirm the service/container is running and that `DATABASE_URL` points to the correct host, port, database, user and password.

Docker hybrid path:

```bash
docker logs company-brain-postgres
```

### pgvector / `vector` extension missing

For a native PostgreSQL installation, verify pgvector is installed and run:

```bash
psql -U postgres -d company_brain_os -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

The Docker image `pgvector/pgvector:pg16` already includes pgvector.

### Docker Compose reports a missing variable

The full Docker path requires these values in the repository-root `.env`:

```text
DB_PASSWORD
APP_DB_PASSWORD
AUTH_SECRET
APP_BASE_URL
```

### Clean local demo database

For the hybrid single-container path, deleting the container removes its database because no host volume is attached:

```bash
docker rm -f company-brain-postgres
```

Then recreate it using the command in path C.

For full Docker Compose, `docker compose -f docker-compose.prod.yml down` preserves named volumes; `down -v` deletes them.

## Production deployment

The full Docker Compose path above is suitable for a production-like local environment. A real production deployment additionally requires TLS, a real domain, backup/restore, durable storage or S3, secrets management and operational verification.

Follow [DEPLOY.md](DEPLOY.md) and [docs/operations/PRODUCTION_RUNBOOK.md](docs/operations/PRODUCTION_RUNBOOK.md) before exposing Company Brain OS publicly.

## Evidence status

This repository deliberately separates engineering proof from external outcome claims.

| Status | Evidence |
| --- | --- |
| Implemented | Ledger, deterministic graph, risk engine, missions, transfer verification, multi-tenancy, production stack |
| Repository-verified | Automated tests, canonical E2E, critical coverage, PostgreSQL isolation, typecheck, production build, dependency audit |
| Requires external validation | Paid pilot, customer baseline/outcomes, timed restore drill, counsel-approved agreements, independent pentest/certification |

Repository tests are evidence that the implementation behaves as specified. They are **not** evidence that a customer achieved a commercial outcome. See [Release Scorecard](docs/RELEASE_SCORECARD.md) and the open external-validation gate in the issue tracker.

## Documentation

The complete reading map is in [docs/README.md](docs/README.md). Key paths:

- [Product contract](docs/product/COMPANY_BRAIN_OS_V4.md)
- [Canonical ledger architecture](docs/architecture/CANONICAL_LEDGER.md)
- [Pedro → Laura executable demonstration](docs/demo/PEDRO_LAURA.md)
- [SaaS security model](docs/security/SAAS_SECURITY.md)
- [Production runbook](docs/operations/PRODUCTION_RUNBOOK.md)
- [Release scorecard](docs/RELEASE_SCORECARD.md)
- [Portfolio case study](docs/portfolio/CASE_STUDY.md)
- [Pilot offer and measurement plan](docs/commercial/PILOT_OFFER.md)
- [One-page offer and sales playbook](docs/commercial/ONE_PAGE.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Responsible product boundary

Company Brain OS measures operational dependency, not employee productivity, loyalty or performance. AI may extract, propose, explain and draft; it cannot approve facts, close risks, change permissions or make employment decisions.

## License

Proprietary software. All rights reserved unless otherwise stated in a written agreement.
