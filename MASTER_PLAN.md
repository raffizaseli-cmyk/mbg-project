MASTER PLAN — Sistem Manajemen Bisnis Catering & MBG
> Versi: 1.7 | Status: Foundation Blueprint (FINAL — Siap Coding)
> Jangan ubah file ini tanpa update versi. Semua modul merujuk ke sini.
>
> Changelog v1.7:
> - [fix] Sekolah bisa ditambah/edit kapan saja dari Web Settings, bukan hanya onboarding
> - [fix] Stok awal diisi sekali saat onboarding, update otomatis setelahnya
> - [fix] BOM adalah library resep yang berkembang, bukan set sekali selamanya
>         Setiap menu baru → sistem minta BOM otomatis
> - [fix] Prompt OCR Gemini diperluas: nama toko, alamat, telp, kasir,
>         harga_satuan, kategori AI, metode_bayar, ocr_confidence, unclear_items
> - [fix] FASE 0 label diubah dari "Sekali Selamanya" ke "Setup Awal (~30 menit)"
>
> Changelog v1.5:
> - [+] User journey final dikonfirmasi langsung dari operator SPPG
> - [+] Visi produk: pengganti akuntan untuk semua ukuran SPPG
> - [+] Pembagian Telegram vs Web dikunci (Telegram=input, Web=output/analitik)
> - [+] Setup awal (master data, sekolah, BOM, supplier) dipindah ke Web bukan Telegram
> - [+] Input menu mingguan FULL (Senin-Jumat/Sabtu) dari Telegram, bisa diedit
> - [+] Fitur AI jadwal: draft otomatis → pemilik approve/edit
> - [+] Fitur track kenaikan harga: grafik + perbandingan supplier + AI insight
> - [+] Web menu: Pembukuan, Hutang/Piutang, Stok Gudang, AI Jadwal,
>        Track Harga, Generate Laporan JSON→Excel
> - [+] Struktur Excel laporan pemerintah 5 bagian dikonfirmasi
> - [fix] Weekly_menus: tidak pakai template tetap, input manual tiap minggu
> - [fix] Pajak (PPh22/PPN) diurus di Web, bukan di Telegram
> - [fix] Supplier & BOM di-setup di Web, bukan di Telegram
>
> Changelog v1.4:
> - [+] Upload foto MULTIPLE per sesi (batch OCR)
> - [+] Tabel photo_batches
> - [+] Error handling eksplisit alur bot
> - [+] Sinkronisasi delivery → stok + piutang
> - [+] Strategi Excel template-first

---

## 1. RINGKASAN SISTEM

**Visi produk:** Pengganti akuntan untuk operator SPPG (Satuan Pelayanan Pemenuhan Gizi)
program MBG (Makan Bergizi Gratis). Pemilik cukup input data sederhana setiap hari —
sistem yang rekap, hitung, dan buat laporan audit secara otomatis.

**Nilai jual utama:**
> "Bayar sistem ini lebih murah dari gaji akuntan, tapi laporan audit-nya lebih akurat."

**Yang diotomasi (tidak perlu akuntan lagi):**
- Rekap pengeluaran bahan baku harian → dari foto nota (OCR)
- Hitung laba bersih per periode → real-time di dashboard
- Laporan audit Excel untuk dinas → satu klik download
- Pantau hutang/piutang & jatuh tempo → notif otomatis
- Hitung alokasi 80:15:5 per hari → saat konfirmasi penyerahan
- Rekonsiliasi PPh 22 & PPN → otomatis di laporan

**Target pengguna:** Semua ukuran SPPG — dari 1 orang pemilik sampai yang punya tim admin.

**Konteks bisnis MBG yang dikonfirmasi:**
- SPPG melayani beberapa sekolah sekaligus, ribuan porsi per hari
- Menu berubah tiap hari, direncanakan seminggu sebelumnya oleh pemilik/admin
- Laporan ke dinas setiap hari, dirangkum mingguan
- Pembayaran pemerintah Rp 15.000/porsi, alokasi wajib:
  - 80% → Bahan pangan
  - 15% → Upah/jasa masak
  - 5%  → Operasional (sewa, listrik, gas, ATK, margin)
- PPh 22: 1,5% dipotong langsung pemerintah (withholding)
- PPN: muncul di nota supplier PKP — dideteksi OCR, diurus di Web

**Pembagian platform (FINAL — tidak boleh dilanggar):**
```
TELEGRAM = semua INPUT operasional harian
WEB      = semua OUTPUT (laporan, analitik, export) + setup master data awal
```

**Alur utama:**
```
User (Telegram) → Bot → FastAPI Backend → Supabase DB → Web Dashboard
                             ↑
                   AI Vision (Gemini OCR)
                             ↑
                     Redis Queue (async)
```

---

## 2. KEPUTUSAN TEKNIS (FINAL)

| Komponen        | Pilihan                 | Alasan                                          |
|-----------------|-------------------------|-------------------------------------------------|
| Database        | Supabase (PostgreSQL)   | Managed, gratis tier, auth bawaan, storage foto |
| Backend         | Python FastAPI          | Async native, cocok AI/OCR, performa tinggi     |
| Telegram Bot    | python-telegram-bot v20 | Async, mature, well-documented                  |
| AI OCR          | Google Gemini 1.5 Flash | Murah, cepat, support bahasa Indonesia          |
| Web Dashboard   | Next.js 14 + TailwindCSS| App Router, SSR, ecosystem kuat                 |
| Excel Export    | openpyxl                | Python native, full control format laporan MBG  |
| PDF Nota        | ReportLab               | Generate PDF nota (ref: nota_generator lama)    |
| Hosting Backend | Railway                 | Simple deploy, affordable, Docker support       |
| Hosting Web     | Vercel                  | Gratis tier, optimal untuk Next.js              |
| Auth Web        | Supabase Auth (JWT)     | Unified dengan database                         |
| File Storage    | Supabase Storage        | Simpan foto nota + PDF nota                     |
| Task Queue      | Redis + RQ (Railway)    | Async OCR, support banyak foto & user sekaligus |

---

## 3. USER JOURNEY (Alur Pengguna — Dikonfirmasi)

> Ini adalah acuan UX untuk semua modul. Setiap fitur yang dibangun harus
> mengikuti pembagian platform ini: **Telegram = input, Web = output + setup.**

---

### 🔐 FASE 0 — Setup Awal (~30 menit)
**Platform: Web**

> Onboarding tidak harus lengkap 100% di hari pertama.
> Sekolah, supplier, dan BOM bisa ditambah kapan saja dari Web → Settings.

```
1. Daftar akun → isi identitas SPPG
   Field wajib (sesuai format laporan dinas):
   ├── Nama SPPG resmi
   ├── ID/Kode SPPG dari pemerintah
   ├── Alamat lengkap
   ├── Nama penanggung jawab
   ├── Nomor telepon & email
   └── Tipe bisnis: MBG / Catering / Keduanya

2. Setup master data awal (urutan penting — saling bergantung):
   a. Daftar sekolah yang sudah ada sekarang
      → nama, alamat, nama penerima, kuota porsi default
      → ⚠️ BISA TAMBAH/EDIT KAPAN SAJA dari Web → Settings → Sekolah
      → Kuota porsi default bisa diedit per sekolah kapan saja
      → Nonaktifkan sekolah yang berhenti tanpa hapus data historis

   b. Daftar supplier awal
      → nama toko, kategori, status PKP (ada/tidak PPN)
      → ⚠️ BISA TAMBAH/EDIT KAPAN SAJA dari Web → Settings → Supplier

   c. Daftar bahan baku — isi yang sudah ada di gudang sekarang
      → nama, satuan, HPP awal, STOK AWAL (sesuai fisik hari ini), stok minimum
      → Stok awal diisi SEKALI sebagai titik mulai
      → Setelah itu sistem update otomatis:
         + Masuk: setiap nota belanja dikonfirmasi
         - Keluar: setiap /serah dikonfirmasi (via BOM)
         - Keluar: waste/spoilage input manual
      → Jika stok tidak cocok fisik kapanpun: Web → Stok → [Koreksi Stok]
      → ⚠️ BISA TAMBAH bahan baru kapan saja dari Web → Settings → Bahan

   d. Resep / BOM — input beberapa menu yang paling sering dipakai
      → "Nasi Ayam Fillet" = 150g beras + 100g ayam + 10g minyak
      → Tidak perlu lengkap semua menu sekarang
      → ⚠️ BOM ADALAH LIBRARY yang terus berkembang:
         Saat input menu mingguan → ada menu baru yang belum ada BOM-nya
         → Bot otomatis tanya: "Input BOM sekarang?" atau "Pakai perkiraan?"
         → Lama-lama library BOM makin lengkap sendiri
      → Edit BOM kapan saja: Web → Settings → Resep/BOM

3. Hubungkan Telegram
   → Web tampilkan kode unik → ketik /start [kode] di bot → terhubung
   → Tambah user lain: assign role kasir/admin/viewer

4. Atur alokasi MBG (opsional — ada nilai default)
   → price_per_portion (default Rp 15.000)
   → food_per_portion (default Rp 10.000 / 80%)
   → labor_per_portion (default Rp 2.250 / 15%)
   → ops_per_portion (default Rp 2.750 / 5%)
   → Bisa diubah kapan saja: Web → Settings → Alokasi MBG

5. Selesai — bot siap digunakan
```

---

