#!/usr/bin/env bash
#
# server-deploy.sh — tarik rilis DI SERVER (cPanel) dari branch `deploy`.
#
# Prasyarat (setup 1x): folder docroot domain = git checkout branch `deploy`.
# .htaccess di root repo meneruskan semua request ke out/ (hasil build),
# jadi cukup git pull — tidak ada build / npm di server.
#
# Pemakaian:
#   ./server-deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ git pull origin deploy …"
git pull origin deploy

if [ ! -f out/index.html ]; then
  echo "✗ out/index.html tidak ada — pastikan checkout branch 'deploy' dan ./release.sh sudah jalan di lokal."
  exit 1
fi
if [ ! -f .htaccess ]; then
  echo "✗ .htaccess tidak ada — tanpa itu isi repo ter-listing publik. Cek branch 'deploy'."
  exit 1
fi

echo ""
echo "✓ Deploy selesai."
