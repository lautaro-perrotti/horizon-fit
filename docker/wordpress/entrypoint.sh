#!/bin/bash
set -e

# Wait for database to be ready
echo "Waiting for database at ${DB_HOST:-db}:3306..."
timeout=30
while [ $timeout -gt 0 ]; do
  if nc -z ${DB_HOST:-db} 3306 2>/dev/null; then
    echo "Database is ready!"
    break
  fi
  echo "waiting for mysql..."
  sleep 1
  timeout=$((timeout - 1))
done

# Run Apache
exec apache2-foreground
