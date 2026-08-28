# UI Analysis — Ringkasan Awal

Tanggal: 2026-06-16

Tujuan: Membaca dan menganalisa kode frontend / template pada repo lalu memberikan ringkasan cepat dan rekomendasi untuk merombak tampilan agar lebih rapi, ringan, dan konsisten tanpa mengubah tema secara radikal.

---

## Temuan Utama (file/folder penting)
- `web/` — Frontend Next.js modern (folder utama UI)
  - `web/app/layout.tsx` — Layout global aplikasi
  - `web/app/globals.css` — Style global
  - `web/components/` — Komponen UI (charts, ui/*, layout/*)
    - `web/components/ui/*` (toast, status-badge, stat-card, rupiah, error-boundary)
    - `web/components/layout/page-header.tsx`
    - `web/components/charts/*` (grafik/grafik komponen)
  - `web/app/(dashboard)/.../page.tsx` — Halaman-halaman dashboard (keuangan, stok, dapur, dsb.)
  - `web/lib/*.ts` — utilitas frontend (api, auth, utils)
  - `web/tailwind.config.js`, `web/postcss.config.js`, `web/next.config.js` — konfigurasi build Tailwind/Next

- `backend/templates/produksi_simulasi.html` — Template HTML server-side
- `backend/routers/ui.py` — Endpoint yang mungkin merender UI atau template

Catatan: repo menggunakan Next.js + Tailwind (lihat `tailwind.config.js`) dan banyak komponen React/TSX terdistribusi pada `web/components` dan `web/app`. Ada juga beberapa template di backend untuk kebutuhan export atau rendering server-side.

---

## Penilaian Singkat
- Teknologi: Next.js (app router), TypeScript, Tailwind CSS.
- Kelebihan saat ini:
  - Struktur komponen terpisah (komponen UI dan layout tersedia)
  - Tailwind tersedia → memudahkan styling cepat dan konsisten
- Kekurangan/area perbaikan:
  - Potensi duplikasi utilitas styling antar komponen
  - `globals.css` bisa berisi aturan yang tumpang-tindih dengan Tailwind
  - Kemungkinan ukuran bundle besar bila komponen/chart di-load semua sekaligus
  - Tidak ada sistem desain tersentralisasi (variabel warna/typography) yang mudah diubah

---

## Rekomendasi Desain Ulang (ringkas, tidak ribet, performa-friendly)
1. Pertahankan Next.js + Tailwind (sudah ada) — lebih cepat daripada migrasi teknologi.
2. Buat "Design Tokens" ringan via CSS variables: warna primer/sekunder, radius, ukuran font, spacing.
   - Letakkan di `web/app/globals.css` (atau `:root` di `globals.css`) dan gunakan dengan class Tailwind `var(--...)` bila perlu.
3. Gunakan layer komponen Tailwind (via `@layer components` di CSS) untuk menyatukan komponen dasar (button, card, badge).
4. Konsolidasi warna dan tipografi agar tema tetap dekat dengan tampilan sekarang tapi lebih bersih.
5. Optimasi pemuatan komponen berat (charts): dynamic import + lazy-loading untuk halaman yang memerlukan.
6. Kecilkan bundle Tailwind: gunakan `content` di `tailwind.config.js` dengan path yang tepat dan hapus class yang tidak dipakai.
7. Gunakan ikon vektor ringan (Heroicons / SVG inline) bukan paket ikon besar.
8. Pastikan aksesibilitas kontras warna dan ukuran font responsif.
9. Sediakan satu file `theme.css` minimal dan satu `ui-kit.md` dokumentasi kecil untuk class/komponen yang tersedia.

---

## Implementasi Bertahap yang Saya Sarankan
1. Phase 1 — Analisis & Dokumentasi (ini): daftar file dan rencana.
2. Phase 2 — Theme tokens & global styles: tambahkan CSS variables dan layer Tailwind.
3. Phase 3 — Komponen dasar ulang: Button, Card, Header, Badge, Toast.
4. Phase 4 — Refactor halaman utama: terapkan komponen baru pada 2-3 halaman prioritas.
5. Phase 5 — Optimasi: dynamic imports, tree-shaking, ukuran gambar dan cache.
6. Phase 6 — Testing & Dokumentasi: cek responsif, performance, dan buat `UI_CHANGELOG.md`.

---

## Hal yang Perlu Saya Lakukan Selanjutnya (opsional, pilih satu)
- A. Buat `theme.css` + update `tailwind.config.js` contoh (cepat, aman).
- B. Implementasi ulang satu halaman (dashboard) sebagai contoh visual.
- C. Buat katalog komponen (`UI_KIT.md`) dan dokumentasinya.

---

Jika Anda setuju, saya akan melanjutkan dengan implementasi Phase 2: membuat file `web/app/styles/theme.css` (atau update `globals.css`) dan menambahkan design tokens serta contoh komponen Button/Card. Pilih A/B/C atau berikan prioritas halaman yang ingin Anda rombak dulu.
