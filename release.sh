#!/usr/bin/env bash
#
# release.sh — rilis via GIT (tanpa upload manual). Jalankan DI LOKAL.
#
# Ambil hasil `npm run build` (out/) ke branch `deploy` lalu push.
# Di server cukup `./server-deploy.sh` (git pull origin deploy + salin out/ ke docroot).
#
set -euo pipefail
cd "$(dirname "$0")"

MAIN=main
DEPLOY=deploy

# 0. Working tree harus bersih — checkout branch gagal / bikin bingung kalau kotor.
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ Ada perubahan yang belum di-commit. Commit atau stash dulu:"
  git status --short
  exit 1
fi

if [ "$(git rev-parse --abbrev-ref HEAD)" != "$MAIN" ]; then
  echo "✗ Jalankan dari branch '$MAIN' (sekarang: $(git rev-parse --abbrev-ref HEAD))."
  exit 1
fi

# out/ lokal (untracked di main) bikin checkout ke deploy gagal — hasil build, aman dihapus.
rm -rf out

# 1. Branch deploy — dibuat dari main kalau belum ada (rilis pertama).
if git show-ref --verify --quiet "refs/heads/$DEPLOY"; then
  echo "▶ checkout $DEPLOY + merge $MAIN …"
  git checkout "$DEPLOY"
  git merge "$MAIN" --no-edit
elif git ls-remote --exit-code --heads origin "$DEPLOY" >/dev/null 2>&1; then
  echo "▶ ambil $DEPLOY dari origin + merge $MAIN …"
  git checkout -b "$DEPLOY" "origin/$DEPLOY"
  git merge "$MAIN" --no-edit
else
  echo "▶ branch '$DEPLOY' belum ada — dibuat dari $MAIN …"
  git checkout -b "$DEPLOY"
fi

# 2. Build static export.
echo "▶ npm run build …"
rm -rf out
npm run build

# 3. out/ ada di .gitignore — dipaksa masuk khusus di branch deploy.
#    `git add` pada folder juga ikut men-stage file lama yang sudah hilang.
echo "▶ commit out/ (force, lewati .gitignore) …"
git add -f out
git commit -m "build $(date +%F-%H%M)" || echo "  (out/ tidak berubah)"

echo "▶ push $DEPLOY …"
git push -u origin "$DEPLOY"

echo "▶ kembali ke $MAIN …"
git checkout "$MAIN"

echo ""
echo "✓ Rilis terdorong ke branch '$DEPLOY'."
echo "  Di server jalankan:  ./server-deploy.sh"
echo ""
echo "  Catatan: out/ lokal ikut pindah ke branch '$DEPLOY'."
echo "  Buat kerja lokal lagi:  npm run dev   (atau npm run build)"
