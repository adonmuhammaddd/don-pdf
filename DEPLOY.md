# Deploy — DonPDF ke cPanel

Stack: Next.js static export (`output: "export"`) → folder `out/` berisi file
statis biasa. Tidak ada Node/PHP runtime di server, tidak ada database.

> Repo: `github.com/adonmuhammaddd/don-pdf` (publik)
> Branch: `main` (sumber, bersih) · `deploy` (main + `out/` yang di-track)
> Server cuma butuh isi `out/` di docroot domain — **bukan** `node_modules` (build-time only).

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
cd ~/don-pdf
./server-deploy.sh
# git pull origin deploy → salin out/ ke docroot → hapus file rilis lama
```

Dependency baru (`package.json` berubah) tidak butuh langkah tambahan — semuanya
di-bundle saat `npm run build` di lokal, server tidak pernah `npm install`.

---

## Setup 1x di server

Repo publik → clone lewat HTTPS, tidak perlu deploy key.

Clone **di luar** docroot (supaya `.git` dan source tidak ikut ter-serve):
```bash
cd ~
git clone -b deploy https://github.com/adonmuhammaddd/don-pdf.git don-pdf
cd don-pdf
chmod +x server-deploy.sh

# Pertama kali: kasih path docroot domain-nya (cek di cPanel → Domains).
./server-deploy.sh ~/public_html/pdf.domain.com
```
Path docroot disimpan di `~/don-pdf/.deploy-target`, jadi deploy berikutnya cukup
`./server-deploy.sh`. Mau pindah docroot: jalankan lagi dengan path baru.

---

## Cara kerja salin ke docroot

- `out/` disalin menimpa isi docroot.
- File yang ada di rilis sebelumnya tapi tidak ada di rilis baru (chunk `_next/`
  ber-hash lama) dihapus. Daftarnya dari `~/don-pdf/.deploy-manifest`.
- File lain di docroot (`.htaccess`, `.well-known/`, `cgi-bin/`, dll.) **tidak
  pernah disentuh**.
- Deploy pertama ke docroot yang sudah berisi upload manual lama: file lama tidak
  dihapus (belum ada manifest). Tidak masalah — cuma sisa file yang tidak dipakai;
  hapus manual kalau mau bersih.

---

## Kalau tampilan di server "aneh" / tool PDF tidak jalan

- Hard refresh (Cmd+Shift+R) — browser mungkin masih pegang chunk lama.
- Cek `pdf.worker.min.js` ada di docroot. File itu disalin ke `public/` saat
  `prebuild`, jadi ikut di `out/`. Kalau hilang, preview/render PDF gagal.