### 📋 FASE 1 — Perencanaan Menu Mingguan
**Platform: Telegram**
**Frekuensi: Sekali seminggu (tiap akhir pekan / sebelum minggu berjalan)**
**Siapa: Pemilik atau Admin**

```
Buka bot → ketik /menu atau klik [📅 Atur Menu Minggu Ini]

Bot tampilkan form input 1 minggu penuh:
┌─────────────────────────────────────────┐
│ 📅 INPUT MENU MINGGU INI                │
│ Periode: Senin 10 Feb — Sabtu 15 Feb    │
│                                         │
│ Senin   10 Feb: [belum diisi]           │
│ Selasa  11 Feb: [belum diisi]           │
│ Rabu    12 Feb: [belum diisi]           │
│ Kamis   13 Feb: [belum diisi]           │
│ Jumat   14 Feb: [belum diisi]           │
│ Sabtu   15 Feb: [belum diisi] (opsional)│
└─────────────────────────────────────────┘

Pemilik klik hari → ketik nama menu
  "Nasi Ayam Fillet" → bot cek: ada BOM? Ya → konfirmasi
  "Menu baru?" → bot tanya: mau input BOM sekarang atau pakai perkiraan?

Setelah semua hari terisi:
[✅ Simpan Menu Minggu Ini] [✏️ Edit Lagi]

Kapan saja bisa edit:
  /menu → pilih hari → ganti menu → simpan
  (Perubahan real-time, langsung aktif untuk hari itu)
```

---

### ☀️ FASE 2 — Operasional Harian
**Platform: Telegram sepenuhnya**

#### Pagi — Belanja Bahan (Kasir atau Pemilik)

```
Setelah belanja di pasar/supplier, buka bot:

Opsi A — Foto nota (paling sering):
  Kirim 1-5 foto nota sekaligus ke bot
  → Bot: "3 foto diterima. [✅ Selesai Kirim] [➕ Tambah Foto]"
  → Kasir klik Selesai → OCR berjalan paralel
  → Bot kirim ringkasan semua nota:
    "📄 Toko Budi: 5 item | Rp 350.000
     📄 Pasar Pagi: 3 item | Rp 120.000
     ⚠️ Harga Beras +35% dari biasanya
     [✅ Konfirmasi Semua] [📋 Review Per Nota] [❌ Batal]"
  → Konfirmasi → stok bertambah, pengeluaran tercatat

Opsi B — Input manual (tidak ada foto):
  /belanja → isi nama toko, item, qty, harga
  → Simpan → stok & pengeluaran tercatat
```

#### Siang — Konfirmasi Penyerahan MBG (Kasir atau Pemilik)

```
Setelah distribusi ke sekolah, buka bot:
/serah atau klik [🏫 Penyerahan Hari Ini]

Bot tampilkan:
┌──────────────────────────────────────────┐
│ 🍱 Selasa 11 Feb                         │
│ Menu: Nasi Ayam Fillet                   │
│                                          │
│ SDN 01 Kudus     → 300 porsi             │
│ SDN 02 Kudus     → 250 porsi             │
│ SMP 01 Kudus     → 200 porsi             │
│ ─────────────────────────────            │
│ Total: 750 porsi | Rp 11.250.000         │
│                                          │
│ [✅ Semua Sesuai] [✏️ Ada Perubahan]      │
└──────────────────────────────────────────┘

Jika ada perubahan → edit porsi per sekolah → konfirmasi
Jika stok kurang → bot tampilkan: "❌ Beras kurang 15kg, Minyak kurang 2.5kg"

Setelah konfirmasi:
→ Bot tanya kondisi: [✅ Semua Layak] [📝 Ada Catatan]
→ Simpan → sistem otomatis:
  ✓ Potong stok bahan via BOM (atomic)
  ✓ Generate nota penjualan MBG (PDF) — auto-draft, bisa diedit di web
  ✓ Catat piutang ke pemerintah (gross - PPh22)
  ✓ Hitung alokasi 80:15:5 hari ini
  ✓ Data masuk laporan harian
```

#### Cek Cepat (Kapan Saja)

```
/summary → ringkasan hari ini: porsi, pendapatan, pengeluaran
/stok    → bahan yang hampir habis (di bawah minimum)
/tagihan → hutang supplier yang mau jatuh tempo
```

---

### 🌐 FASE 3 — Monitoring & Analitik
**Platform: Web**
**Frekuensi: Pemilik buka kapan perlu, tidak harus tiap hari**

Web dashboard punya 6 menu utama:

```
1. PEMBUKUAN
   ├── Ringkasan: pendapatan, pengeluaran, laba bersih (real-time)
   ├── Semua transaksi dengan filter tanggal/kategori
   └── Grafik laba per periode

2. HUTANG & PIUTANG
   ├── Piutang MBG ke pemerintah (status: belum cair / sudah cair)
   ├── Hutang ke supplier (status: belum bayar / sudah bayar)
   ├── Aging schedule (current / 1-30 hari / 31-60 hari / >60 hari)
   └── Rekonsiliasi PPh 22 & PPN (otomatis dari data transaksi)

3. STOK GUDANG
   ├── Posisi stok semua bahan baku real-time
   ├── Alert merah: stok di bawah minimum
   ├── Proyeksi: stok cukup untuk berapa hari ke depan (berdasarkan BOM + menu)
   └── Riwayat pergerakan stok per bahan

4. AI JADWAL
   ├── AI buat draft jadwal pengiriman minggu depan
   │   (berdasarkan: menu terpilih + jam distribusi historis per sekolah)
   ├── Pemilik review draft → approve / edit per hari
   └── Jadwal final tersimpan, jadi acuan konfirmasi harian kasir

5. TRACK KENAIKAN HARGA
   ├── Grafik harga per bahan baku (1 bulan / 3 bulan / 1 tahun)
   ├── Perbandingan harga bahan yang sama antar supplier
   ├── AI insight otomatis:
   │   "🔴 Beras naik 12% bulan ini vs rata-rata 3 bulan lalu.
   │    CV Makmur jual Rp 13.500/kg vs Toko Budi Rp 14.200/kg.
   │    Pertimbangkan beralih ke CV Makmur."
   └── History harga dari semua nota yang pernah di-OCR

6. LAPORAN & EXPORT
   ├── Generate laporan harian / mingguan / per periode
   ├── Format: JSON internal → inject ke template Excel pemerintah
   ├── Preview data di web sebelum download
   └── Download Excel → siap kirim ke dinas
```

---

### 📊 FASE 4 — Generate Laporan ke Dinas
**Platform: Web**

```
Klik [📊 Generate Laporan] → pilih periode → Preview

Excel otomatis berisi 5 bagian (sesuai standar dinas):

Bagian 1 — IDENTITAS & HEADER SPPG
  Nama SPPG, ID SPPG, alamat, nama PJ, tanggal pelaksanaan, ID Menu

Bagian 2 — LOGISTIK & DISTRIBUSI
  Per sekolah: waktu kirim, waktu tiba, porsi terkirim, porsi diterima,
  kondisi makanan (Layak/Tidak), kondisi kemasan (Baik/Terbuka),
  nama penerima, TTD penerima (link foto)

Bagian 3 — KOMPOSISI BIAYA (80:15:5)
  Bahan Pangan 80%: rincian per bahan (Beras 50kg × Rp 14.000 = ...)
  Upah Masak 15%: total biaya tenaga kerja
  Operasional 5%: sewa, listrik, gas, ATK, margin

Bagian 4 — DETAIL BAHAN BAKU & PAJAK
  Daftar supplier, per nota: item, qty, harga, PPN (jika PKP),
  link foto nota digital (dari OCR), PPh 22 rekonsiliasi otomatis

Bagian 5 — EVALUASI GIZI & SAMPEL
  Catatan sampel diambil (1 porsi), metode penyajian
  (Wadah Reusable / Kardus / Daun)

Klik [⬇️ Download Excel] → file siap kirim ke dinas
Tidak perlu buka Excel manual, tidak perlu ketik apapun.
```

---

### 🔔 FASE 5 — Notifikasi Otomatis (Background)
**Platform: Telegram, tanpa tindakan dari user**

```
Bot kirim otomatis:
├── ⚠️ Stok [nama bahan] hampir habis (di bawah minimum)
├── 💸 Hutang ke [supplier] jatuh tempo H-3 dan H-1
├── 💸 Hutang belum dibayar H+1 → status: overdue
├── 💰 Piutang MBG belum cair melewati estimasi
└── 📊 Ringkasan mingguan setiap Jumat sore:
    total porsi, total pendapatan, laba estimasi, alert penting
```

---

### ⏱️ Estimasi Waktu Harian untuk Pemilik/Kasir

| Aktivitas | Waktu |
|---|---|
| Foto nota belanja (3-5 nota) | ~2 menit |
| Konfirmasi penyerahan MBG | ~1 menit |
| Cek summary harian (opsional) | ~30 detik |
| **Total input harian** | **~3-4 menit** |
| Review dashboard web (opsional, tidak tiap hari) | ~5 menit |
| Generate laporan ke dinas | ~2 menit |

---

## 4. ARSITEKTUR MULTI-TENANT

Setiap SPPG/catering = 1 tenant. Isolasi via tenant_id + RLS Supabase di semua tabel.

  Tenant A (SPPG Ibu Sri)    ─┐
  Tenant B (Catering Pak Budi)─┼──→ Supabase DB (RLS per tenant_id)
  Tenant C (SPPG Wilayah Timur)─┘

