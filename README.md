# Online Exam System Site

[![GitHub last commit](https://img.shields.io/github/last-commit/amanuel-alex/Online-Exam-System-site)](https://github.com/amanuel-alex/Online-Exam-System-site/commits)
[![NestJS](https://img.shields.io/badge/NestJS-API%20Platform-ea2845?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

Professional backend platform for secure, role-based online examinations. The project is built with NestJS, Prisma, and PostgreSQL and is organized for exam lifecycle management, authentication, analytics, grading, auditability, and future scaling.

## Overview

This repository powers the API layer of an online examination system. It is designed for institutions that need controlled access, reliable exam delivery, and strong operational visibility.

### What it handles

- Authentication and authorization with JWT-based access and refresh token flows
- Role-based access control for system admins, organization admins, teachers, examiners, and students
- Question bank and versioning workflows
- Exam scheduling, attempt lifecycle, grading, and result release
- Audit logging, analytics, notifications, and proctoring support
- File upload handling with local storage and S3-ready integration points

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | NestJS |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Security | JWT, guards, validation pipes, Helmet, throttling |
| Local file storage | `uploads/` |
| Dev tooling | Docker Compose, ESLint, Prettier, Jest |

## Why This Project Is Strong

- Clear separation between common infrastructure and domain modules
- Modern NestJS security posture with validation, CORS, and throttling configured in the bootstrap
- Prisma schema already models organizations, users, exams, questions, versions, sessions, attempts, and related audit data
- Repository structure supports both the current API and a future split into API and web apps

## Folder Structure

```text
.
├── apps/
│   ├── api/                 # Reserved for a future dedicated API app split
│   └── web/                 # Reserved for a future frontend app split
├── docs/
│   └── disaster_recovery_plan.md
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── scripts/
│   └── stress-test.ts
├── src/
│   ├── common/              # Shared cache, guards, decorators, filters, queue, interceptors
│   ├── modules/             # Feature modules such as auth, users, exam, grading, analytics
│   ├── prisma/              # Prisma module and service wiring
│   ├── app.module.ts        # Root application module
│   └── main.ts              # Application bootstrap and global configuration
├── test/                    # End-to-end test setup
├── uploads/                 # Local uploaded assets served by the API
├── docker-compose.yml       # Local PostgreSQL container configuration
├── nest-cli.json            # Nest CLI configuration
└── README.md
```

## Clone and Install

```bash
git clone https://github.com/amanuel-alex/Online-Exam-System-site.git
cd Online-Exam-System-site
npm install
```

## Configuration

The repository includes an empty `.env.example` file, so create a local `.env` file and add the values your environment needs.

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Recommended variables:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/examSystem
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me
AUDIT_SECRET=change-me
RESULT_SECRET=change-me
CERTIFICATE_SECRET=change-me
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_PUBLIC_URL=https://your-bucket.s3.amazonaws.com
```

For production, generate strong secret values and do not reuse development credentials.

## Run Locally

1. Start PostgreSQL with Docker:

```bash
docker compose up -d
```

2. Generate Prisma client and apply the schema:

```bash
npx prisma generate
npx prisma migrate dev
```

3. Start the API in development mode:

```bash
npx nest start --watch
```

The API is exposed under the global prefix `api` and URI versioning is enabled, so routes follow the pattern `/api/v1/...`.

## Build for Production

```bash
npx nest build
node dist/main.js
```

## Recommended Workflow

1. Keep PostgreSQL, Prisma, and NestJS versions aligned before making large schema changes.
2. Run `npx prisma migrate dev` early and often during feature development.
3. Use `docker compose up -d` for local database consistency across contributors.
4. Add tests for new domain logic, especially auth, permissions, and exam state transitions.
5. Treat secrets and database credentials as environment-specific values, not repository defaults.

## Operational Notes

- Security middleware is already configured in the bootstrap with Helmet, CORS, validation, cookie parsing, and rate limiting.
- Uploaded files are served from `uploads/`, so that directory should be treated as persistent application storage.
- The repository includes `docs/disaster_recovery_plan.md` for disaster recovery and availability planning.

## Contribution Guide

If you want to contribute:

1. Fork the repository and create a focused branch.
2. Keep changes scoped to one concern whenever possible.
3. Update tests or add new ones when behavior changes.
4. Write clear commit messages and a concise pull request summary.

## License

The package metadata is set to MIT, but the repository does not currently include a `LICENSE` file. If MIT is the intended license, add the file so the terms are explicit and publishable.
