#!/bin/bash
set -euo pipefail
# Flatpak 内通过 zypak 启动 Electron，勿使用 --no-sandbox 包装
export TMPDIR="${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"
exec zypak-wrapper /app/imfile/imfile.bin \
  --ozone-platform-hint=auto \
  --enable-features=WaylandWindowDecorations \
  --gtk-version=4 \
  "$@"
