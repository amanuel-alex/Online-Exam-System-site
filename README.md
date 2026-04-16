# Online Exam System Site

[![Build](https://img.shields.io/badge/build-not%20configured-lightgrey?logo=githubactions&logoColor=white)](https://github.com/amanuel-alex/Online-Exam-System-site/actions)
[![License](https://img.shields.io/badge/license-no%20license%20specified-red)](#license)
[![Last Commit](https://img.shields.io/github/last-commit/amanuel-alex/Online-Exam-System-site)](https://github.com/amanuel-alex/Online-Exam-System-site/commits)

A backend platform for managing secure, role-based online examinations across organizations (schools, universities, and similar institutions). The system provides workflows for exam authoring, scheduling, delivery, attempt tracking, grading, analytics, and auditability.

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [High-Level Architecture](#high-level-architecture)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Run Locally](#run-locally)
  - [Build for Production](#build-for-production)
  - [Deployment Notes](#deployment-notes)
- [Usage Guide](#usage-guide)
  - [Admin / Examiner Flow](#admin--examiner-flow)
  - [Student / Teacher Flow](#student--teacher-flow)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

## Project Overview

The Online Exam System Site is a NestJS-based API service designed for large-scale exam operations. It supports multi-tenant organizations, role-based authorization, exam lifecycle management, proctoring events, grading workflows, and reporting.

## Key Features

- Role-based access control (System Admin, Org Admin, Teacher, Examiner, Student)
- Authentication with JWT access/refresh token flow
- Multi-tenant organization model
- Question bank with versioning and metadata
- Exam creation, scheduling, and secure attempt lifecycle
- Auto and manual grading workflows with result release
- Audit logs and analytics endpoints
- File upload support (local storage with S3-ready abstractions)
- Caching and queue abstractions for scale-ready architecture

## Tech Stack

- **Runtime:** Node.js
- **Backend Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth/Security:** JWT, guards, permissions, helmet, throttling
- **Storage:** Local uploads (`/uploads`) with S3 integration points
- **Containerization (local DB):** Docker Compose

## High-Level Architecture

```text
Clients (Admin/Teacher/Student)
          |
          v
   NestJS API (Controllers + Guards + Services)
          |
          +--> Auth / RBAC / Multi-tenant enforcement
          +--> Exam, Question, Attempt, Grading modules
          +--> Analytics + Audit logging
          +--> File handling (Local/S3 abstraction)
          +--> Cache + Queue abstractions
          |
          v
   Prisma ORM -> PostgreSQL
```

## Screenshots

> No screenshots are currently included in the repository. Add UI/API screenshots when available.

- `docs/screenshots/admin-dashboard.png` *(placeholder)*
- `docs/screenshots/exam-session-management.png` *(placeholder)*
- `docs/screenshots/student-attempt-flow.png` *(placeholder)*

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 15+ (or Docker)

### Installation

```bash
git clone https://github.com/amanuel-alex/Online-Exam-System-site.git
cd Online-Exam-System-site
npm install
```

### Configuration

Create a local environment file from the example:

```bash
cp .env.example .env
```

Set the required variables (adjust values per environment):

```env
DATABASE_URL=postgresql://postgres:2123@localhost:5432/examSystem
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
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

### Run Locally

Start PostgreSQL with Docker (optional):

```bash
docker compose up -d
```

Then run your preferred development start command (according to your local scripts/workflow).

### Build for Production

Build commands are not currently defined in the root `package.json`. Add/standardize build scripts before production packaging.

### Deployment Notes

- Configure production-grade secrets and database credentials.
- Set `NODE_ENV=production` and tighten CORS origin values.
- Use managed PostgreSQL backups and monitoring.
- See `docs/disaster_recovery_plan.md` for DR/HA strategy guidance.

## Usage Guide

### Admin / Examiner Flow

1. Register/login and obtain an access token.
2. Create organizations and users, assign roles/permissions.
3. Build and version question banks.
4. Create exams, configure rules, and schedule sessions.
5. Monitor attempts, run grading (auto/manual), and release results.
6. Review analytics and audit logs.

### Student / Teacher Flow

1. Authenticate and access assigned organization context.
2. View available exams/sessions.
3. Start an attempt, save answers, and submit.
4. Track remaining time and attempt status.
5. View released results and related notifications.

## Project Structure

```text
.
├── docs/                   # Operational and architecture-related docs
├── prisma/                 # Prisma schema, migrations, seed scripts
├── scripts/                # Utility scripts (e.g., stress testing)
├── src/
│   ├── common/             # Shared guards, decorators, filters, interceptors
│   ├── modules/            # Domain modules (auth, exam, grading, users, etc.)
│   ├── prisma/             # Prisma module/service wiring
│   ├── app.module.ts       # Root module
│   └── main.ts             # Application bootstrap
├── test/                   # E2E test scaffolding
├── uploads/                # Local uploaded assets
├── docker-compose.yml      # Local PostgreSQL service
└── README.md
```

## Contributing

Contributions are welcome. Please:

1. Fork the repository and create a focused feature branch.
2. Keep changes small and well-scoped.
3. Follow existing coding conventions.
4. Add or update tests when behavior changes.
5. Open a pull request with a clear summary and rationale.

## Code of Conduct

Please contribute respectfully and constructively. A formal Code of Conduct file is not currently present; adding one (for example, Contributor Covenant) is recommended.

## License

**No license specified.**

A `LICENSE` file is not present in this repository. Add an explicit license to define permitted usage and contribution terms.
