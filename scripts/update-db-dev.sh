#!/bin/bash

# Exit on error
set -e

# Check if a migration name was provided
if [ -z "$1" ]; then
  echo "❌ Error: You must provide a migration name."
  echo "Usage: ./update-db-dev.sh <migration-name> [--wf] [--wt] [--wds]"
  exit 1
fi

# Define options
MIGRATION_NAME="$1"
INCLUDE_FUNCTIONS=false
INCLUDE_TRIGGERS=false
INCLUDE_DATASETS=false

# Check arguments
for arg in "$@"; do
  case "$arg" in
    --wf) INCLUDE_FUNCTIONS=true ;;
    --wt) INCLUDE_TRIGGERS=true ;;
    --wds) INCLUDE_DATASETS=true ;;
  esac
done

# Define paths
MIGRATIONS_DIR="prisma/migrations"
SQL_FUNCTIONS_DIR="prisma/sql/functions"
SQL_TRIGGERS_DIR="prisma/sql/triggers"
SQL_DATASETS_DIR="prisma/sql/datasets"

# Generate tables migration
TABLES_MIGRATION_NAME="${MIGRATION_NAME}_tables"
echo "🚀 Creating migration for tables: $TABLES_MIGRATION_NAME"
npx prisma migrate dev --create-only --name "$TABLES_MIGRATION_NAME"

# Get the latest created migration directory
LATEST_MIGRATION_DIR=$(ls -d "$MIGRATIONS_DIR"/*/ | sort | tail -n 1)
MIGRATION_FILE="$LATEST_MIGRATION_DIR/migration.sql"

# Check if migration.sql exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: migration.sql not found after migration creation."
  exit 1
fi

# Generate a second migration file if --wf and/or --wt are specified
if [ "$INCLUDE_FUNCTIONS" = true ] || [ "$INCLUDE_TRIGGERS" = true ]; then
  FUNC_TRIG_MIGRATION_NAME="${MIGRATION_NAME}"
  if [ "$INCLUDE_FUNCTIONS" = true ] && [ "$INCLUDE_TRIGGERS" = true ]; then
    FUNC_TRIG_MIGRATION_NAME+="_func_trigger"
  elif [ "$INCLUDE_FUNCTIONS" = true ]; then
    FUNC_TRIG_MIGRATION_NAME+="_func"
  elif [ "$INCLUDE_TRIGGERS" = true ]; then
    FUNC_TRIG_MIGRATION_NAME+="_trigger"
  fi

  echo "🚀 Creating migration for functions/triggers: $FUNC_TRIG_MIGRATION_NAME"
  npx prisma migrate dev --create-only --name "$FUNC_TRIG_MIGRATION_NAME"

  # Get the latest migration directory
  LATEST_MIGRATION_DIR=$(ls -d "$MIGRATIONS_DIR"/*/ | sort | tail -n 1)
  MIGRATION_FILE="$LATEST_MIGRATION_DIR/migration.sql"

  # Check if migration.sql exists
  if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: migration.sql not found for functions/triggers."
    exit 1
  fi

  # Add functions and triggers
  echo "🔍 Adding SQL functions/triggers to: $MIGRATION_FILE"

  if [ "$INCLUDE_FUNCTIONS" = true ]; then
    for FUNCTION_FILE in "$SQL_FUNCTIONS_DIR"/*.sql; do
      if [ -f "$FUNCTION_FILE" ]; then
        echo "-- Function: $(basename "$FUNCTION_FILE")" >> "$MIGRATION_FILE"
        cat "$FUNCTION_FILE" >> "$MIGRATION_FILE"
        echo "" >> "$MIGRATION_FILE"
      fi
    done
  fi

  if [ "$INCLUDE_TRIGGERS" = true ]; then
    for TRIGGER_FILE in "$SQL_TRIGGERS_DIR"/*.sql; do
      if [ -f "$TRIGGER_FILE" ]; then
        echo "-- Trigger: $(basename "$TRIGGER_FILE")" >> "$MIGRATION_FILE"
        cat "$TRIGGER_FILE" >> "$MIGRATION_FILE"
        echo "" >> "$MIGRATION_FILE"
      fi
    done
  fi

  echo "✅ Functions and triggers added to migration."
fi

# Generate a third migration file if --wds is specified
if [ "$INCLUDE_DATASETS" = true ]; then
  DATASETS_MIGRATION_NAME="${MIGRATION_NAME}_datasets"

  echo "🚀 Creating migration for datasets: $DATASETS_MIGRATION_NAME"
  npx prisma migrate dev --create-only --name "$DATASETS_MIGRATION_NAME"

  # Get the latest migration directory
  LATEST_MIGRATION_DIR=$(ls -d "$MIGRATIONS_DIR"/*/ | sort | tail -n 1)
  MIGRATION_FILE="$LATEST_MIGRATION_DIR/migration.sql"

  # Check if migration.sql exists
  if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: migration.sql not found for datasets."
    exit 1
  fi

  # Add datasets
  echo "🔍 Adding SQL datasets to: $MIGRATION_FILE"

  for DATASET_FILE in "$SQL_DATASETS_DIR"/*.sql; do
    if [ -f "$DATASET_FILE" ]; then
      echo "-- Dataset: $(basename "$DATASET_FILE")" >> "$MIGRATION_FILE"
      cat "$DATASET_FILE" >> "$MIGRATION_FILE"
      echo "" >> "$MIGRATION_FILE"
    fi
  done

  echo "✅ Datasets added to migration."
fi

# Apply all migrations in one command
echo "🚀 Running Prisma migrations..."
npx prisma migrate deploy

# Generate Prisma Client
echo "⚙️ Generating Prisma Client..."
npx prisma generate

echo "✅ All migrations applied and Prisma Client updated!"