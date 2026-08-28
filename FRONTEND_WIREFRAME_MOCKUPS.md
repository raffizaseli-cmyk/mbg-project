# 📐 UI WIREFRAME & MOCKUPS — Visual Reference

Wireframe & mockup untuk setiap halaman utama. Gunakan sebagai referensi visual saat coding.

---

## LAYOUT STRUCTURE (GLOBAL)

```
┌─────────────────────────────────────────────────────────────┐
│  [≡] MBG Dashboard                          [🔔] [👤]        │  <- TopBar
├────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────────────────────────────┐  │
│ │  Dashboard   │ │                                        │  │
│ │ Pembukuan ▼  │ │    Main Content Area                 │  │
│ │ Hutang/Piu   │ │    (Cards, Tables, Charts)           │  │
│ │ Stok Gudang  │ │                                        │  │
│ │ Track Harga  │ │                                        │  │
│ │ Laporan ▼    │ │                                        │  │
│ │              │ │                                        │  │
│ │ ─────────── │ │                                        │  │
│ │ Settings     │ │                                        │  │
│ │ Logout       │ │                                        │  │
│ │              │ │                                        │  │
│ └──────────────┘ │                                        │  │  <- Scrollable
│    Sidebar       │                                        │  │
│   (280px width)  │                                        │  │
│                  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
      Fixed Left        Flex-1 Right Area (bg-gray-50)
```

---

## 1. DASHBOARD HOME PAGE

