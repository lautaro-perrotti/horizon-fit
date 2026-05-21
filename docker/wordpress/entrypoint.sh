#!/bin/bash
set -e

# Wait for database to be ready (using /dev/tcp)
echo "Waiting for database at ${DB_HOST:-db}:3306..."
timeout=60
while [ $timeout -gt 0 ]; do
  if bash -c "exec 3<>/dev/tcp/${DB_HOST:-db}/3306" 2>/dev/null; then
    echo "Database is ready!"
    exec 3<&-
    exec 3>&-
    break
  fi
  echo "waiting for mysql..."
  sleep 1
  timeout=$((timeout - 1))
done

# Install WordPress if not already there
if [ ! -f /var/www/html/wp-config.php ]; then
  echo "Installing WordPress..."
  curl -s https://wordpress.org/latest.tar.gz | tar xz --strip-components=1 -C /var/www/html/

  # Copy the proper wp-config from the mounted file
  if [ -f /wp-config-sample.php ]; then
    cp /wp-config-sample.php /var/www/html/wp-config.php
  fi

  echo "WordPress installed!"
fi

# Run Apache
exec apache2-foreground
