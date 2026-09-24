# Deploy — DonPDF ke cPanel

Stack: Next.js static export (`output: "export"`) → folder `out/` berisi file
statis biasa. Tidak ada Node/PHP runtime di server, tidak ada database.

> Repo: `github.com/adonmuhammaddd/don-pdf` (publik)
> Branch: `main` (sumber, bersih) · `deploy` (main + `out/` yang di-track)
> Docroot domain = git checkout branch `deploy`. `.htaccess` di root repo
> meneruskan semua request ke `out/` (sama seperti kji → `public/`), jadi source,
> script, dan `.git` tidak bisa diakses dari web.

---

## Deploy via GIT

**Lokal:**
```bash
./release.sh
# cek working tree bersih → checkout deploy → merge main → npm run build
# → commit out/ → push deploy → balik main
```
> Setelah `release.sh`, `out/` lokal ikut pindah ke branch `deploy`.
> Untuk kerja lokal lagi: `npm run dev` (atau `npm run build`).

**Server (SSH / Terminal cPanel):**
```bash
cd ~/path/ke/docroot/don-pdf
./server-deploy.sh
# git pull origin deploy (+ cek out/index.html & .htaccess ada)
```

Dependency baru (`package.json` berubah) tidak butuh langkah tambahan — semuanya
di-bundle saat `npm run build` di lokal, server tidak pernah `npm install`.
Chunk lama ikut terhapus lewat git (file yang hilang dari `out/` di-commit sebagai delete).

---

## Setup 1x di server

Repo publik → clone lewat HTTPS, tidak perlu deploy key.

```bash
cd ~/path/ke/docroot/don-pdf        # folder docroot domain (cPanel → Domains)
git init
git remote add origin https://github.com/adonmuhammaddd/don-pdf.git
git fetch origin deploy
git checkout -f -b deploy origin/deploy   # -f: timpa file upload manual lama
chmod +x server-deploy.sh
```
Butuh Apache `mod_rewrite` (default di cPanel). Kalau setelah setup masih muncul
"Index of /", berarti `.htaccess` belum ada di docroot — cek `ls -a`.

---

## Kalau tampilan di server "aneh" / tool PDF tidak jalan

- Hard refresh (Cmd+Shift+R) — browser mungkin masih pegang chunk lama.
- Cek `out/pdf.worker.min.js` ada. File itu disalin ke `public/` saat
  `prebuild`, jadi ikut di `out/`. Kalau hilang, preview/render PDF gagal.
