#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${HF_REPO_DIR:-/root/horizon-fit}"
BRANCH="${HF_DEPLOY_BRANCH:-main}"
CACHE_FILE="backend/wordpress/wp-content/uploads/horizon-fit-cache/featured-products.json"

exec 9>/run/lock/horizon-fit-deploy.lock
flock -n 9 || exit 0

cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"

local_commit="$(git rev-parse HEAD)"
remote_commit="$(git rev-parse "origin/$BRANCH")"
if [[ "$local_commit" == "$remote_commit" ]]; then
  exit 0
fi

# Esta caché es regenerada por WordPress y por eso siempre aparece modificada
# en producción. Es el único cambio local que el despliegue puede descartar.
git restore -- "$CACHE_FILE" 2>/dev/null || true

# `git merge --ff-only` conserva modificaciones operativas de la VPS (uploads,
# logs, etc.). Si un commit remoto intentara pisar alguna, Git aborta antes de
# escribir y el sitio continúa con la versión anterior.
if ! git merge --ff-only "origin/$BRANCH"; then
  echo "Deploy cancelado de forma segura: un cambio remoto entra en conflicto con archivos locales." >&2
  git status --short >&2
  exit 1
fi

# Compose sólo recrea servicios cuya configuración cambió. Los archivos del
# código se ven inmediatamente a través de bind mounts de directorio.
docker compose up -d --remove-orphans

for _ in {1..30}; do
  if docker inspect -f '{{.State.Running}}' horizon-fit-wpcli 2>/dev/null | grep -q true; then
    break
  fi
  sleep 2
done

docker exec horizon-fit-wpcli wp eval '
if (function_exists("hf_regenerate_featured_products_cache")) { hf_regenerate_featured_products_cache(); }
if (function_exists("hf_regenerate_sections_cache")) { hf_regenerate_sections_cache(); }
if (function_exists("hf_regenerate_menu_cache")) { hf_regenerate_menu_cache(); }
if (function_exists("hf_regenerate_storefront_seo_cache")) { hf_regenerate_storefront_seo_cache(); }
echo "Horizon Fit actualizado y caches regeneradas.\n";
'

echo "Deploy completo: $(git rev-parse --short HEAD)"
