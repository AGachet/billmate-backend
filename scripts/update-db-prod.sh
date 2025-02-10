#!/bin/bash

# Check if a migration name was provided
if [ -z "$1" ]; then
  echo "❌ Error: You must provide a migration name."
  echo "Usage: ./update-db-prod.sh <migration-name>"
  exit 1
fi

echo "⚠️  WARNING: You are about to apply a database migration in PRODUCTION!"
read -p "❓ Are you sure you want to continue? (yes/no): " confirm

# Check if the user confirmed the operation on production
if [[ "$confirm" != "yes" ]]; then
  echo "❌ Operation cancelled."
  exit 1
fi

echo "🚀 Deploying migration in production..."
npx prisma migrate deploy

echo "⚙️ Generating Prisma Client..."
npx prisma generate

echo "✅ Production database updated and Prisma Client ready!"