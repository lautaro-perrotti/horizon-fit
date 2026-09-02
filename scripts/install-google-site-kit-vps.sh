#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${HF_REPO_DIR:-/root/horizon-fit}"
WP_CONTAINER="${HF_WP_CONTAINER:-horizon-fit-wp}"
WPCLI_CONTAINER="${HF_WPCLI_CONTAINER:-horizon-fit-wpcli}"
PLUGIN_SLUG="${HF_SITE_KIT_PLUGIN:-google-site-kit}"

cd "$REPO_DIR"

docker compose up -d wordpress wpcli

docker exec -u root "$WP_CONTAINER" sh -lc '
set -eu
mkdir -p /var/www/html/wp-content/upgrade /var/www/html/wp-content/plugins
chown -R www-data:www-data /var/www/html/wp-content/upgrade /var/www/html/wp-content/plugins
find /var/www/html/wp-content/upgrade /var/www/html/wp-content/plugins -type d -exec chmod 775 {} \;
'

if docker exec "$WPCLI_CONTAINER" wp plugin is-installed "$PLUGIN_SLUG" --allow-root >/dev/null 2>&1; then
  docker exec "$WPCLI_CONTAINER" wp plugin activate "$PLUGIN_SLUG" --allow-root
else
  docker exec "$WPCLI_CONTAINER" wp plugin install "$PLUGIN_SLUG" --activate --allow-root
fi

docker exec "$WPCLI_CONTAINER" wp plugin status "$PLUGIN_SLUG" --allow-root

cat <<'EOF'

Google Site Kit quedó instalado/activado en WordPress.

Último paso manual obligatorio:
1. Entrar a https://api.horizonfit.com.ar/wp-admin/
2. Abrir Site Kit
3. Conectar la cuenta Google y habilitar Search Console / Analytics

Nota: el storefront SPA ya tiene GA4 propio en index.html. Revisar en Site Kit
que no se duplique la medición si en el futuro WordPress empieza a renderizar
páginas públicas.
EOF
