#!/bin/bash
set -e

# Wait for database to be ready
echo "Waiting for database..."
while ! mysqladmin ping -h"${DB_HOST:-db}" -u"${DB_USER:-wordpress}" -p"${DB_PASSWORD:-wordpress}" --silent; do
  echo 'waiting for mysql...'
  sleep 1
done
echo "Database is ready!"

# Run Apache
exec apache2-foreground
