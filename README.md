# Company Brain OS

> The living knowledge graph for resilient companies.

[![CI](https://github.com/Jairogelpi/company-brain-os/actions/workflows/ci.yml/badge.svg)](https://github.com/Jairogelpi/company-brain-os/actions/workflows/ci.yml)
[![CD](https://github.com/Jairogelpi/company-brain-os/actions/workflows/cd.yml/badge.svg)](https://github.com/Jairogelpi/company-brain-os/actions/workflows/cd.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?logo=postgresql)](https://www.postgresql.org/)

Company Brain OS turns the hidden knowledge of a company into an actionable operating system. It maps people, knowledge, processes, assets and risks in a living graph, detects organizational fragility and turns each risk into a concrete documentation or succession mission.

## Why it exists

Most companies do not fail because knowledge is missing. They fail because critical knowledge is trapped in one person, one inbox or one undocumented habit. Company Brain OS makes that exposure visible and helps teams reduce it over time.

## Core capabilities

- AI-assisted company interview that surfaces the first operational alarm quickly.
- Living organizational graph with people, knowledge, processes, assets and risks.
- Real-time resilience metrics: bus factor, coverage, dependency and exposure.
- Capture workflows for text, files, audio, video and operational know-how.
- Missions that turn a risk into an owned, time-bound action.
- Succession playbooks and company simulation before a critical person or process is lost.
- Bilingual interface in English and Spanish.

## Product loop

```text
Interview → detect fragility → assign mission → capture knowledge
     ↑                                           ↓
     └────────────── measure resilience ────────┘
```

## Architecture

| Layer | Technology |
| --- | --- |
| Application | Next.js 15, React 19, TypeScript |
| UI | Tailwind CSS, Radix UI, tldraw |
| Data | PostgreSQL, pgvector, Drizzle ORM |
| Authentication | Auth.js |
| Quality | Vitest, TypeScript strict mode |
| Delivery | Docker, GitHub Actions, GitHub Container Registry |

## Quick start

### Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 16 with the `vector` extension, or Docker Desktop

### Local development

```bash
cd web
npm ci
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a complete production-like environment, use the Docker Compose setup described in [DEPLOY.md](DEPLOY.md).

## Quality checks

```bash
cd web
npm run typecheck
npm test -- --run
npm run build
```

Every pull request runs type checking, database migrations, seed verification, tests and a production build. Every push to the default branch builds and publishes a production-ready container image to GHCR.

## Deployment

The production stack is containerized and includes PostgreSQL, migrations, seed data and the Next.js standalone server.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

See [DEPLOY.md](DEPLOY.md) for environment variables, demo accounts, reverse proxy guidance and operational notes.

## Documentation

- [Technical specification](COMPANY_BRAIN_OS_SPEC.md)
- [Deployment guide](DEPLOY.md)
- [Universal interview engine](MOTOR_ENTREVISTA_UNIVERSAL.md)

## Security

Never commit `.env` files, credentials or production data. See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Status

This project is under active development. The architecture and product direction are documented so contributors can understand both the implementation and the reason behind it.

## License

Proprietary software. All rights reserved unless otherwise stated in a written agreement.
