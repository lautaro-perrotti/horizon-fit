#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${HF_REPO_DIR:-/root/horizon-fit}"
BASE_URL="${HF_SEO_AUDIT_URL:-https://horizonfit.com.ar}"

cd "$REPO_DIR"
node scripts/seo-audit.js "$BASE_URL" --all
