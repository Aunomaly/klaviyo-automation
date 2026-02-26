#!/bin/bash

# Load environment variables
source ../.env.local

MIGRATION_FILE="../supabase/migrations/003_lists_forms_coupons.sql"
PROJECT_REF="lmunxjavmqxckbhoifwf"

echo "🚀 Applying migration to Supabase..."
echo ""

# Use psql if available, otherwise provide instructions
if command -v psql &> /dev/null; then
    echo "Using psql to apply migration..."
    PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
        -h "db.${PROJECT_REF}.supabase.co" \
        -p 5432 \
        -d postgres \
        -U postgres \
        -f "${MIGRATION_FILE}"
else
    echo "❌ psql not found"
    echo ""
    echo "Please apply the migration manually:"
    echo "1. Go to: https://app.supabase.com/project/${PROJECT_REF}/sql"
    echo "2. Copy the contents of: supabase/migrations/003_lists_forms_coupons.sql"
    echo "3. Paste into the SQL Editor and click 'Run'"
    echo ""
    echo "Or install PostgreSQL client: brew install postgresql"
fi
