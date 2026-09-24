#!/usr/bin/env bash
#
# server-deploy.sh — tarik rilis DI SERVER (cPanel) dari branch `deploy`,
# lalu salin out/ ke folder docroot domain.
#
# Prasyarat (setup 1x): repo di-clone di luar docroot (mis. ~/don-pdf),
# checkout branch `deploy`. Lihat DEPLOY.md.
#
# Pemakaian:
#   ./server-deploy.sh ~/public_html/pdf.domain.com   # pertama kali: set docroot (disimpan)
#   ./server-deploy.sh                                # selanjutnya: pakai docroot tersimpan
#
set -euo pipefail
cd "$(dirname "$0")"
REPO="$(pwd -P)"

# Docroot: argumen > $DEPLOY_TARGET > .deploy-target (disimpan dari run sebelumnya).
TARGET="${1:-${DEPLOY_TARGET:-}}"
if [ -z "$TARGET" ] && [ -f .deploy-target ]; then
  TARGET="$(head -n1 .deploy-target)"
fi
if [ -z "$TARGET" ]; then
  echo "✗ Docroot belum di-set. Jalankan sekali dengan path-nya:"
  echo "    ./server-deploy.sh ~/public_html/pdf.domain.com"
  exit 1
fi
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd -P)"

# Jangan sampai menyalin ke / , $HOME, atau ke dalam repo ini sendiri.
case "$TARGET" in
  / | "$(cd ~ && pwd -P)" | "$REPO" | "$REPO"/*)
    echo "✗ Docroot '$TARGET' tidak aman — pilih folder domain, di luar repo ini."
    exit 1
    ;;
esac
echo "$TARGET" > .deploy-target

echo "▶ git pull origin deploy …"
git pull origin deploy

if [ ! -f out/index.html ]; then
  echo "✗ out/index.html tidak ada — pastikan checkout branch 'deploy' dan ./release.sh sudah jalan di lokal."
  exit 1
fi

echo "▶ salin out/ → $TARGET …"
NEW_MANIFEST="$(mktemp)"
(cd out && find . -type f | sort) > "$NEW_MANIFEST"
cp -R out/. "$TARGET"/

# Bersihkan file rilis lama (chunk _next ber-hash yang sudah tidak dipakai).
# Hanya file yang tercatat dari deploy sebelumnya yang dihapus — .htaccess,
# .well-known, dll. di docroot tidak pernah disentuh.
if [ -f .deploy-manifest ]; then
  REMOVED=0
  while IFS= read -r f; do
    rm -f "$TARGET/$f"
    REMOVED=$((REMOVED + 1))
  done < <(comm -23 .deploy-manifest "$NEW_MANIFEST")
  [ -d "$TARGET/_next" ] && find "$TARGET/_next" -depth -type d -empty -delete
  echo "  $REMOVED file lama dihapus."
fi
mv "$NEW_MANIFEST" .deploy-manifest

echo ""
echo "✓ Deploy selesai → $TARGET"
