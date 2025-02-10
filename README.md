# BillMate Backend

**BillMate** is an open-source backend built with **NestJS**, **Prisma**, and **PostgreSQL**. It provides a powerful solution for managing clients, invoices, and financial tasks.

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
chmod +x ./scripts/update-db-dev.sh ./scripts/update-db-prod.sh
```

### 3️⃣ Environment Configuration

Create a **.env** file based on **.env.example**, and update the necessary environment variables:

```sh
cp .env.example .env
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

### Lint & Formatting & types

```sh
npm run lint
npm run format
npm run type-check
```

---

## 🛠 Database Management (Prisma)

### Apply Database Migrations (Development)

```sh
npm run db:update:dev <migration_name>
```

#### Options:

- `--wf`: Includes **functions** in the migration.
- `--wt`: Includes **triggers** in the migration.
- Example:

```sh
npm run db:update:dev add_authentication -- --wf --wt
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

---

## ✅ Testing

### Run Unit Tests

```sh
npm run test
```

### Run Tests in Watch Mode

```sh
npm run test:watch
```

### Run End-to-End (E2E) Tests

```sh
npm run test:e2e
```

### Generate test coverage

```sh
npm run test:cov
```

---

## 📂 Project Structure

```
billmate-backend/
│── prisma/                 # Prisma database schema and migrations
│   ├── migrations/         # Prisma database migrations "commit"
│   ├── schema/             # Tables and enums organized by context
│   └── sql/                # SQL scripts for functions & triggers
│
│── src/
│   ├── common/
|   │   ├── filters/        # Common Filters
|   │   └── services/       # Common services
|   │
│   ├── configs/
|   │   └── prisma/         # Prisma module & service
|   │
│   ├── modules/
|   │   ├── health/         # Health feature module
|   │   ├── feature A/      # Feature A module
|   │   ├── feature B/      # Feature B module
|   │   └── feature C/      # Feature C module
|   │
│   ├── app.module.ts           # Root module
│   └── main.ts
│
│── scripts/                # Helper scripts
│── .env.example            # Example environment variables
│── package.json            # Project dependencies and scripts
└── README.md               # Documentation
```

### Module Structure

Each module in `modules/` follows this structure:

```
modules/example/
├── dto/               # Module-specific DTOs
├── services/          # Module-specific services
├── controllers/       # Module-specific controllers
├── tests/             # Module-specific tests
│   ├── unit/          # Module-specific unit tests
│   └── e2e/           # Module-specific E2E tests
└── example.module.ts
```

---

## 📜 License

This project is **MIT Licensed**.

---

## 📬 Contact & Support

For any issues or feature requests, please open an issue on **[GitHub Issues](https://github.com/agachet/billmate-backend/issues)**.

---
