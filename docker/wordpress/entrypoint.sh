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

# Mantener wp-config.php sincronizado con la plantilla del repo aunque ya exista.
# Sin esto, los cambios al wp-config-sample (ej. el fallback de host por env var)
# nunca llegarían a un contenedor con WordPress ya instalado, y habría que
# parchear a mano tras cada deploy.
if [ -f /wp-config-sample.php ] && [ -f /var/www/html/wp-config.php ]; then
  if ! cmp -s /wp-config-sample.php /var/www/html/wp-config.php; then
    echo "Sincronizando wp-config.php con la plantilla del repo..."
    cp /wp-config-sample.php /var/www/html/wp-config.php
  fi
fi

# Habilitar módulos de Apache necesarios para CORS y rewrite (idempotente).
# Sin mod_headers, los Header set del vhost se ignoran y el SPA (:8088) no
# puede leer datos/imágenes de WordPress (:8089) por bloqueo CORS.
a2enmod headers rewrite expires deflate >/dev/null 2>&1 || true

# Run Apache
exec apache2-foreground