User roles per tenant:
| Role    | Izin                                                                    |
|---------|-------------------------------------------------------------------------|
| owner   | Akses penuh + closing period + hapus data + audit log                   |
| admin   | Input transaksi, laporan, export, kelola produk/resep/sekolah           |
| kasir   | Input transaksi & penyerahan harian saja (create only)                  |
| viewer  | Read-only laporan                                                       |

---

## 4. STRUKTUR DATABASE (Supabase PostgreSQL)

Aturan tipe data (WAJIB konsisten):
- DECIMAL(15,2) → semua field UANG/HARGA (hpp, sell_price, total, amount, dst.)
- DECIMAL(15,3) → semua field KUANTITAS/STOK (qty, stock_qty, change_qty, dst.)
- Jangan pakai FLOAT — presisi finansial wajib fixed-point.

### 4.1 Tabel Inti

```sql
-- TENANTS
tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  owner_email   TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  business_type TEXT DEFAULT 'catering',    -- catering / mbg / both
  plan          TEXT DEFAULT 'free',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- USERS
users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  telegram_id   BIGINT UNIQUE,
  email         TEXT UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT DEFAULT 'kasir',        -- owner / admin / kasir / viewer
  session_token TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- SUPPLIERS
suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  alias_names   TEXT[],                      -- ["Pak Budi", "Toko Budi Jaya"]
  phone         TEXT,
  address       TEXT,
  category      TEXT,                        -- sembako / bumbu / packaging / jasa
  is_pkp        BOOLEAN DEFAULT false,       -- TRUE = supplier PKP, ada PPN di nota
  is_active     BOOLEAN DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
)

-- PRODUCTS
products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sku           TEXT,
  category      TEXT,                        -- bahan_baku / produk_jadi / packaging
  unit          TEXT DEFAULT 'pcs',
  hpp           DECIMAL(15,2) DEFAULT 0,     -- [UANG]
  sell_price    DECIMAL(15,2) DEFAULT 0,     -- [UANG]
  stock_qty     DECIMAL(15,3) DEFAULT 0,     -- [QTY]
  stock_min     DECIMAL(15,3) DEFAULT 0,     -- [QTY] alert jika di bawah ini
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- PHOTO_BATCHES (grup foto nota dalam satu sesi kirim — untuk upload multiple)
-- Kasir bisa kirim 3-5 foto sekaligus, satu batch = satu sesi belanja
photo_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  status        TEXT DEFAULT 'collecting',
  -- collecting  = bot masih menunggu foto berikutnya (user belum klik Selesai)
  -- processing  = semua foto sudah dikumpulkan, OCR worker sedang berjalan
  -- pending_confirm = OCR selesai, menunggu konfirmasi user
  -- confirmed   = user sudah konfirmasi semua nota
  -- partial     = sebagian dikonfirmasi, sebagian dibatalkan
  total_photos  INTEGER DEFAULT 0,          -- jumlah foto yang dikirim
  processed_photos INTEGER DEFAULT 0,       -- jumlah foto yang sudah di-OCR
  collection_timeout TIMESTAMPTZ,           -- batas waktu kumpulkan foto (5 menit)
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- TRANSACTIONS
transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  supplier_id   UUID REFERENCES suppliers(id),   -- nullable
  period_id     UUID REFERENCES periods(id),     -- nullable
  batch_id      UUID REFERENCES photo_batches(id), -- nullable, diisi jika dari foto batch
  type          TEXT NOT NULL,                   -- income / expense / purchase
  source        TEXT DEFAULT 'manual',
  -- manual / telegram_photo / telegram_photo_batch / telegram_manual / mbg_delivery
  ref_number    TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal      DECIMAL(15,2) DEFAULT 0,         -- [UANG] sebelum pajak
  ppn_amount    DECIMAL(15,2) DEFAULT 0,         -- [UANG] PPN dari supplier PKP
  pph22_amount  DECIMAL(15,2) DEFAULT 0,         -- [UANG] PPh22 dipotong pemerintah
  discount      DECIMAL(15,2) DEFAULT 0,         -- [UANG]
  total         DECIMAL(15,2) NOT NULL,          -- [UANG] final
  notes         TEXT,
  photo_url     TEXT,
  pdf_url       TEXT,                            -- URL PDF nota yang di-generate
  status        TEXT DEFAULT 'confirmed',        -- pending / confirmed / voided
  is_locked     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- TRANSACTION ITEMS
transaction_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID REFERENCES transactions(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id),
  product_id      UUID REFERENCES products(id),
  product_name    TEXT NOT NULL,
  qty             DECIMAL(15,3) NOT NULL,    -- [QTY]
  unit            TEXT,
  price           DECIMAL(15,2) NOT NULL,    -- [UANG]
  hpp_snapshot    DECIMAL(15,2),             -- [UANG] WAJIB diisi
  has_ppn         BOOLEAN DEFAULT false,     -- TRUE jika item kena PPN supplier PKP
  subtotal        DECIMAL(15,2) NOT NULL,    -- [UANG]
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

### 4.2 Tabel Stok & Harga

```sql
-- STOCK HISTORY (immutable — jangan pernah UPDATE/DELETE)
stock_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  product_id      UUID REFERENCES products(id),
  transaction_id  UUID REFERENCES transactions(id),
  change_qty      DECIMAL(15,3) NOT NULL,  -- [QTY] positif=masuk, negatif=keluar
  balance_after   DECIMAL(15,3) NOT NULL,  -- [QTY]
  reason          TEXT,                    -- purchase/sale/production/adjustment/spoilage/waste
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- PRICE HISTORY (otomatis via trigger)
price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  product_id      UUID REFERENCES products(id),
  price_type      TEXT NOT NULL,             -- hpp / sell_price
  old_price       DECIMAL(15,2),             -- [UANG]
  new_price       DECIMAL(15,2) NOT NULL,    -- [UANG]
  changed_by      UUID REFERENCES users(id),
  effective_date  DATE DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

### 4.3 Tabel Keuangan

```sql
-- RECEIVABLES (piutang)
receivables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  transaction_id  UUID REFERENCES transactions(id),
  party_name      TEXT NOT NULL,
  party_type      TEXT DEFAULT 'customer',   -- customer / mbg_gov / other
  amount          DECIMAL(15,2) NOT NULL,    -- [UANG] tagihan sebelum PPh22
  pph22_amount    DECIMAL(15,2) DEFAULT 0,   -- [UANG] PPh22 dipotong pemerintah
  paid_amount     DECIMAL(15,2) DEFAULT 0,   -- [UANG]
  -- ⚠️ GENERATED COLUMN: test di Modul 1 bersama RLS
  remaining       DECIMAL(15,2) GENERATED ALWAYS AS (amount - pph22_amount - paid_amount) STORED,
  due_date        DATE,
  status          TEXT DEFAULT 'unpaid',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- PAYABLES (hutang)
payables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  supplier_id     UUID REFERENCES suppliers(id),
  transaction_id  UUID REFERENCES transactions(id),
  supplier_name   TEXT NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,    -- [UANG]
  paid_amount     DECIMAL(15,2) DEFAULT 0,   -- [UANG]
  -- ⚠️ GENERATED COLUMN: test di Modul 1
  remaining       DECIMAL(15,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
  due_date        DATE,
  status          TEXT DEFAULT 'unpaid',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- CASHFLOW LOG
cashflow_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  transaction_id  UUID REFERENCES transactions(id),
  flow_type       TEXT NOT NULL,             -- in / out
  category        TEXT,
  amount          DECIMAL(15,2) NOT NULL,    -- [UANG]
  description     TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

### 4.4 Tabel MBG Khusus (BARU v1.3)

```sql
-- MBG_SCHOOLS
mbg_schools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  pic_name        TEXT,
  pic_phone       TEXT,
  default_portion INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
)

-- MBG_WEEKLY_MENUS
mbg_weekly_menus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,             -- Senin awal minggu
  day_of_week     INTEGER NOT NULL,          -- 1=Senin ... 6=Sabtu
  menu_id         UUID REFERENCES products(id),
  menu_name       TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, week_start, day_of_week)
)

-- MBG_DELIVERIES
mbg_deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE,
  school_id             UUID REFERENCES mbg_schools(id),
  transaction_id        UUID REFERENCES transactions(id),
  menu_id               UUID REFERENCES products(id),
  menu_name             TEXT NOT NULL,
  delivery_date         DATE NOT NULL,
  sent_time             TIME,
  arrival_time          TIME,
  portions_sent         INTEGER NOT NULL,
  portions_received     INTEGER,
  food_condition        TEXT DEFAULT 'layak',          -- layak / tidak_layak
  packaging_condition   TEXT DEFAULT 'baik',           -- baik / terbuka / rusak
  packaging_type        TEXT DEFAULT 'wadah_reusable', -- wadah_reusable / kardus / daun
  sample_taken          BOOLEAN DEFAULT true,
  recipient_name        TEXT,
  recipient_signature_url TEXT,
  photo_proof_url       TEXT,
  notes                 TEXT,
  is_locked             BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW()
)

