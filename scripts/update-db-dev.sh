#!/bin/bash

# Exit on error
set -e

# Vérifier si un nom de migration a été fourni
if [ -z "$1" ]; then
  echo "❌ Error: You must provide a migration name."
  echo "Usage: ./update-db-dev.sh <migration-name> [--wf] [--wt]"
  exit 1
fi

# Définition des options
MIGRATION_NAME="$1"
INCLUDE_FUNCTIONS=false
INCLUDE_TRIGGERS=false

# Vérifier les arguments
for arg in "$@"; do
  case "$arg" in
    --wf) INCLUDE_FUNCTIONS=true ;;
    --wt) INCLUDE_TRIGGERS=true ;;
  esac
done

# Définition des chemins
MIGRATIONS_DIR="prisma/migrations"
SQL_FUNCTIONS_DIR="prisma/sql/functions"
SQL_TRIGGERS_DIR="prisma/sql/triggers"

# Générer la migration des tables
TABLES_MIGRATION_NAME="${MIGRATION_NAME}_tables"
echo "🚀 Creating migration for tables: $TABLES_MIGRATION_NAME"
npx prisma migrate dev --create-only --name "$TABLES_MIGRATION_NAME"

# Récupérer le dossier de la dernière migration créée
LATEST_MIGRATION_DIR=$(ls -d "$MIGRATIONS_DIR"/*/ | sort | tail -n 1)
MIGRATION_FILE="$LATEST_MIGRATION_DIR/migration.sql"

# Vérifier si migration.sql existe
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: migration.sql not found after migration creation."
  exit 1
fi

# Générer un second fichier de migration si --wf et/ou --wt sont spécifiés
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

  # Récupérer le dossier de la dernière migration
  LATEST_MIGRATION_DIR=$(ls -d "$MIGRATIONS_DIR"/*/ | sort | tail -n 1)
  MIGRATION_FILE="$LATEST_MIGRATION_DIR/migration.sql"

  # Vérifier si migration.sql existe
  if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: migration.sql not found for functions/triggers."
    exit 1
  fi

  # Ajouter les fonctions et triggers
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

# Appliquer toutes les migrations en une seule commande
echo "🚀 Running Prisma migrations..."
npx prisma migrate deploy

# Générer le Prisma Client
echo "⚙️ Generating Prisma Client..."
npx prisma generate

echo "✅ All migrations applied and Prisma Client updated!"