### Layout
```
┌─────────────────────────────────────────────────────┐
│ Dashboard                                            │
└─────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 📊 Total Rp  │ 📈 Trend Rp  │ 🏫 Sekolah   │ 📦 Stok      │
│ 45.2M        │ 12.5M        │ 5            │ 243          │
│ ↓ 12% vs BL  │ ↓ 5% vs BL   │              │ ↑ 8% vs BL   │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌─────────────────────────────┬─────────────────────────────┐
│ Trend Pengeluaran 7 Hari    │ Pengeluaran by Kategori    │
│ (Line Chart)                │ (Pie Chart)                │
│                             │                            │
│     Rp 5M      ╱╲      ╱╲   │  🟦 Bahan (35M)          │
│     Rp 4M     ╱  ╲    ╱  ╲  │  🟩 Upah (15M)           │
│     Rp 3M────┘    ╲──┘    ╲ │  🟥 Ops (5M)             │
│     Rp 2M                   │  🟪 Lain (2M)            │
│                             │                            │
│ Mon Tue Wed Thu Fri Sat     │                            │
│ ─── Budget                  │                            │
│ ─── Actual                  │                            │
└─────────────────────────────┴─────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Transaksi Terbaru                                            │
├──────────────────────────────────────────────────────────────┤
│ Belanja ke Supplier A              2 jam yang lalu  Rp 2.5M │
│ Pembayaran Sekolah SDN Mulia       1 hari yang lalu Rp 5.0M │
│ Belanja ke Supplier B              2 hari yang lalu Rp 1.8M │
│ Pembayaran Operasional             3 hari yang lalu Rp 0.5M │
│ Belanja ke Supplier C              5 hari yang lalu Rp 3.2M │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. PEMBUKUAN (EXPENSE) PAGE

### List View
```
┌─────────────────────────────────────────────────────┐
│ Pembukuan                         [+ Tambah]        │
│ Daftar pengeluaran harian                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Filter by Date: [2026-04-03]        [Filter]       │
└─────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Tanggal    Supplier         Items           Jumlah   Action │
├──────────────────────────────────────────────────────────────┤
│ 2026-04-03 PT Maju Jaya    Beras 50kg...    Rp2.5M  [Detail]│
│ 2026-04-02 CV Sejahtera    Telur, Sayur...  Rp1.8M  [Detail]│
│ 2026-04-01 PT Global       Minyak 20L...    Rp0.9M  [Detail]│
│ 2026-04-01 Kebun Segar     Sayuran Segar... Rp0.5M  [Detail]│
│ 2026-03-31 PT Maju Jaya    Daging 15kg...   Rp3.2M  [Detail]│
│                                                [Load more...] │
└──────────────────────────────────────────────────────────────┘
```

### Detail View (Modal/Page)
```
┌──────────────────────────────────────────┐
│ Detail Pengeluaran                       │
├──────────────────────────────────────────┤
│                                          │
│ Tanggal       : 2026-04-03               │
│                                          │
│ Supplier      : PT Maju Jaya             │
│ Alamat        : Jl. Merdeka No. 123      │
│ No. Telepon   : 0274-123456              │
│                                          │
│ Items         : [Foto Nota/OCR Result]   │
│ • Beras (50kg) ................ Rp 1.5M  │
│ • Telur (30 butir) ............ Rp 0.6M  │
│ • Minyak (5L) ................. Rp 0.4M  │
│                                          │
│ Total        : Rp 2.5M                   │
│ Pajak (PPN)  : Rp 0                      │
│                                          │
│ Status       : ✓ Confirmed               │
│ Catatan      : Bayar cash, cicil minggu  │
│                                          │
│ [Edit]  [Delete]  [Download]  [Close]  │
└──────────────────────────────────────────┘
```

---

## 3. HUTANG/PIUTANG PAGE

```
┌──────────────────────────────┬──────────────────────────────┐
│ Total Piutang     💳         │ Total Hutang      ⚠️          │
│ Rp 15.2M                     │ Rp 12.5M                     │
│ 5 invoice perlu follow-up    │ 3 invoice urgent             │
└──────────────────────────────┴──────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Piutang (Invoice Keluar)              Status  Jumlah       │
├──────────────────────────────────────────────────────────────┤
│ SDN Mulia Jaya                                              │
│ 2026-03-20 • Tempo: 2026-04-10  [Overdue]  Rp 5M          │
│                                                              │
│ SDN Bina Bangsa                                             │
│ 2026-03-25 • Tempo: 2026-04-15  [Pending]  Rp 7.2M        │
│                                                              │
│ SDN Citra Mandiri                                           │
│ 2026-03-28 • Tempo: 2026-04-18  [Pending]  Rp 3M          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Hutang (Invoice Masuk)                Status  Jumlah       │
├──────────────────────────────────────────────────────────────┤
│ PT Maju Jaya                                                │
│ 2026-03-25 • Tempo: 2026-04-08  [Pending]  Rp 8M          │
│                                                              │
│ CV Sejahtera                                                │
│ 2026-03-28 • Tempo: 2026-04-12  [Pending]  Rp 4.5M        │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. STOK GUDANG PAGE

```
┌─────────────────────────────────────────────────────┐
│ Stok Gudang                        Filter: [Semua]  │
│ Inventory gudang produksi                           │
└─────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Kategori  Barang         Target   Stock   Status       │
├──────────────────────────────────────────────────────────────┤
│ 🍚 BAHAN                                                    │
│         Beras            100kg    85kg    ⚠️ Warning  │
│         Telur            300b     250b    ✓ OK          │
│         Daging           50kg     45kg    ✓ OK          │
│                                                              │
│ 🥬 SAYURAN                                                  │
│         Wortel           30kg     8kg     🔴 Critical │
│         Kol              20kg     15kg    ✓ OK          │
│         Bayam            15kg     12kg    ✓ OK          │
│                                                              │
│ 🍳 BUMBU & MINYAK                                           │
│         Minyak Goreng    50L      35L     ✓ OK          │
│         Garam            10kg     9kg     ✓ OK          │
│         Gula             20kg     18kg    ✓ OK          │
│                                                              │
│                                      [Load more items...] │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. TRACK HARGA PAGE

```
┌─────────────────────────────────────────────────────┐
│ Track Harga                      Filter: [Semua ▼]  │
│ Pantau perubahan harga supplier                      │
└─────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Trend Harga Beras/kg (30 hari)                      │
│                                                      │
│  Rp 27.5k ╱─╲                              PT Jaya  │
│  Rp 27k   ╱   ╲─╱╲      ╱╲                ─ Makmur │
│  Rp 26.5k╱     ╲    ╲──╱  ╲  ╱╱           ─ Global │
│  Rp 26k          ╲         ╲╱              │
│  Rp 25.5k          ╲                       │
│                                            │
│   Mar 20  25  30  Apr 02                  │
└──────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Rangkuman Harga Terbaru (per kg/item)                 │
├────────────────────────────────────────────────────────┤
│ Supplier      Harga Terakhir    Change vs Minggu Lalu │
│ PT Jaya       Rp 27.500         +1% ↑ (MAHAL)        │
│ CV Makmur     Rp 27.500         -0.5% ↓              │
│ PT Global     Rp 26.000         -2% ↓ (HEMAT) ✓      │
└────────────────────────────────────────────────────────┘