-- MBG_ALLOCATION_SETTINGS (alokasi per porsi — fleksibel per tenant)
-- Bukan validasi — patokan umum. Total tidak harus = price_per_portion.
-- Beberapa SPPG punya tarif berbeda dari Rp 15.000.
mbg_allocation_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  price_per_portion   DECIMAL(15,2) DEFAULT 15000, -- [UANG] tarif per porsi (patokan)
  food_per_portion    DECIMAL(15,2) DEFAULT 10000, -- [UANG] alokasi bahan per porsi
  labor_per_portion   DECIMAL(15,2) DEFAULT 2250,  -- [UANG] alokasi upah per porsi
  ops_per_portion     DECIMAL(15,2) DEFAULT 2750,  -- [UANG] alokasi ops per porsi
  -- TIDAK ada constraint total = price_per_portion (fleksibel)
  effective_date      DATE DEFAULT CURRENT_DATE,   -- berlaku mulai kapan
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
)

-- MBG_BUDGET_ALLOCATIONS (realisasi harian — dihitung dari settings di atas)
mbg_budget_allocations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  total_portions      INTEGER NOT NULL,
  price_per_portion   DECIMAL(15,2) NOT NULL,  -- [UANG] snapshot dari settings hari itu
  total_revenue       DECIMAL(15,2) NOT NULL,  -- [UANG] porsi × price_per_portion
  pph22_deduction     DECIMAL(15,2) DEFAULT 0, -- [UANG] dipotong pemerintah
  net_revenue         DECIMAL(15,2),           -- [UANG] total - pph22
  -- Budget (per porsi × total porsi — dari settings)
  budget_food         DECIMAL(15,2),           -- [UANG]
  budget_labor        DECIMAL(15,2),           -- [UANG]
  budget_ops          DECIMAL(15,2),           -- [UANG]
  -- Realisasi aktual
  actual_food_cost    DECIMAL(15,2) DEFAULT 0, -- [UANG] dari nota belanja hari itu
  actual_labor_cost   DECIMAL(15,2) DEFAULT 0, -- [UANG] otomatis labor_per_portion × porsi
  actual_ops_cost     DECIMAL(15,2) DEFAULT 0, -- [UANG] otomatis ops_per_portion × porsi
  net_profit          DECIMAL(15,2),           -- [UANG]
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
)

-- EXCEL_FILES (tracking file Excel per bulan per tenant)
excel_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL,            -- 1-12
  file_url        TEXT NOT NULL,               -- URL di Supabase Storage
  last_updated    TIMESTAMPTZ DEFAULT NOW(),   -- kapan terakhir di-regenerate
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, year, month)
  -- Path: /{tenant_id}/excel/{YYYY}/{MM}/pembukuan.xlsx
)
```

### 4.5 Tabel Resep, Alias & Periode

```sql
-- RECIPES / BOM
recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  menu_id         UUID REFERENCES products(id),
  ingredient_id   UUID REFERENCES products(id),
  qty_needed      DECIMAL(15,3) NOT NULL,    -- [QTY] per 1 porsi
  unit            TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, menu_id, ingredient_id)
)

-- PRODUCT ALIASES
product_aliases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  alias_name      TEXT NOT NULL,
  source          TEXT DEFAULT 'manual',     -- manual / ai
  confidence      DECIMAL(3,2) DEFAULT 1.0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, alias_name)
)

-- PERIODS
-- status='open' boleh dihapus. status='locked' tidak bisa dihapus.
periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          TEXT DEFAULT 'open',       -- open / locked
  locked_by       UUID REFERENCES users(id),
  locked_at       TIMESTAMPTZ,
  report_url      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, start_date, end_date)
)
```

### 4.6 Tabel Validasi, Jadwal & Audit

```sql
-- NOTA VALIDATIONS
nota_validations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  transaction_id  UUID REFERENCES transactions(id),
  validator       TEXT DEFAULT 'ai',
  result          TEXT,                      -- valid / suspicious / invalid
  flags           JSONB,
  ai_raw          TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- SCHEDULES
schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  user_id         UUID REFERENCES users(id),
  type            TEXT NOT NULL,             -- customer_order/restock/payment/production/delivery/mbg_daily
  title           TEXT NOT NULL,
  customer_name   TEXT,
  description     TEXT,
  scheduled_date  DATE NOT NULL,
  scheduled_time  TIME,
  qty             DECIMAL(15,3),
  amount          DECIMAL(15,2),
  status          TEXT DEFAULT 'scheduled',
  reminder_sent   BOOLEAN DEFAULT false,
  linked_trx_id   UUID REFERENCES transactions(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- AUDIT LOG (immutable — jangan pernah hapus)
audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  user_id         UUID REFERENCES users(id),
  action          TEXT NOT NULL,
  resource        TEXT,
  resource_id     UUID,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 5. STRUKTUR FOLDER PROJECT

```
project-root/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   └── dependencies.py
│   ├── middleware/
│   │   ├── role_middleware.py
│   │   └── rate_limit_middleware.py
│   ├── models/
│   │   ├── transaction.py
│   │   ├── product.py
│   │   ├── recipe.py
│   │   ├── period.py
│   │   ├── supplier.py
│   │   ├── mbg.py               ← schools, weekly_menus, deliveries, budget_allocations
│   │   └── user.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── transactions.py
│   │   ├── products.py
│   │   ├── recipes.py
│   │   ├── aliases.py
│   │   ├── suppliers.py
│   │   ├── mbg_schools.py
│   │   ├── mbg_deliveries.py
│   │   ├── mbg_menus.py
│   │   ├── reports.py
│   │   ├── periods.py
│   │   ├── schedules.py
│   │   ├── cashflow.py
│   │   └── exports.py
│   ├── services/
│   │   ├── ocr_service.py       ← Gemini OCR + deteksi PPN
│   │   ├── alias_service.py
│   │   ├── recipe_service.py
│   │   ├── validation_service.py
│   │   ├── export_service.py    ← Excel 7-sheet format MBG
│   │   ├── pdf_service.py       ← Generate PDF nota (ref: nota_generator lama)
│   │   ├── mbg_service.py       ← Kalkulasi 80:15:5, PPh22, laporan harian
│   │   ├── notification_service.py
│   │   └── report_service.py
│   └── workers/
│       └── ocr_worker.py
│
├── bot/
│   ├── main.py
│   ├── handlers/
│   │   ├── start.py             ← /start, onboarding Telegram, hubungkan akun
│   │   ├── menu_handler.py      ← /menu, input menu mingguan Senin-Sabtu + edit
│   │   ├── belanja_handler.py   ← foto nota (batch OCR) + input manual belanja
│   │   ├── serah_handler.py     ← /serah, konfirmasi penyerahan MBG harian
│   │   ├── info_handler.py      ← /summary, /stok, /tagihan, ringkasan cepat
│   │   └── settings_handler.py  ← /settings, isi identitas SPPG via Telegram
│   ├── keyboards/
│   │   ├── main_menu.py         ← menu utama bot
│   │   ├── menu_mingguan.py     ← keyboard input 6 hari
│   │   ├── belanja_menu.py      ← keyboard konfirmasi nota
│   │   └── serah_menu.py        ← keyboard konfirmasi penyerahan
│   └── utils/
│       ├── api_client.py        ← httpx async ke FastAPI
│       ├── rate_limiter.py      ← throttle foto
│       └── formatter.py         ← format pesan Telegram
│
├── web/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (onboarding)/          ← setup awal: identitas, sekolah, supplier, BOM
│   │   │   ├── identitas/page.tsx
│   │   │   ├── sekolah/page.tsx
│   │   │   ├── supplier/page.tsx
│   │   │   ├── bahan-baku/page.tsx
│   │   │   └── resep-bom/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       ├── page.tsx           ← ringkasan hari ini
│   │       │
│   │       ├── pembukuan/         ← MENU 1: Pembukuan
│   │       │   ├── page.tsx       ← ringkasan + grafik laba
│   │       │   └── transaksi/page.tsx
│   │       │
│   │       ├── hutang-piutang/    ← MENU 2: Hutang & Piutang
│   │       │   ├── page.tsx       ← aging schedule
│   │       │   ├── piutang/page.tsx  ← MBG ke pemerintah
│   │       │   ├── hutang/page.tsx   ← ke supplier
│   │       │   └── pajak/page.tsx    ← rekonsiliasi PPh22 + PPN
│   │       │
│   │       ├── stok/              ← MENU 3: Stok Gudang
│   │       │   ├── page.tsx       ← posisi stok + alert merah
│   │       │   ├── proyeksi/page.tsx ← stok cukup berapa hari
│   │       │   └── riwayat/page.tsx
│   │       │
│   │       ├── ai-jadwal/         ← MENU 4: AI Jadwal
│   │       │   ├── page.tsx       ← draft jadwal AI + approve/edit
│   │       │   └── riwayat/page.tsx
│   │       │
│   │       ├── harga/             ← MENU 5: Track Kenaikan Harga
│   │       │   ├── page.tsx       ← grafik harga per bahan
│   │       │   ├── perbandingan/page.tsx ← antar supplier
│   │       │   └── insight/page.tsx      ← AI insight otomatis
│   │       │
│   │       └── laporan/           ← MENU 6: Laporan & Export
│   │           ├── page.tsx       ← preview laporan + generate
│   │           ├── harian/page.tsx
│   │           ├── mingguan/page.tsx
│   │           └── export/page.tsx ← download Excel template pemerintah
│   │
│   ├── components/
│   │   ├── ui/                    ← shadcn/ui
│   │   ├── charts/                ← recharts (laba, harga, stok)
│   │   ├── tables/
│   │   ├── ai/
│   │   │   ├── ScheduleDraft.tsx  ← tampilkan draft jadwal AI
│   │   │   └── PriceInsight.tsx   ← card insight harga AI
│   │   └── preview/
│   │       └── ExcelPreview.tsx   ← preview sebelum download
│   └── lib/
│       ├── api.ts
│       └── supabase.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_triggers.sql     ← price_history + audit_log + increment_stock fn
│   │   ├── 004_mbg_tables.sql
│   │   └── 005_seed_data.sql
│   └── functions/
│
└── docker-compose.yml
```

---

## 6. ROLE MIDDLEWARE — PERMISSION MATRIX

```python
def require_role(allowed_roles: list[str]):
    def checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Akses ditolak")
        return current_user
    return checker
```

| Endpoint                    | owner | admin | kasir | viewer |
|-----------------------------|:-----:|:-----:|:-----:|:------:|
| POST /transactions          |   ✓   |   ✓   |   ✓   |   ✗    |
| PUT /transactions/{id}      |   ✓   |   ✓   |   ✗   |   ✗    |
| DELETE /transactions/{id}   |   ✓   |   ✗   |   ✗   |   ✗    |
| POST /mbg/deliveries        |   ✓   |   ✓   |   ✓   |   ✗    |
| PUT /mbg/deliveries/{id}    |   ✓   |   ✓   |   ✗   |   ✗    |
| POST /mbg/weekly-menus      |   ✓   |   ✓   |   ✗   |   ✗    |
| POST /periods/{id}/lock     |   ✓   |   ✗   |   ✗   |   ✗    |
| DELETE /periods/{id}        |   ✓   |   ✗   |   ✗   |   ✗    |
| POST /exports/*             |   ✓   |   ✓   |   ✗   |   ✗    |
| DELETE /products/{id}       |   ✓   |   ✗   |   ✗   |   ✗    |
| GET /reports/*              |   ✓   |   ✓   |   ✗   |   ✓    |
| GET /audit-log              |   ✓   |   ✗   |   ✗   |   ✗    |
| POST /mbg/schools           |   ✓   |   ✓   |   ✗   |   ✗    |
| DELETE /suppliers/{id}      |   ✓   |   ✗   |   ✗   |   ✗    |

---

## 7. SISTEM ANTRIAN OCR (Redis Queue)

### 7.1 Upload Foto MULTIPLE (Batch Mode)

Kasir bisa kirim 3-5 foto nota sekaligus dalam satu sesi. Setiap foto diproses paralel
oleh worker, hasilnya dikumpulkan lalu ditampilkan sekaligus untuk dikonfirmasi.

```
Kasir kirim foto 1 ─┐
Kasir kirim foto 2 ─┤  (dalam 5 menit = satu sesi batch)
Kasir kirim foto 3 ─┘
         │
Bot reply foto pertama: "📸 Foto 1 diterima. Kirim foto lagi atau klik [Selesai Kirim]"
Bot reply foto kedua:   "📸 Foto 2 diterima. Total: 2 foto."
Bot reply foto ketiga:  "📸 Foto 3 diterima. Total: 3 foto. [Selesai Kirim]"
         │
Kasir klik [Selesai Kirim]  ─── ATAU timeout 5 menit otomatis
         │
   Buat photo_batches (status=processing)
   Push 3 job paralel ke Redis Queue
         │
   ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
   │ Worker #1  │  │ Worker #2  │  │ Worker #3  │
   │  Foto 1    │  │  Foto 2    │  │  Foto 3    │
   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
         │               │               │
   OCR + alias    OCR + alias    OCR + alias
   + validasi     + validasi     + validasi
         │               │               │
         └───────────────┴───────────────┘
                         │
              Semua job selesai?
              UPDATE batch status=pending_confirm
                         │
Bot kirim ringkasan semua nota:
"✅ 3 nota selesai diproses:
 📄 Nota 1 — Toko Budi: 5 item | Rp 350.000 | ⚠️ PPN Rp 38.500
 📄 Nota 2 — Pasar Pagi: 3 item | Rp 120.000
 📄 Nota 3 — CV Makmur: 2 item | Rp 85.000 | ⚠️ Harga Beras +35%
 Total: Rp 555.000

 [✅ Konfirmasi Semua] [📋 Review Per Nota] [❌ Batal Semua]"
```

**State machine `photo_batches.status`:**
```
collecting → processing → pending_confirm → confirmed
                                         → partial (sebagian dikonfirmasi)
```

**Timeout handling:**
- Jika kasir tidak klik "Selesai" dalam 5 menit → batch otomatis diproses
- Jika worker gagal setelah 3x retry → nota itu status=failed, lainnya tetap jalan
- Bot notif: "⚠️ 1 foto gagal diproses. 2 foto lainnya berhasil."

### 7.2 Rate Limiting (2 Lapisan)

```python
# Lapisan 1 — FastAPI (per foto)
async def photo_rate_limit(request: Request):
    key = f"rate:photo:{request.state.user.id}"
    count = redis_conn.incr(key)
    if count == 1:
        redis_conn.expire(key, 60)
    if count > 10:  # maks 10 foto/menit/user
        raise HTTPException(status_code=429, detail="Terlalu banyak foto. Coba 1 menit lagi.")

# Lapisan 2 — Bot (rate_limiter.py)
# Delay minimum 2 detik antar foto dalam satu batch (bukan 6 detik — batch mode lebih longgar)
# Jika user bukan dalam sesi batch dan < 6 detik dari foto sebelumnya → tolak
```

### 7.3 Prompt Gemini OCR (Lengkap — semua field dari nota)

```
Ekstrak SEMUA data dari foto nota/struk belanja ini.
Return HANYA JSON valid tanpa teks lain:
{
  "nama_toko": "nama toko/supplier asli dari nota atau null",
  "alamat_toko": "alamat toko jika ada di nota atau null",
  "no_telp_toko": "nomor telepon toko jika ada atau null",
  "tanggal": "YYYY-MM-DD atau null",
  "no_nota": "nomor faktur/struk/invoice atau null",
  "kasir": "nama kasir/pegawai jika ada atau null",
  "is_pkp": false,
  "payment_method": "tunai/transfer/hutang atau null",
  "payment_status": "lunas/belum_lunas/cicil atau null",
  "due_date": "YYYY-MM-DD atau null",
  "items": [
    {
      "nama_item": "nama item PERSIS seperti di nota — jangan terjemahkan",
      "qty": 1.0,
      "satuan": "kg/liter/pcs/gram/ikat/buah/pack/dus/dll",
      "harga_satuan": 0,
      "subtotal": 0,
      "has_ppn": false,
      "kategori": "bahan_pangan/kemasan/operasional/alat_tulis/lainnya"
    }
  ],
  "subtotal_nota": 0,
  "diskon": 0,
  "ppn_amount": 0,
  "total": 0,
  "catatan": null,
  "ocr_confidence": 0.95,
  "unclear_items": ["nama item yang tidak terbaca jelas"]
}

Aturan wajib:
- Harga dalam angka bulat tanpa titik/koma ribuan (12000 bukan 12.000)
- nama_item: tulis PERSIS seperti di nota, jangan ubah ejaan atau terjemahkan
- satuan: tulis satuan yang tertera, jika tidak ada tulis "pcs"
- harga_satuan: harga per 1 satuan. Jika di nota hanya ada subtotal dan qty,
  hitung: harga_satuan = subtotal / qty
- is_pkp: true jika ada NPWP, Faktur Pajak, nomor FP, atau kop pajak di nota
- kategori: tentukan sendiri berdasarkan nama item
  bahan_pangan = beras, ayam, sayur, minyak, bumbu, dll
  kemasan = plastik, dus, wadah, dll
  operasional = gas, listrik, bensin, sewa, dll
  alat_tulis = kertas, pulpen, ATK, dll
  lainnya = yang tidak masuk kategori di atas
- ocr_confidence: 0.0-1.0, turunkan jika foto buram/miring/sebagian terpotong
- unclear_items: isi nama item yang tulisannya tidak jelas terbaca
- Jika field tidak ada di nota: isi null, JANGAN tebak atau karang
```

### 7.4 Update Stok — Wajib Atomic

```python
# ✅ BENAR — aman concurrent workers
async def update_stock_atomic(product_id: str, delta: Decimal, tenant_id: str):
    await supabase.rpc("increment_stock", {
        "p_product_id": product_id, "p_delta": float(delta), "p_tenant_id": tenant_id
    }).execute()

# PostgreSQL function (migrations/003_triggers.sql):
# CREATE OR REPLACE FUNCTION increment_stock(
#   p_product_id UUID, p_delta NUMERIC, p_tenant_id UUID
# ) RETURNS NUMERIC AS $$
# BEGIN
#   UPDATE products SET stock_qty = stock_qty + p_delta
#   WHERE id = p_product_id AND tenant_id = p_tenant_id;
#   RETURN (SELECT stock_qty FROM products WHERE id = p_product_id);
# END;
# $$ LANGUAGE plpgsql;

# ❌ SALAH — bisa lost update jika concurrent
# UPDATE products SET stock_qty = nilai_baru WHERE id = product_id
```

---

## 8. ALUR INPUT DISEDERHANAKAN (BOT) + ERROR HANDLING

### 8.1 Scan Nota Belanja via Foto (Single atau Batch)

**Single foto (1 nota):**
```
1. User kirim foto → bot reply: "📸 Foto diterima. Kirim lagi untuk batch, atau tunggu hasil."
2. OCR selesai → bot kirim ringkasan:
   "✅ Toko Budi | 5 item | Rp 350.000
    [Konfirmasi] [Edit Item] [Batal]"
3. Konfirmasi → stok atomic + cashflow_log
```

**Multi foto (batch):**
Lihat alur lengkap di Bagian 7.1.

**Error handling OCR:**
```
❌ Foto buram / tidak terbaca:
   Bot: "📷 Foto kurang jelas. Coba foto ulang dengan pencahayaan lebih baik."
   → Nota status=failed, batch tetap jalan

❌ Duplikat nota (ref_number + supplier + total sama):
   Bot: "⚠️ Nota ini sepertinya sudah pernah diinput (No. BDI-2024-001 tgl 3 Feb).
         Tetap simpan atau abaikan?"
   [Simpan Tetap] [Abaikan]

❌ Total tidak cocok (sum(items) ≠ total_final):
   Bot: "⚠️ Total tidak cocok. AI baca Rp 348.500, total di nota Rp 350.000.
         [Pakai Total Nota] [Pakai Total AI] [Edit Manual]"
```

### 8.2 Penyerahan Harian MBG (maks 3 langkah)

```
Langkah 1: Bot tampilkan menu hari ini + daftar sekolah + quota default
───────────────────────────────────────────────────────
  🍱 Penyerahan Hari Ini — Selasa 4 Feb
  Menu: Nasi Ayam Fillet
  ─────────────────────
  SDN 01 Kudus      [300 porsi]
  SDN 02 Kudus      [250 porsi]
  SMP 01 Kudus      [200 porsi]
  ─────────────────────
  Total: 750 porsi | Rp 11.250.000
  [✅ Semua Sesuai Quota] [✏️ Ubah Jumlah]
───────────────────────────────────────────────────────

Langkah 2 (hanya jika pilih "Ubah Jumlah"):
  Bot tampilkan setiap sekolah satu per satu:
  "SDN 01 Kudus — berapa porsi hari ini?" [300] [Ketik manual]

Langkah 3: Konfirmasi kondisi + simpan
  [✅ Semua Layak & Baik] [📝 Ada Catatan]
  → Simpan → potong stok BOM atomic + buat receivable + hitung 80:15:5
```

**Error handling penyerahan MBG:**
```
❌ Stok bahan kurang saat konfirmasi:
   Bot: "❌ Gagal! Stok tidak cukup untuk 750 porsi Nasi Ayam Fillet:
         • Beras: butuh 75kg, stok 60kg (kurang 15kg)
         • Minyak: butuh 7.5kg, stok 5kg (kurang 2.5kg)

         Opsi:
         [🔄 Ubah Jumlah Porsi] [📋 Lihat Semua Kekurangan] [❌ Batal]"

❌ Menu hari ini belum diset di weekly_menus:
   Bot: "⚠️ Menu untuk Selasa 4 Feb belum diatur.
         Hubungi admin untuk set jadwal menu mingguan."

❌ Sekolah tidak aktif / tidak ditemukan:
   Bot: "⚠️ SDN 03 tidak ditemukan di daftar sekolah aktif.
         Hubungi admin untuk tambah/aktifkan sekolah."

❌ Sudah ada delivery hari ini untuk sekolah yang sama:
   Bot: "⚠️ Penyerahan ke SDN 01 Kudus hari ini sudah tercatat (300 porsi).
         [Lihat Data] [Timpa Data Lama] [Batal]"
```

**Sinkronisasi otomatis setelah konfirmasi penyerahan:**
```python
# services/mbg_service.py — dipanggil saat delivery dikonfirmasi
async def confirm_delivery(delivery_data, tenant_id):

    # 1. Potong stok bahan via BOM (atomic per ingredient)
    bom_items = recipe_service.calculate(menu_id, total_portions)
    for item in bom_items:
        await update_stock_atomic(item.ingredient_id, -item.qty_needed, tenant_id)
        await create_stock_history(reason="mbg_production", ...)

    # 2. Buat mbg_deliveries record per sekolah
    for school in schools:
        await create_mbg_delivery(school_id, portions, ...)

    # 3. Buat transaksi income
    transaction = await create_transaction(type="income", source="mbg_delivery", ...)

    # 4. ⚠️ WAJIB: Buat piutang ke pemerintah (receivable)
    await create_receivable(
        party_name   = "Pemerintah / BPGM",
        party_type   = "mbg_gov",
        amount       = gross_revenue,        # sebelum PPh 22
        pph22_amount = pph22_total,          # yang akan dipotong
        net_amount   = net_revenue,          # yang benar-benar diterima
        due_date     = today + 14 days,      # estimasi pencairan
        transaction_id = transaction.id
    )

    # 5. Hitung dan simpan alokasi 80:15:5
    await create_budget_allocation(delivery_date, total_portions, gross_revenue, ...)

    # 6. Catat cashflow
    await create_cashflow_log(
        flow_type="in", category="mbg_payment",
        amount=net_revenue, description=f"MBG {delivery_date} — {total_portions} porsi"
    )

    # 7. Audit log
    await create_audit_log(action="mbg_delivery_confirm", ...)
```

### 8.3 Input Nota Penjualan Non-MBG (maks 3 langkah)

```
Langkah 1: Bot tampilkan menu hari ini sebagai tombol (dari weekly_menus)
           + tombol [🔍 Cari Menu Lain] untuk menu di luar jadwal
           Harga otomatis dari master produk

Langkah 2: Input qty → bot hitung total otomatis
           "Nasi Goreng × 50 = Rp 500.000"
           [💵 Tunai] [🏦 Transfer] [📋 Hutang/Kredit]

Langkah 3: Konfirmasi → generate PDF nota → kirim ke chat
```

**Error handling penjualan:**
```
❌ Produk tidak ditemukan di master:
   Bot: "Menu 'Gado-gado' belum ada di sistem.
         [➕ Tambah sebagai produk baru] [🔍 Cari nama lain] [❌ Batal]"

❌ Stok produk jadi habis:
   Bot: "⚠️ Stok Nasi Goreng: 0 porsi.
         Tetap catat penjualan? [Ya] [Tidak]"
```

---

## 9. KALKULASI & LAPORAN MBG

### 9.1 Kalkulasi Anggaran per Hari (Fleksibel)

> Alokasi diambil dari `mbg_allocation_settings` tenant, bukan hardcode.
> Tidak ada validasi total harus = Rp 15.000 — patokan umum saja.

```
Ambil settings tenant:
  price_per_portion  = mbg_allocation_settings.price_per_portion  (default 15.000)
  food_per_portion   = mbg_allocation_settings.food_per_portion   (default 10.000)
  labor_per_portion  = mbg_allocation_settings.labor_per_portion  (default 2.250)
  ops_per_portion    = mbg_allocation_settings.ops_per_portion    (default 2.750)

Total Porsi       = SUM(mbg_deliveries.portions_sent) WHERE date = hari_ini
Total Pendapatan  = Total Porsi × price_per_portion
PPh 22            = Total Pendapatan × MBG_PPH22_RATE (dari ENV, default 1.5%)
Pendapatan Bersih = Total Pendapatan - PPh 22

Budget Bahan      = Total Porsi × food_per_portion
Budget Upah       = Total Porsi × labor_per_portion   (juga = realisasi otomatis)
Budget Ops        = Total Porsi × ops_per_portion     (juga = realisasi otomatis)

Realisasi Bahan   = SUM(transaction_items.subtotal) WHERE category=bahan_pangan, date=hari_ini
                    (dari semua nota belanja yang dikonfirmasi hari itu)
Selisih Bahan     = Budget Bahan - Realisasi Bahan  (positif=hemat, negatif=over)

Laba Bersih       = Pendapatan Bersih
                    - Realisasi Bahan
                    - Budget Upah      (otomatis dari porsi × tarif)
                    - Budget Ops       (otomatis dari porsi × tarif)
```

### 9.2 Pengurangan Stok — 2 Sumber

```
Sumber 1: Konfirmasi /serah
  → Stok BERKURANG via BOM
  → qty_needed per porsi × total porsi = total bahan terpakai
  → Dicatat di stock_history (reason=mbg_production)

Sumber 2: Nota belanja masuk (foto atau manual)
  → Stok BERTAMBAH
  → Dicatat di stock_history (reason=purchase)

Catatan: Menu custom (non-BOM) juga mengurangi stok
  → Jika BOM tidak ada, sistem pakai perkiraan atau skip stok
  → Flag ke owner: "BOM untuk menu ini belum diset"
```

### 9.3 Kategori Bahan — Otomatis via Gemini

```
Setiap item dari nota OCR → Gemini assign kategori:

Bahan Pangan Pokok  → beras, tepung, mie, singkong
Protein Hewani      → ayam, daging, ikan, telur, udang
Protein Nabati      → tahu, tempe, kacang
Sayuran & Buah      → wortel, bayam, tomat, pisang, jeruk
Bumbu & Minyak      → bawang, cabai, minyak goreng, kecap
Packaging           → plastik, kardus, wadah, sendok
Energi & Utilitas   → gas, bensin, listrik (manual)
Perlengkapan        → tisu, ATK, sarung tangan
Lainnya             → tidak masuk kategori di atas

Kategori ini dipakai di:
  - Sheet Harian Excel (kolom Kategori)
  - Filter pembukuan web
  - Breakdown pengeluaran per kategori
```

### 9.4 Struktur Excel Per Bulan (6 Sheet) — Template-First

> **⚠️ Strategi implementasi:**
> Template `.xlsx` dibuat manual sekali di Modul 1. Python hanya mengisi data
> ke sel yang sudah ada dengan `load_workbook()`. Tidak rebuild dari nol.
> File path: `backend/templates/pembukuan_template.xlsx`

```python
# services/export_service.py
from openpyxl import load_workbook

def regenerate_monthly_excel(tenant_id, year, month):
    wb = load_workbook("templates/pembukuan_template.xlsx")

    # Isi tiap sheet dari data Supabase
    _fill_harian(wb["Harian"], transactions)
    _fill_mingguan(wb["Mingguan"], weekly_summary)
    _fill_bulanan(wb["Bulanan"], monthly_summary)
    _fill_stok(wb["Stok"], stock_movements)
    _fill_laporan_pemerintah(wb["Laporan Pemerintah"], deliveries)
    _fill_riwayat_nota(wb["Riwayat Nota"], all_transactions)

    # Upload ke Supabase Storage, timpa file bulan ini
    path = f"{tenant_id}/excel/{year}/{month:02d}/pembukuan.xlsx"
    upload_to_storage(wb, path)
    update_excel_files_table(tenant_id, year, month, path)
```

**Kapan di-regenerate:**
```
Setiap ada event berikut → regenerate file bulan berjalan:
  ✓ Nota belanja dikonfirmasi
  ✓ /serah dikonfirmasi
  ✓ Input manual pengeluaran
  (File bulan lalu tidak berubah — sudah final)
```

**Struktur 6 sheet:**
```
Sheet 1: HARIAN
  Tanggal | Keterangan | Kategori (AI) | Supplier | Item | Qty | Harga | Masuk | Keluar | Saldo
  Setiap transaksi satu baris. Filter per tanggal.

Sheet 2: MINGGUAN
  Rekap otomatis dari Sheet Harian.
  Minggu 1 | Minggu 2 | Minggu 3 | Minggu 4
  Total porsi, pendapatan, pengeluaran per kategori, laba.

Sheet 3: BULANAN
  Ringkasan satu bulan.
  Pendapatan bruto, PPh 22, pendapatan bersih.
  Pengeluaran: bahan, upah, ops, total.
  Laba bersih. Margin.

Sheet 4: STOK
  Per bahan: stok awal bulan → masuk (belanja) → keluar (BOM) → sisa akhir.
  Update tiap ada pergerakan stok.

Sheet 5: LAPORAN PEMERINTAH
  Format audit dinas — 5 bagian yang sudah dikonfirmasi:
  Identitas SPPG | Logistik & Distribusi per sekolah |
  Komposisi Biaya | Detail Bahan & Pajak | Evaluasi Gizi & Sampel

Sheet 6: RIWAYAT NOTA
  Semua nota yang pernah masuk: tanggal, supplier, item detail,
  kategori (AI), link foto nota digital.
```

**Akses di web:**
```
Menu Laporan & Export:
  📊 Maret 2025   [📥 Download]  ← live, update otomatis
  📊 Februari 2025 [📥 Download] ← final
  📊 Januari 2025  [📥 Download] ← final
```

---

## 10. API ENDPOINTS

### Auth
```
POST /auth/register-tenant
POST /auth/login
POST /auth/telegram-login
POST /auth/refresh
POST /auth/logout
```

### Transactions
```
GET    /transactions                    # filter: date, category, type
POST   /transactions
GET    /transactions/{id}
PUT    /transactions/{id}              # cek is_locked
DELETE /transactions/{id}             # owner only
POST   /transactions/from-photo       # rate limit → Redis queue (single)
POST   /transactions/from-photo-batch # batch mode → photo_batches
POST   /transactions/{id}/confirm
```

### Products & Stok
```
GET    /products
POST   /products
PUT    /products/{id}
DELETE /products/{id}                 # owner only
GET    /products/{id}/stock-history
GET    /products/{id}/price-history   # riwayat harga untuk track kenaikan
POST   /products/{id}/adjust-stock   # atomic
GET    /products/low-stock
```

### Price Tracking (Track Kenaikan Harga)
```
GET    /price-tracking/overview       # semua bahan, harga rata-rata terkini
GET    /price-tracking/{product_id}   # chart data: harga per tanggal (lazy load)
       # ?period=1m | 3m | 12m
GET    /price-tracking/ai-insights    # Gemini analisis tren + rekomendasi
```

### Suppliers & Schools
```
GET/POST/PUT/DELETE /suppliers
GET    /suppliers/{id}/transactions

GET    /schools                       # TIDAK terbatas jumlahnya
POST   /schools
PUT    /schools/{id}
DELETE /schools/{id}                  # owner only
GET    /schools/{id}/deliveries       # riwayat penyerahan per sekolah
```

### Recipes (BOM)
```
GET    /recipes
POST   /recipes
PUT    /recipes/{id}
DELETE /recipes/{id}
GET    /recipes/menu/{menu_id}
POST   /recipes/simulate             # { menu_id, qty } → kebutuhan bahan + cek stok
```

### MBG
```
GET/POST/PUT/DELETE /mbg/weekly-menus
GET                 /mbg/weekly-menus/today        # shortcut bot
GET/POST/PUT        /mbg/deliveries
POST                /mbg/deliveries/bulk           # konfirmasi semua sekolah sekaligus
GET                 /mbg/deliveries/summary        # ?date=YYYY-MM-DD
GET                 /mbg/budget                   # realisasi hari ini
POST                /mbg/budget/calculate          # trigger hitung ulang
GET    /mbg/allocation-settings                   # alokasi per porsi tenant
PUT    /mbg/allocation-settings                   # owner ubah alokasi
GET    /mbg/reports/daily                         # JSON preview laporan harian
```

### Excel Files (Pembukuan Bulanan)
```
GET    /excel                         # list semua file per bulan
GET    /excel/{year}/{month}          # download URL file bulan tertentu
POST   /excel/{year}/{month}/regenerate # force regenerate (owner only)
```

### Reports, Periods, Aliases, Schedules, Validasi
```
GET  /reports/summary | /reports/cashflow | /reports/profit
GET  /reports/receivables | /reports/payables
GET  /reports/tax-summary              # rekap PPh22 + PPN

GET    /periods
POST   /periods
DELETE /periods/{id}                  # owner only, hanya status='open'
POST   /periods/{id}/lock
GET    /periods/{id}/report

GET/POST/DELETE /aliases
POST            /aliases/resolve

GET/POST/PUT/DELETE /schedules
POST            /schedules/{id}/done
GET             /schedules/upcoming

GET  /validations | /validations/{id}
POST /validations/{id}/review
```

---

## 11. ENVIRONMENT VARIABLES

```env
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=service_role_key    # backend only — jangan expose
SUPABASE_ANON_KEY=anon_key              # web only

# FastAPI
SECRET_KEY=random_minimal_32_char
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALGORITHM=HS256

# Telegram
TELEGRAM_BOT_=token_botfather

# AI
GEMINI_API_KEY=gemini_key

# Redis
REDIS_URL=redis://default:pass@host:6379

# App
APP_ENV=development
BACKEND_URL=https://api.yourdomain.com
WEB_URL=https://app.yourdomain.com

# Worker
OCR_WORKER_COUNT=2
OCR_JOB_TIMEOUT=120

# Rate Limiting
PHOTO_RATE_LIMIT_PER_USER=10
PHOTO_RATE_LIMIT_WINDOW_SECONDS=60

# MBG — semua konstanta dari ENV, tidak boleh hardcode di kode
MBG_PRICE_PER_PORTION=15000
MBG_PPH22_RATE=0.015
MBG_FOOD_ALLOCATION=0.80
MBG_LABOR_ALLOCATION=0.15
MBG_OPS_ALLOCATION=0.05
```

---

## 12. ROW LEVEL SECURITY (Supabase RLS)

```sql
-- Template semua tabel bertenant_id
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON transactions
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "no_edit_locked" ON transactions
  FOR UPDATE USING (is_locked = false);
CREATE POLICY "no_delete_locked" ON transactions
  FOR DELETE USING (is_locked = false);

-- Period: hanya open yang bisa dihapus
CREATE POLICY "no_delete_locked_period" ON periods
  FOR DELETE USING (status = 'open');

-- MBG deliveries
CREATE POLICY "no_edit_locked_delivery" ON mbg_deliveries
  FOR UPDATE USING (is_locked = false);
```

PERINGATAN: Test wajib Modul 1 — verifikasi GENERATED ALWAYS AS...STORED di receivables
dan payables bekerja normal bersama RLS. Jika ada issue, ganti dengan trigger
BEFORE INSERT OR UPDATE yang menghitung remaining secara eksplisit.

---

## 13. URUTAN DEVELOPMENT (18 Modul)

> **Catatan untuk Cursor:** Setiap modul harus selesai dan bisa ditest sebelum lanjut.
> Jangan skip atau paralel — dependensi antar modul sangat ketat.
> Pembagian platform WAJIB diikuti: Telegram = input, Web = output + setup master data.

```
── FONDASI ──────────────────────────────────────────────────────────────────

Modul  1 → Supabase: semua tabel + RLS + trigger + fungsi increment_stock
           Migrations yang harus ada:
             001_initial_schema.sql    ← tenants, users, products, suppliers,
                                          schools, transactions, transaction_items,
                                          stock_history, price_history,
                                          product_aliases, receivables, payables,
                                          cashflow_log, nota_validations,
                                          schedules, audit_log, photo_batches
             002_mbg_tables.sql        ← mbg_weekly_menus, mbg_deliveries,
                                          mbg_budget_allocations
             003_mbg_settings.sql      ← mbg_allocation_settings (v1.6 BARU)
             004_excel_files.sql       ← excel_files (v1.6 BARU)
             005_rls_policies.sql      ← semua RLS policy
             006_triggers.sql          ← price_history trigger + increment_stock fn
             007_seed_data.sql         ← data awal (optional)
           + buat template Excel: backend/templates/pembukuan_template.xlsx
             (6 sheet kosong dengan header, format, formula — dipakai Modul 18)
           [TEST: Generated Column + RLS di receivables/payables]
           [OUTPUT: migrations/ folder lengkap + template Excel siap pakai]

Modul  2 → FastAPI: scaffold + config + auth (JWT) + tax_service dasar

Modul  3 → FastAPI: role middleware + rate limit middleware + dependencies

── TELEGRAM BOT (INPUT OPERASIONAL) ─────────────────────────────────────────

Modul  4 → Bot: /start + onboarding + hubungkan akun + main menu
           + /settings untuk isi identitas SPPG via Telegram

Modul  5 → Web (Onboarding): setup master data
           identitas SPPG, sekolah (tidak terbatas), supplier (is_pkp),
           bahan baku + stok awal, BOM/resep, mbg_allocation_settings
           [FONDASI DATA: semua modul berikutnya bergantung ini]
           [TEST: simulate BOM 500 porsi, cek atomic stok update]

Modul  6 → Bot: /menu — input menu mingguan Senin-Sabtu (6 hari)
           + bisa edit per hari kapan saja
           + validasi: BOM sudah ada untuk menu ini?

Modul  7 → Bot: upload foto nota SINGLE
           + Redis queue + Gemini OCR + deteksi PPN
           + Gemini assign kategori otomatis per item
           + alias_service
           [TEST: foto nota PKP vs non-PKP, cek kategori AI]

Modul  8 → Bot: upload foto nota MULTIPLE (batch mode)
           + photo_batches state machine + timeout 5 menit + error per foto
           [TEST: 3 foto sekaligus, 1 buram — 2 tetap berhasil]

Modul  9 → Bot: konfirmasi nota (single & batch) + edit inline + simpan
           + stok atomic + cashflow_log
           + input manual belanja (/belanja tanpa foto)
           + trigger regenerate Excel bulan berjalan

Modul 10 → Bot: /serah — konfirmasi penyerahan MBG harian
           + ambil alokasi dari mbg_allocation_settings (bukan hardcode)
           + error handling stok kurang (nama bahan + jumlah kurang)
           + sinkronisasi atomik: potong stok BOM + buat receivable + hitung alokasi
           + auto-generate draft nota PDF MBG
           + trigger regenerate Excel bulan berjalan
           [TEST: konfirmasi → cek stock_history + receivables + budget_allocation]

Modul 11 → Bot: /summary, /stok, /tagihan — ringkasan cepat
           + notifikasi otomatis background (stok rendah, jatuh tempo, ringkasan Jumat)

── FASTAPI SERVICES (KALKULASI & LAPORAN) ───────────────────────────────────

Modul 12 → FastAPI: laporan laba + waste/spoilage + MBG daily JSON
           + tax_service lengkap (PPh22 rekonsiliasi + PPN per nota)
           + price_history service (rata-rata harga per bahan dari semua nota)
           + AI insight service (Gemini: analisis tren harga, rekomendasi)
           + export_service: regenerate Excel bulanan (load_workbook template)

── WEB DASHBOARD (OUTPUT & ANALITIK) ────────────────────────────────────────

Modul 13 → Web: Next.js setup + auth + layout
           + Onboarding flow (sambung ke Modul 5)

Modul 14 → Web: MENU 1 — Pembukuan
           ringkasan mingguan/bulanan + semua transaksi + grafik laba
           drill-down per hari → detail item + foto nota

Modul 15 → Web: MENU 2 — Hutang & Piutang
           aging schedule + piutang MBG + hutang supplier
           + rekonsiliasi PPh 22 & PPN otomatis

Modul 16 → Web: MENU 3 — Stok Gudang
           posisi stok real-time + alert merah + proyeksi hari
           + riwayat pergerakan per bahan

Modul 17 → Web: MENU 4 — AI Jadwal
           AI draft jadwal (Gemini) → pemilik approve/edit per hari
           + MENU 5 — Track Kenaikan Harga
           daftar semua bahan → klik bahan → chart lazy load (1/3/12 bulan)
           + AI insight otomatis ("Beras naik 12%...")
           [harga = rata-rata dari semua nota, tidak dipisah per supplier]

Modul 18 → Web: MENU 6 — Laporan & Export
           list file Excel per bulan → klik download
           preview data laporan sebelum download
           nota MBG PDF: edit draft dari Modul 10 → finalize → download
           + hardening (sanitization, error boundaries, logging)

           ⚠️ PANDUAN EXCEL TEMPLATE-FIRST (wajib dibaca sebelum coding Modul 18):
           ─────────────────────────────────────────────────────────────────
           JANGAN generate Excel dari nol dengan openpyxl.
           Template sudah dibuat di Modul 1 dengan header, format, formula, styling.
           Python HANYA mengisi data ke sel yang sudah ada.

           from openpyxl import load_workbook

           def regenerate_monthly_excel(tenant_id, year, month):
               wb = load_workbook("templates/pembukuan_template.xlsx")
               _fill_harian(wb["Harian"], transactions)
               _fill_mingguan(wb["Mingguan"], weekly_summary)
               _fill_bulanan(wb["Bulanan"], monthly_summary)
               _fill_stok(wb["Stok"], stock_movements)
               _fill_laporan_pemerintah(wb["Laporan Pemerintah"], deliveries)
               _fill_riwayat_nota(wb["Riwayat Nota"], all_transactions)
               path = f"{tenant_id}/excel/{year}/{month:02d}/pembukuan.xlsx"
               upload_to_storage(wb, path)
               update_excel_files_table(tenant_id, year, month, path)

           Ini 5-10x lebih cepat dan hasil lebih rapi dari rebuild dari nol.
           ─────────────────────────────────────────────────────────────────
```



---

## 14. ATURAN WAJIB (Baca Sebelum Coding)

**Platform (TIDAK BOLEH DILANGGAR):**
- **Telegram = INPUT** — semua operasional harian kasir/pemilik
- **Web = OUTPUT + SETUP** — laporan, analitik, export, setup master data awal
- PPN & pajak hanya tampil di Web, tidak di Telegram

**Data & Database:**
- Setiap query WAJIB filter `tenant_id` — tidak ada query tanpa ini
- `is_locked=true` → HTTP 403 untuk PUT/DELETE transaksi & MBG deliveries
- `stock_history` dan `audit_log` immutable — tidak pernah UPDATE/DELETE
- `hpp_snapshot` WAJIB diisi saat `transaction_items` dibuat
- `DECIMAL(15,2)` untuk semua uang — tidak pakai FLOAT
- `DECIMAL(15,3)` untuk semua qty/stok — tidak pakai FLOAT
- Update stok WAJIB atomic — `stock_qty = stock_qty + delta`, bukan set langsung

**Keamanan:**
- `SUPABASE_SERVICE_KEY` hanya di backend — tidak boleh di frontend/bot/git
- OCR selalu async via Redis — tidak pernah synchronous blocking
- Rate limit foto: 10/menit/user — 2 lapisan: bot + FastAPI
- Alias `confidence < 0.8` → minta konfirmasi user

**MBG Spesifik:**
- Konfirmasi delivery → **wajib atomik**: potong stok BOM + buat receivable + hitung 80:15:5
- PPh 22 dicatat di `receivables.pph22_amount` — saldo bank ≠ tagihan bruto, harus sinkron
- Konstanta MBG dari ENV — tidak boleh hardcode di kode
- Bot WAJIB maks 3 langkah untuk operasi harian rutin kasir
- Error stok kurang → pesan eksplisit per bahan: nama + jumlah kurang
- `UNIQUE(tenant_id, school_id, delivery_date)` — satu sekolah satu delivery per hari
- Menu mingguan: tidak ada template tetap, input manual tiap minggu

**Export:**
- Excel MBG → template-first: `load_workbook(template)`, isi data, jangan rebuild dari nol
- Template dibuat di Modul 1, disimpan di `backend/templates/`
- Format 5 bagian: identitas, logistik, biaya 80:15:5, pajak, gizi & sampel
- Setiap export → catat di `audit_log`
- Closing period hanya role `owner`

**Umum:**
- Foto path: `/{tenant_id}/notas/{YYYY-MM}/{trx_id}.jpg`
- Semua tanggal UTC di DB, konversi WIB (UTC+7) di display
- Bot lama (bakery-telegram-bot) = referensi logika saja, tidak ada copy-paste kode
- AI features (jadwal + insight harga) pakai Gemini API yang sama dengan OCR

---

*Versi: 1.5 | Ini satu-satunya sumber kebenaran sistem.*
*Update versi setiap ada perubahan keputusan teknis.*
*Tag di Cursor: @MASTER_PLAN.md setiap prompt baru.*

*Versi: 1.7 | Status: FINAL — Siap Coding.*
*Ini satu-satunya sumber kebenaran sistem.*
*Update versi setiap ada perubahan keputusan teknis.*
*Tag di Cursor: @MASTER_PLAN.md setiap prompt baru.*
