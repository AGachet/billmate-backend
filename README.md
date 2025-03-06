# BillMate Backend

**BillMate Backend** is an open-source **TypeScript** backend built with **NestJS**, **Prisma**, and **PostgreSQL**. It's a part of the SaaS Billmate which provides a powerful solution for managing
clients, invoices, and financial tasks.

## ✨ Features

### 🔐 Security & Authentication

- Robust JWT-based authentication system (access + refresh tokens)
- Secure cookie management with httpOnly (frontend-friendly)
- Two-step password reset process
- Multiple session management with token handling
- Application health monitoring

### 👥 Role & Permission Management

- Customizable user roles (admin, user, etc.)
- Feature-based module activation system
- Granular permissions (per module and role)
- Permission verification middleware
- Fine-grained resource access control

### 🧪 Quality & Testing

- Comprehensive unit tests with Jest
- E2E testing with Jest & Supertest
- On-the-fly database dockerization for E2E tests (local & CI)
- Commit message verification & tests via Husky
- Automated linting and formatting
- Automated type checking

### 📝 Architecture & CI/CD

- Modular design with NestJS (microservices-ready)
- Dockerization (frontend-friendly)
- CI/CD with test execution on Pull Requests
- Automated database setup (scripts + Prisma)
- Database updates management with Prisma Migrations
- Centralized logging (structured, configurable log levels)

## 📌 Installation & Setup

### 1️⃣ Prerequisites

Ensure you have the following installed on your system:

- **Node.js** (see `.nvmrc` for version)
- **NPM** (or Yarn)

### 2️⃣ Install the Project

Clone the repository and install dependencies:

```sh
git clone https://github.com/agachet/billmate-backend.git
cd billmate-backend
npm install
```

During installation, the following command ensures database update scripts are executable:

```sh
chmod +x ./scripts/update-db-dev.sh ./scripts/update-db-prod.sh ./init-test-db.sh
```

### 3️⃣ Environment Configuration

Create a **.env** file based on **.env.test**, and update the necessary environment variables:

```sh
cp .env.test .env
```

Edit `.env` with your database configuration:

```env
DATABASE_URL="postgresql://your_username:your_password@your_host:your_port/your_database"
API_PREFIX="/api"
PORT=3000
```

---

## 🚀 Running the Application

### Development Mode

```sh
npm run dev
```

### Debugging Mode

```sh
npm run debug
```

### Production Mode

```sh
npm run prod
```

### Lint & Formatting & Types

```sh
npm run lint
npm run format
npm run type-check
```

### Testing Commands

```sh
# Unit Tests
npm run test:unit
npm run test:unit:watch
npm run test:unit:coverage
npm run test:unit:verbose

# E2E Tests
npm run test:e2e
npm run test:e2e:verbose
npm run test:e2e:coverage

# Full Test Suite
npm run test:full
npm run test:full:verbose
```

---

## 🛠 Database Management (Prisma)

### Apply Database Migrations (Development)

```sh
npm run db:update:dev <migration_name>
```

#### Options:

- `--wf`: With **functions** in the migration.
- `--wt`: With **triggers** in the migration.
- `--wds`: With **triggers** in the migration
- Example:

```sh
npm run db:update:dev init_data_base_config -- --wf --wt --wds
```

This will create two separate migrations:

- `YYYYMMDDHHMMSS_migration_name_tables/`
- `YYYYMMDDHHMMSS_migration_name_func_trigger/`

---

### Apply Database Migrations (Production)

```sh
npm run db:update:prod <migration_name>
```

#### ⚠️ Warning:

This command will prompt for **confirmation** before applying migrations in **production**.

---

### Additional Prisma Commands

#### Generate Prisma Client (Manually)

```sh
npx prisma generate
```

#### View Database Schema

```sh
npx prisma studio
```

#### Apply Migrations (Alternative)

```sh
npx prisma migrate dev --name <migration_name>
```

#### Deploy Migrations in Production

```sh
npx prisma migrate deploy
```

## 📂 Project Structure

```
billmate-backend/
│── prisma/               # Prisma database schema and migrations
│   ├── migrations/       # Prisma database migrations "commit"
│   ├── schema/           # Tables and enums organized by context
│   └── sql/              # SQL scripts for functions & triggers
│
│── src/
│   ├── common/           # Shared components and utilities
│   │   ├── filters/      # Common exception filters
│   │   └── services/     # Shared services
│   │
│   ├── configs/          # Application configurations
│   │   ├── prisma/       # Prisma configuration
│   │   ├── test/         # Test configuration
│   │   ├── env/          # Environment configuration
│   │   └── db/           # Database configuration
│   │
│   ├── modules/          # Feature modules
│   │   ├── auth/         # Authentication module
│   │   └── health/       # Health check module
│   │
│   ├── app.module.ts     # Root module
│   └── main.ts           # Application entry point
│
│── scripts/              # Helper scripts
│── .env.test             # Test & Exemple environment variables
│── package.json          # Project dependencies and scripts
└── README.md             # Documentation
```

### Module Structure

Each module in `modules/` follows this structure:

```
modules/example/
├── dto/                # Data Transfer Objects
├── services/           # Business logic
├── controllers/        # HTTP endpoints
├── tests/              # Module-specific tests
│   ├── unit/           # Unit tests
│   └── e2e/            # End-to-end tests
└── example.module.ts   # Module definition
```

---

## 📜 License

This project is **MIT Licensed**.

---

## 📬 Contact & Support

For any issues or feature requests, please open an issue on **[GitHub Issues](https://github.com/agachet/billmate-backend/issues)**.

---