💡 Tips: PT Global paling murah, bisa negosiasi volume
```

---

## 6. LAPORAN PAGE

### Laporan Harian
```
┌─────────────────────────────────────────────────────┐
│ Laporan Harian                    [📥 Download]     │
│ Periode: 1-10 April 2026                            │
└─────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ RINGKASAN HARIAN                                           │
├──────────────────────────────────────────────────────────────┤
│ Tanggal          Total Pengeluaran   Porsi Terjual  Laba  │
│─────────────────────────────────────────────────────────────│
│ 2026-04-10       Rp 5.2M             850            Rp 2.1M │
│ 2026-04-09       Rp 4.8M             810            Rp 1.9M │
│ 2026-04-08       Rp 5.5M             920            Rp 2.3M │
│ 2026-04-07       Rp 5.0M             880            Rp 2.0M │
│ 2026-04-06       Rp 5.3M             900            Rp 2.2M │
│ ─────────────────────────────────────────────────────────────
│ TOTAL            Rp 25.8M            4,360          Rp 10.5M
└──────────────────────────────────────────────────────────────┘

PERHITUNGAN:
80% Bahan      : Rp 20.64M
15% Upah       : Rp 3.87M
5% Operasional : Rp 1.29M
─────────────────────────────
Total          : Rp 25.8M

