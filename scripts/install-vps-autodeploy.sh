#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${HF_REPO_DIR:-/root/horizon-fit}"

install -m 0644 "$REPO_DIR/ops/systemd/horizon-fit-deploy.service" /etc/systemd/system/horizon-fit-deploy.service
install -m 0644 "$REPO_DIR/ops/systemd/horizon-fit-deploy.timer" /etc/systemd/system/horizon-fit-deploy.timer

systemctl daemon-reload
systemctl enable --now horizon-fit-deploy.timer
systemctl start horizon-fit-deploy.service

echo "Autodeploy instalado. Estado:"
systemctl --no-pager --full status horizon-fit-deploy.timer || true