PPh 22 (1.5%)  : Rp 0.387M (dipotong pemerintah)
```

### Laporan Mingguan
```
┌──────────────────────────────────────────────────────────┐
│ RANGKUMAN MINGGU: 1-7 April 2026                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Total Pengeluaran    : Rp 35.4M                        │
│ Total Porsi          : 5,280                           │
│ Cost per Porsi       : Rp 6,705                        │
│                                                         │
│ Perincian Pengeluaran:                                 │
│ • Bahan Pangan (80%)    : Rp 28.32M  ───────────      │
│ • Upah/Jasa (15%)       : Rp 5.31M   ──────           │
│ • Operasional (5%)      : Rp 1.77M   ──               │
│                                                         │
│ Performance:                                           │
│ ✓ Mencapai 95% dari target pengeluaran                │
│ ✓ Efisiensi naik 2% dibanding minggu lalu             │
│ ⚠️  Harga supplier naik 5%, monitor harga             │
│                                                         │
└──────────────────────────────────────────────────────────┘
```

---

## 7. SETTINGS PAGE

### Struktur Menu
```
┌─────────────────────────────┐
│ SETTINGS                    │
├─────────────────────────────┤
│ ▶️ Profil Perusahaan         │
│ ▶️ Kelola Sekolah           │
│ ▶️ Kelola Supplier          │
│ ▶️ Bill of Materials (BOM)  │
│ ▶️ Tentang & Bantuan        │
└─────────────────────────────┘
```

### Settings - Profil Perusahaan
```
┌──────────────────────────────────────────────┐
│ Profil Perusahaan                            │
├──────────────────────────────────────────────┤
│                                              │
│ Nama SPPG         [________________]         │
│ Alamat            [________________]         │
│ No. Telepon       [________________]         │
│ Email             [________________]         │
│ NPWP              [________________]         │
│ Izin Operasional  [________________]         │
│ PIC Pemilik       [________________]         │
│                                              │
│ Logo Perusahaan   [Upload Logo]  [Preview]  │
│                                              │
│              [Simpan] [Batal]               │
└──────────────────────────────────────────────┘
```

### Settings - Kelola Sekolah
```
┌──────────────────────────────────────────────┐
│ Sekolah yang Dilayani           [+ Tambah]  │
├──────────────────────────────────────────────┤
│                                              │
│ □ SDN Mulia Jaya     1,200 siswa            │
│   Alamat: Jl. Raya No. 1      [Edit][Del]  │
│                                              │
│ □ SDN Bina Bangsa    950 siswa              │
│   Alamat: Jl. Sudirman No. 2  [Edit][Del]  │
│                                              │
│ □ SDN Citra Mandiri  1,100 siswa            │
│   Alamat: Jl. Ahmad Yani No.3 [Edit][Del]  │
│                                              │
│ □ SDN Karya Mulia    800 siswa              │
│   Alamat: Jl. Proklamasi No.4 [Edit][Del]  │
│                                              │
│ □ SMP Negeri 1       2,200 siswa            │
│   Alamat: Jl. Diponegoro No.5 [Edit][Del]  │
│                                              │
│                    Total Siswa: 6,250      │
└──────────────────────────────────────────────┘
```

### Settings - Kelola Supplier
```
┌────────────────────────────────────────────────┐
│ Supplier                      [+ Tambah]       │
├────────────────────────────────────────────────┤
│                                                │
│ PT Maju Jaya        ⭐⭐⭐⭐⭐              │
│ Toko: Toko Maju | Telp: 0274-111111          │
│ Kredit: 7 hari | Last Order: 3 hari lalu    │
│ Top Item: Beras, Telur, Minyak              │
│ [Edit] [Hapus] [History]                    │
│                                                │
│ CV Sejahtera        ⭐⭐⭐⭐                │
│ Toko: Sejahtera Jaya| Telp: 0274-222222      │
│ Kredit: 14 hari | Last Order: 2 hari lalu  │
│ Top Item: Sayuran, Bumbu                  │
│ [Edit] [Hapus] [History]                    │
│                                                │
│ PT Global Import    ⭐⭐⭐⭐⭐              │
│ Toko: Global Mart | Telp: 0274-333333        │
│ Kredit: 0 (cash) | Last Order: 5 hari lalu  │
│ Top Item: Daging, Ikan                      │
│ [Edit] [Hapus] [History]                    │
│                                                │
│                                  [Load more]  │
└────────────────────────────────────────────────┘
```

---

## COLOR REFERENCE FOR MOCKUPS

```
Primary: 🟦 #1e40af (Sidebar, buttons)
Light:   🟩 #3b82f6 (Links, accents)
Success: 🟩 #10b981 (OK status)
Warning: 🟨 #f59e0b (Warning)
Error:   🟥 #ef4444 (Error/Critical)
Gray:    ⬜ #e5e7eb (Borders)
White:   ⬜ #ffffff (Cards, background)
```

---

## 📱 RESPONSIVE BREAKPOINTS

```
Mobile   < 640px   (sm)  : 1 column layout
Tablet   640-1024px(md)  : 2 column layout
Desktop  > 1024px  (lg)  : 3-4 column layout

Sidebar:
- Desktop (lg): Fixed 280px width
- Mobile/Tablet: Collapsible (80px or overlay)
```

---

## 🎯 KEY INTERACTIONS

### Hover States
- Buttons: Darker shade
- Cards: Slight shadow elevation
- Rows: Light gray background (bg-gray-50)

### Active States
- Sidebar links: Highlighted with lighter background + bold text
- Tabs: Underline + color

### Loading States
- Buttons: Show "Loading..." text + disable
- Tables: Show skeleton loaders
- Charts: Show placeholder

### Error States
- Input fields: Red border + error message below
- Alert boxes: Red background + icon
- Tables: Empty state with icon + message

---

**Use these mockups as reference when building the actual components!**
