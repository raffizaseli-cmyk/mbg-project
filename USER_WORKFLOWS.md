# 🚶 USER WORKFLOW GUIDE - Bagaimana Pengguna Pakai App Ini

> **Target Audience**: Owner/Admin/Kasir - Mereka yang actual pakai app setiap hari

---

## 🎯 Siapa Pengguna Ini?

### 1. **Owner** (Pemilik Bisnis)
- Setup awal (master data, suppliers, schools)
- Lihat analytics & reports
- Manage karyawan & roles
- Strategic decisions

### 2. **Admin** (Kepala Program)
- Daily operations management
- Monitor stok & budget
- Approve transactions
- Manage deliveries

### 3. **Kasir** (Staf Keuangan)
- Input transactions (belanja, nota)
- Confirm deliveries
- Reconcile kas
- Report to admin

### 4. **Logistik** (Sopir/Delivery Staff)
- Confirm portions delivered
- Input delivery notes
- Track deliveries

---

## 📱 APLIKASI TERDIRI DARI 3 BAGIAN

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEM TERINTEGRASI                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💬 TELEGRAM BOT                                           │
│  (Mobile-first input)                                      │
│  - Kasir input belanja                                     │
│  - Admin confirm stok                                      │
│  - User notifications                                      │
│                                                             │
│  💻 WEB DASHBOARD                                          │
│  (Analytics & setup)                                       │
│  - Owner setup master data                                 │
│  - Admin lihat reports                                     │
│  - Analytics & insights                                    │
│                                                             │
│  🗄️ SUPABASE DATABASE                                      │
│  (Central storage)                                         │
│  - All users access same data                              │
│  - Real-time sync                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Semua bagian connect ke **database yang sama** → data selalu synchronized!

---

## 📅 WORKFLOW TIMELINE - PER HARI

```
┌─ PAGI (7:00 AM) ─────────────────────────────────────────────┐
│ ✅ NOTIFIKASI OTOMATIS                                       │
│    ├─ Telegram Alert: Stok mana yang low                     │
│    ├─ Telegram Alert: Menu hari ini                          │
│    └─ Telegram Alert: Scheduled deliveries                   │
│                                                               │
│ 👤 ADMIN / KASIR response:                                   │
│    ├─ Check stok yang low                                    │
│    └─ Plan restock kalau diperlukan                          │
└────────────────────────────────────────────────────────────────┘

┌─ SIANG (9:00-11:00 AM) ───────────────────────────────────────┐
│ 🛒 KASIR INPUT PEMBELI (Belanja dari Supplier)               │
│                                                               │
│    Option A: Via FOTO NOTA (Fast & Accurate)                │
│    Option B: Via MANUAL INPUT (Backup option)               │
│                                                               │
│    ✅ Auto-confirm & stok update                             │
└────────────────────────────────────────────────────────────────┘

┌─ SORE (1:00-3:00 PM) ─────────────────────────────────────────┐
│ 📦 DELIVERY TO SCHOOLS                                        │
│                                                               │
│    ✅ System predict portions per sekolah                    │
│    👤 Driver confirm portions delivered                      │
│    ✅ Auto-update stok                                       │
│    ✅ Auto-create ledger transactions                        │
└────────────────────────────────────────────────────────────────┘

┌─ MALAM (5:00 PM) ─────────────────────────────────────────────┐
│ 💰 KASIR RECON (Reconciliation)                              │
│                                                               │
│    ✅ Check all transactions hari ini                        │
│    👤 Confirm ametek & jurnal                                │
│    ✅ Generate daily report                                  │
└────────────────────────────────────────────────────────────────┘
```

---

# 🔄 DETAILED USER JOURNEYS

## JOURNEY #1: OWNER SETUP AWAL (ONE-TIME)

### Kapan: Pertama kali buat tenant/business

### Alur:

```
┌─ STEP 1: Registrasi & Login ──────────────────────────────────┐
│                                                                 │
│  WEBSITE: go to app.example.com                                │
│           ├─ Click "Sign Up"                                   │
│           ├─ Input: Business name, email, password             │
│           ├─ Get JWT token → stored locally                    │
│           └─ Redirect to Dashboard                             │
│                                                                 │
│  RESULT: You now have access to web dashboard                  │
└──────────────────────────────────────────────────────────────────┘

┌─ STEP 2: Input Master Data (Suppliers) ────────────────────────┐
│                                                                  │
│  WEBSITE: Dashboard → Settings → Suppliers                      │
│           ├─ Click "+ Add Supplier"                             │
│           ├─ Fill form:                                         │
│           │  ├─ Supplier name: "Toko Maju"                      │
│           │  ├─ Address: "Jl. Ahmad Yani No. 10"                │
│           │  ├─ Phone: "0812-3456-7890"                         │
│           │  ├─ PIC (Person In Charge): "Budi"                  │
│           │  └─ Email: "budi@tokomaju.com" (optional)           │
│           │                                                      │
│           └─ Click "Save"                                       │
│                                                                  │
│  REPEAT: 5-10 times untuk suppliers lain                        │
│                                                                  │
│  📊 RESULT: Suppliers list populated di database                │
└──────────────────────────────────────────────────────────────────┘

┌─ STEP 3: Input Master Data (Products) ─────────────────────────┐
│                                                                  │
│  WEBSITE: Dashboard → Settings → Products                       │
│           ├─ Click "+ Add Product"                              │
│           ├─ Fill form:                                         │
│           │  ├─ Product name: "Beras Merah Premium"             │
│           │  ├─ Unit: "kg"                                      │
│           │  ├─ Category: "Ingredient"                          │
│           │  ├─ Minimum stock: "10 kg"                          │
│           │  ├─ Last price: "Rp 12,000"                         │
│           │  └─ Description: optional                           │
│           │                                                      │
│           └─ Click "Save"                                       │
│                                                                  │
│  REPEAT: 20-50 products (typical)                               │
│                                                                  │
│  💡 TIP: Use bulk CSV import jika ada banyak products           │
│           Go to: Settings → Bulk Import → Upload CSV            │
│                                                                  │
│  📊 RESULT: Product master ready untuk transaksi                │
└──────────────────────────────────────────────────────────────────┘

┌─ STEP 4: Input Master Data (Schools) ──────────────────────────┐
│                                                                  │
│  WEBSITE: Dashboard → Settings → Schools                        │
│           ├─ Click "+ Add School"                               │
│           ├─ Fill form:                                         │
│           │  ├─ School name: "SD Negeri 1"                      │
│           │  ├─ NPSN: "10200001" (optional)                     │
│           │  ├─ Student count: "250"                            │
│           │  ├─ Principal: "Ibu Siti"                           │
│           │  ├─ Phone: "0274-123456"                            │
│           │  └─ Address: full address                           │
│           │                                                      │
│           └─ Click "Save"                                       │
│                                                                  │
│  REPEAT: 3-10 schools                                           │
│                                                                  │
│  📊 RESULT: Schools master ready                                │
└──────────────────────────────────────────────────────────────────┘

┌─ STEP 5: Setup Team & Roles ───────────────────────────────────┐
│                                                                  │
│  WEBSITE: Dashboard → Settings → Team Members                   │
│           ├─ Click "+ Invite Team Member"                       │
│           ├─ Fill form:                                         │
│           │  ├─ Email: "admin@business.com"                     │
│           │  ├─ Role: dropdown [owner/admin/kasir]              │
│           │  │  ├─ owner = full access                          │
│           │  │  ├─ admin = operation management                 │
│           │  │  └─ kasir = input transactions                   │
│           │  └─ Click "Send Invite"                             │
│           │                                                      │
│           ├─ Team member gets email invite                      │
│           ├─ Confirms own account                               │
│           └─ Gets access based on role                          │
│                                                                  │
│  📊 RESULT: Team ready dengan roles defined                     │
└──────────────────────────────────────────────────────────────────┘

┌─ STEP 6: Enable Bot Access ────────────────────────────────────┐
│                                                                  │
│  TELEGRAM: Search for "@YourBotName" on Telegram               │
│            ├─ Click "Start"                                     │
│            ├─ Bot shows: Menu dengan pilihan:                   │
│            │  ├─ /login → Auth dengan email/password            │
│            │  ├─ /menu → Lihat menu hari ini                    │
│            │  ├─ /belanja → Input pembelian                     │
│            │  ├─ /serah → Confirm delivery                      │
│            │  └─ /help → Get help                               │
│            │                                                     │
│            └─ Follow prompts untuk login                        │
│                                                                  │
│  📱 RESULT: Bot is now connected to your business               │
└──────────────────────────────────────────────────────────────────┘

TOTAL SETUP TIME: 1-2 jam (one-time)
✅ Sistem sekarang READY untuk operations!
```

---

## JOURNEY #2: KASIR - INPUT BELANJA (DAILY)

### Kapan: Ketika mau record pembelian dari supplier

### Alur:

```
┌─ OPSI A: Via FOTO NOTA (Recommended - Faster) ──────────────────┐
│                                                                   │
│  KASIR di Toko dengan Nota:                                      │
│  ├─ Buka Telegram chat dengan Bot                                │
│  ├─ Press: [Catat Nota] button                                   │
│  │          (or type /catat-nota)                                │
│  │                                                               │
│  ├─ Bot response:                                                │
│  │  "📷 CATAT NOTA OTOMATIS                                      │
│  │   Silakan kirim foto nota belanja Anda.                       │
│  │   Bisa banyak foto sekaligus (max 5).                         │
│  │   Klik [Selesai] ketika semua foto terkirim."                 │
│  │                                                               │
│  ├─ KASIR sends photos:                                          │
│  │  ├─ Take 5 photos of receipt                                  │
│  │  ├─ Each photo auto-compressed                               │
│  │  ├─ Progress: "1/5 foto terkirim" ... "5/5 selesai"          │
│  │  │                                                            │
│  │  ├─ After 5 atau user klik "Selesai":                        │
│  │  │  Backend processes:                                       │
│  │  │  ├─ Upload ke Supabase Storage                            │
│  │  │  ├─ Send to Gemini Vision API                             │
│  │  │  ├─ Extract: items, total, PPN, etc                       │
│  │  │  ├─ Apply product alias matching                          │
│  │  │  ├─ Validate amounts                                      │
│  │  │  └─ Create transaction in DB                              │
│  │  │                                                            │
│  │  ├─ After ~3-5 detik, Bot notifies:                          │
│  │  │  "✅ OCR SELESAI!                                          │
│  │  │   Items yang terdeteksi:                                  │
│  │  │   • Beras 10 kg Rp 120.000                                │
│  │  │   • Minyak 5 liter Rp 75.000                              │
│  │  │   • Gula 20 kg Rp 160.000                                 │
│  │  │   TOTAL: Rp 355.000                                       │
│  │  │                                                            │
│  │  │   [✅ Confirm] [✏️ Edit] [❌ Cancel]"                       │
│  │  │                                                            │
│  │  └─ KASIR reviews & click [✅ Confirm]                       │
│  │                                                               │
│  ├─ Backend auto-updates:                                        │
│  │  ├─ Transaction → STATUS: "CONFIRMED"                        │
│  │  ├─ Stok ledger (product qty updated)                        │
│  │  ├─ Kas ledger (cash in recorded)                            │
│  │  └─ Budget allocation                                        │
│  │                                                               │
│  └─ Bot confirms: "✅ Transaksi #TRX-2026-0402-0001 saved!"      │
│                                                                   │
│  ⏱️ TOTAL TIME: ~1-2 menit (5 foto + submit + confirm)          │
│  ✅ RESULT: Transaksi recorded, stok updated otomatis            │
│                                                                   │
└────────────────────────────────────────────────────────────────────┘

┌─ OPSI B: Via MANUAL INPUT (Backup) ────────────────────────────┐
│                                                                  │
│  Kapan: Tidak ada nota (informal), atau foto tidak jelas       │
│                                                                  │
│  KASIR:                                                          │
│  ├─ Open Telegram bot                                            │
│  ├─ Press: [Input Belanja] button                                │
│  │          (or type /belanja)                                   │
│  │                                                               │
│  ├─ Bot: Step 1 - "Siapa supplier?"                             │
│  │        ├─ KASIR sees suggestion buttons:                      │
│  │        │  ├─ [Toko Maju] (last 5x transactions)              │
│  │        │  ├─ [Toko A] (history)                              │
│  │        │  └─ [Edit Manual]                                   │
│  │        │                                                      │
│  │        ├─ KASIR clicks [Toko Maju]                           │
│  │        └─ Auto-filled dengan supplier details                │
│  │                                                               │
│  ├─ Bot: Step 2 - "Items terakhir ke Toko Maju:"               │
│  │        ├─ Shows last items (pre-filled from history):        │
│  │        │  ├─ • Beras 10 kg Rp 120.000                        │
│  │        │  ├─ • Minyak 5 liter Rp 75.000                      │
│  │        │  └─ • Gula 20 kg Rp 160.000                         │
│  │        │                                                      │
│  │        ├─ Options:                                            │
│  │        │  ├─ [✅ Pakai Items Terakhir] → Skip to confirm     │
│  │        │  ├─ [✏️ Edit] → Modify quantities                   │
│  │        │  └─ [❌ Input Baru] → Fresh entry                   │
│  │        │                                                      │
│  │        └─ KASIR clicks [✅ Pakai Items Terakhir]             │
│  │                                                               │
│  ├─ Bot: Step 3 - "Metode bayar?"                              │
│  │        ├─ Options:                                            │
│  │        │  ├─ [💵 Tunai] → Bayar langsung                     │
│  │        │  ├─ [🏦 Transfer] → Bayar via bank                  │
│  │        │  └─ [📋 Hutang] → Bayar nanti                       │
│  │        │                                                      │
│  │        ├─ If click [📋 Hutang]:                              │
│  │        │  Bot asks: "Kira-kira bayar kapan?"                 │
│  │        │  KASIR: Input due date punya hutang                 │
│  │        │                                                      │
│  │        └─ KASIR confirms payment method                      │
│  │                                                               │
│  ├─ Bot: Review & Confirm                                       │
│  │        "Ringkasan Belanja:                                    │
│  │         Supplier: Toko Maju                                  │
│  │         Items: 3 item                                        │
│  │         Total: Rp 355.000                                    │
│  │         Metode: Tunai                                        │
│  │                                                               │
│  │         [✅ OK] [✏️ Edit] [❌ Batal]"                         │
│  │                                                               │
│  │        KASIR clicks [✅ OK]                                  │
│  │                                                               │
│  ├─ Backend auto-updates (same as Opsi A):                     │
│  │  ├─ Transaction recorded                                     │
│  │  ├─ Stok ledger updated                                      │
│  │  ├─ Kas ledger updated                                       │
│  │  └─ Budget allocation updated                                │
│  │                                                               │
│  └─ Bot: "✅ Transaksi #TRX-2026-0402-0002 saved!"             │
│                                                                  │
│  ⏱️ TOTAL TIME: ~1-2 menit (select + confirm)                   │
│  ✅ RESULT: Transaksi recorded (dari history 90% lebih cepat)   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

📊 COMPARISON:
Manual typing setiap item:    4 menit
Dengan auto-fill dari history: 1-2 menit
✅ SAVED ~60% waktu per transaksi!
```

---

## JOURNEY #3: ADMIN - MONITOR STOK (DAILY)

### Kapan: Pagi (7 AM) untuk daily standup

### Alur:

```
┌─ PAGI - Auto Alert via Telegram ───────────────────────────────┐
│                                                                  │
│  ⏰ 7:00 AM - Bot scheduler runs automatically:                 │
│                                                                  │
│  TELEGRAM NOTIFICATION to ADMIN:                               │
│  ┌─────────────────────────────────────────────────────────────┐
│  │ 🔴 STOK RENDAH HARI INI:                                    │
│  │                                                              │
│  │ ⚠️ Beras: 5 kg (minimum: 10 kg)                             │
│  │    Akan habis dalam: 4 hari                                 │
│  │    Estimated cost: Rp 60.000                                │
│  │                                                              │
│  │ ⚠️ Minyak: 2 liter (minimum: 5 liter)                       │
│  │    Akan habis dalam: 2 hari                                 │
│  │    Supplier: Toko Maju                                      │
│  │    Last price: Rp 15.000/liter                              │
│  │                                                              │
│  │ [📝 Input Belanja]  [🔍 Lihat Stok]                        │
│  └─────────────────────────────────────────────────────────────┘
│                                                                  │
│  ADMIN Response Options:                                        │
│  ├─ Click [📝 Input Belanja] → Go to belanja flow (see above)  │
│  ├─ Click [🔍 Lihat Stok] → See detailed stok dashboard        │
│  └─ Ignore kalau sudah disiapkan sebelumnya                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ Dashboard Web - Detailed View ────────────────────────────────┐
│                                                                  │
│  ADMIN: buka app.example.com dashboard                         │
│         → Menu → Reports → Stock Status                        │
│                                                                  │
│  LIHAT:                                                         │
│  ├─ Table view with all products:                              │
│  │  ┌──────────────┬──────┬──────┬──────────┐                  │
│  │  │ Product      │Current│Min   │Status    │                  │
│  │  ├──────────────┼──────┼──────┼──────────┤                  │
│  │  │ Beras        │5 kg  │10 kg │🔴 LOW    │                  │
│  │  │ Minyak       │2 L   │5 L   │🔴 LOW    │                  │
│  │  │ Gula         │45 kg │20 kg │🟢 OK     │                  │
│  │  │ Garam        │8 kg  │10 kg │🟡 WARN   │                  │
│  │  └──────────────┴──────┴──────┴──────────┘                  │
│  │                                                               │
│  ├─ Each row clickable → see full details:                     │
│  │  ├─ Consumption trend (last 30 days)                        │
│  │  ├─ Forecast: akan habis kapan?                             │
│  │  ├─ Last supplier & price                                   │
│  │  ├─ Suggested order qty                                     │
│  │  └─ [🛒 Order Now] button                                   │
│  │                                                               │
│  └─ Filter/Sort options:                                        │
│     ├─ Show only: Low stock                                     │
│     ├─ Group by: Category                                       │
│     └─ Export as: CSV/PDF                                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

✅ RESULT:
- Admin gets proactive alert (tidak perlu manual check)
- Admin sees all stok in one view
- Admin dapat recommend order quantities
- Admin dapat act cepat untuk prevent stockout
```

---

## JOURNEY #4: DRIVER - CONFIRM DELIVERY (AFTERNOON)

### Kapan: Sore hari (~1-3 PM) saat deliver ke schools

### Alur:

```
┌─ Before Delivery ──────────────────────────────────────────────┐
│                                                                  │
│  🕟 13:00 (1 PM)                                                │
│                                                                  │
│  ADMIN/DRIVER: Open Bot                                        │
│                → Press [Serah] button                           │
│                   (or /serah command)                           │
│                                                                  │
│  Bot shows: "📦 PREDICTED PORTIONS TODAY"                      │
│            (calculated from: school enrollment + attendance)   │
│                                                                  │
│            SEKOLAH ABC (250 siswa @ 95% attendance):          │
│            • Beras: 48.5 kg (75g/anak)                        │
│            • Lauk:  65 kg   (100g/anak)                       │
│            • Sambal: 15 kg  (50g/anak)                        │
│                                                                  │
│            SEKOLAH XYZ (180 siswa @ 92% attendance):          │
│            • Beras: 34 kg                                      │
│            • Lauk:  48 kg                                      │
│            • Sambal: 12 kg                                     │
│                                                                  │
│            [✅ OK] [✏️ Edit] [❌ Manual]                        │
│                                                                  │
│  DRIVER Review:                                                 │
│  ├─ Check kalau predictions reasonable                         │
│  ├─ Mungkin ada update attendance terbaru                      │
│  ├─ Click [✅ OK] untuk proceed dengan predictions             │
│  │                                                              │
│  └─ Bot: "Berapa yang mau disetuj untuk dikirim?"             │
│           Show options:                                         │
│           [✅ Semua OK] [🔧 Edit Sekolah Tertentu]            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ During Delivery ──────────────────────────────────────────────┐
│                                                                  │
│  DRIVER travels ke SEKOLAH ABC:                                │
│  ├─ Bawa: 48.5 kg Beras, 65 kg Lauk, 15 kg Sambal            │
│  ├─ Sampai di sekolah                                          │
│  ├─ Deliver ke school kitchen/cafeteria                        │
│  ├─ Open Bot                                                   │
│  │ /serah → Select School ABC → Confirm delivered            │
│  │                                                              │
│  │ Bot: "Berapa banyak yang terkirim ke Sekolah ABC?"         │
│  │      [Use predicted: 48.5kg]                               │
│  │      [Edit manually]                                        │
│  │      [Take Photo as proof]                                  │
│  │                                                              │
│  ├─ DRIVER: Click [Use predicted: 48.5kg] → Confirm          │
│  │ Bot: "Penerima: [Pilih staff sekolah]"                     │
│  │      [Get tanda tangan (photo)]                             │
│  │                                                              │
│  │ Backend auto-create:                                        │
│  │  ├─ Delivery transaction recorded                           │
│  │  ├─ Stok ledger updated (out: 48.5kg beras)               │
│  │  ├─ School balancing updated                               │
│  │  ├─ Delivery note generated                                │
│  │  └─ Notification sent to Admin                             │
│  │                                                              │
│  └─ Bot: "✅ Delivery Sekolah ABC confirmed!"                 │
│                                                                  │
│  DRIVER then goes to SEKOLAH XYZ → Repeat flow                │
│  DRIVER then goes to SEKOLAH DEF → Repeat flow                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ After Delivery ───────────────────────────────────────────────┐
│                                                                  │
│  Bot: "📊 DELIVERY SUMMARY"                                    │
│       Tanggal: 2 April 2026                                    │
│       Deliveries Done: 5 schools                               │
│       Total Items: 15 items                                    │
│       Total Qty: 250 kg delivered                              │
│                                                                  │
│       Stok Terkini:                                             │
│       • Beras: 100 kg → 50 kg (delivered 50 kg)               │
│       • Lauk: 90 kg → 40 kg (delivered 50 kg)                 │
│       • Sambal: 50 kg → 35 kg (delivered 15 kg)               │
│                                                                  │
│       [✅ Selesai] [📝 Catatan] [📋 Report]                    │
│                                                                  │
│  DRIVER clicks [✅ Selesai] → Finalize delivery                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

✅ ENTIRE DELIVERY FLOW AUTO-TRACKED:
- Driver tidak perlu manual input yang kompleks
- ~30 detik per school delivery (click confirm)
- Stok otomatis updated
- Attendance data auto-recorded
- Ledger otomatis tertata
```

---

## JOURNEY #5: KASIR - DAILY RECONCILIATION (EVENING)

### Kapan: Akhir hari (~5 PM) reconcile all transactions

### Alur:

```
┌─ Evening Reconciliation ───────────────────────────────────────┐
│                                                                  │
│  🕔 17:00 (5 PM)                                                │
│                                                                  │
│  KASIR: Open Web Dashboard                                      │
│         → Menu → Reports → Daily Reconciliation                │
│                                                                  │
│  DASHBOARD SHOWS:                                               │
│  ┌────────────────────────────────────────────────────────────┐
│  │ 📊 DAILY SUMMARY - 2 April 2026                             │
│  │                                                              │
│  │ CASH IN (Kas Masuk):                                         │
│  │ ├─ Belanja Recording: Rp 1.200.000                          │
│  │ │  ├─ Transaksi #TRX-001: Rp 355.000                        │
│  │ │  ├─ Transaksi #TRX-002: Rp 450.000                        │
│  │ │  ├─ Transaksi #TRX-003: Rp 395.000                        │
│  │ │  └─ ... (show all)                                         │
│  │ │                                                            │
│  │ ├─ Hutang Bayar (Paid debts): Rp 500.000                    │
│  │ └─ Other Income: Rp 100.000                                 │
│  │                                                              │
│  │ CASH OUT (Kas Keluar):                                       │
│  │ ├─ Delivery Cost: Rp 50.000                                 │
│  │ ├─ Operational: Rp 75.000                                   │
│  │ └─ Other: Rp 25.000                                         │
│  │                                                              │
│  │ NET:                                                         │
│  │ ├─ Opening Balance: Rp 5.000.000                            │
│  │ ├─ In: Rp 1.800.000                                         │
│  │ ├─ Out: Rp 150.000                                          │
│  │ └─ CLOSING BALANCE: Rp 6.650.000 ✅                         │
│  │                                                              │
│  │ INVENTORY:                                                   │
│  │ ├─ Beras: 100 kg → 50 kg (delivered 50kg) ✅               │
│  │ ├─ Minyak: 50 L → 45 L (used 5L) ✅                       │
│  │ ├─ ... (all items tracking)                                 │
│  │                                                              │
│  │ [✅ Approve] [📋 Generate Report] [❌ Query]                │
│  └────────────────────────────────────────────────────────────┘
│                                                                  │
│  KASIR REVIEW:                                                  │
│  ├─ Cek setiap line item (verify transactions tadi)            │
│  ├─ Check: physical cash match dengan system?                  │
│  ├─ Check: stok quantities match dengan reality?               │
│  │                                                              │
│  ├─ If match: Click [✅ Approve]                               │
│  │ Bot: "Transaksi hari ini APPROVED"                          │
│  │      Ledgers locked untuk hari ini                          │
│  │      Backup saved ke cloud                                  │
│  │                                                              │
│  └─ If NOT match:                                              │
│     ├─ Click [❌ Query]                                        │
│     ├─ Select transaction yang error                           │
│     ├─ Add comment: "Totalnya beda Rp 50.000"                  │
│     ├─ System suggest: "Mungkin belanja tidak di-record?"      │
│     └─ Click [✏️ Adjust] → Manual fix atau delete trans      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ Generate Report ──────────────────────────────────────────────┐
│                                                                  │
│  After approval, KASIR can:                                     │
│  ├─ Click [📋 Generate Report]                                 │
│  ├─ System generates: Daily Reconciliation Report              │
│  ├─ Format: PDF / Excel                                        │
│  ├─ Send ke: Admin email                                       │
│  ├─ Also saved in: Dashboard archive                           │
│  │                                                              │
│  └─ Admin gets email with summary                              │
│     → Can approve or request adjustment                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

✅ RECONCILIATION BENEFIT:
- All transactions auto-tracked (no manual entry needed)
- Discrepancies flagged automatically
- Daily summaries ready in seconds
- Audit trail saved for compliance
- Previous year data accessible anytime
```

---

## JOURNEY #6: OWNER - ANALYTICS & DECISIONS (WEEKLY)

### Kapan: Weekly review untuk strategic decisions

### Alur:

```
┌─ Weekly Analytics Review ──────────────────────────────────────┐
│                                                                  │
│  OWNER: Open Dashboard                                          │
│         → Menu → Analytics                                      │
│                                                                  │
│  DASHBOARD SHOWS:                                               │
│  ┌────────────────────────────────────────────────────────────┐
│  │ 📈 WEEKLY SUMMARY (Week 14 April 2026)                      │
│  │                                                              │
│  │ SPENDING ANALYSIS:                                           │
│  │ ├─ Total Belanja: Rp 15.4 juta                              │
│  │ ├─ Top Suppliers:                                            │
│  │ │  ├─ Toko Maju: Rp 6.2 juta (40%)                         │
│  │ │  ├─ Toko A: Rp 4.1 juta (27%)                            │
│  │ │  ├─ Supplier XYZ: Rp 5.1 juta (33%)                      │
│  │ │                                                            │
│  │ ├─ By Category:                                              │
│  │ │  ├─ Ingredients: 60%                                       │
│  │ │  ├─ Packaging: 20%                                         │
│  │ │  └─ Operational: 20%                                       │
│  │ │                                                            │
│  │ ├─ Price Trends:                                             │
│  │ │  ├─ Beras: Rp 12.000 last week → Rp 12.500 now (+4%)     │
│  │ │  ├─ Minyak: Rp 15.000 → Rp 14.800 (-1%)                  │
│  │ │  └─ Gula: Stable                                           │
│  │ │                                                            │
│  │ DELIVERY ANALYSIS:                                           │
│  │ ├─ Total Delivered: 1,250 kg                                │
│  │ ├─ Average: 250 kg/day                                      │
│  │ ├─ Schools Coverage: 100% (5/5 schools)                    │
│  │ ├─ Attendance: Average 93%                                  │
│  │ ├─ On-time Delivery: 100%                                  │
│  │ │                                                            │
│  │ ├─ Cost per kg: Rp 12.320/kg                                │
│  │ └─ Cost per school: Rp 3.08M average                        │
│  │                                                              │
│  │ BUDGET TRACKING:                                             │
│  │ ├─ Budget allocated: Rp 20M                                 │
│  │ ├─ Spent to date: Rp 15.4M (77%)                            │
│  │ ├─ Remaining: Rp 4.6M (23%)                                 │
│  │ ├─ Trend: On pace                                            │
│  │ │                                                            │
│  │ ├─ Alerts:                                                   │
│  │ │  ├─ 🟡 Minyak spending +8% (vs previous week)            │
│  │ │  ├─ 🟢 Total belanja on budget                            │
│  │ │  └─ 🔴 One supplier lateness x2 (investigate)            │
│  │ │                                                            │
│  │ [📊 Detailed View] [📥 Export] [📧 Share]                  │
│  │                                                              │
│  └────────────────────────────────────────────────────────────┘
│                                                                  │
│  OWNER INSIGHTS:                                                │
│  ├─ Identify trends: Harga supplier mana yang paling hemat?   │
│  ├─ Find patterns: Delivery mana yang sering telat?           │
│  ├─ Make decisions: Mungkin switch supplier untuk save costs? │
│  ├─ Track compliance: Budget, quality, timeliness all visible│
│  │                                                              │
│  └─ Click on any metric → Drill-down untuk detail analysis    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ Data Export ──────────────────────────────────────────────────┐
│                                                                  │
│  OWNER dapat:                                                   │
│  ├─ Click [📥 Export] → Download as Excel/CSV/PDF             │
│  ├─ Use for: External reporting, audits, presentations        │
│  ├─ Share with: Authorities, donors, stakeholders              │
│  └─ Build pivot tables untuk analysis lebih dalam             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

✅ OWNER EMPOWERMENT:
- See ALL data at a glance
- Make data-driven decisions
- Identify cost-saving opportunities
- Track budget compliance
- Audit trail complete & transparent
```

---

## 🌍 WORKFLOW ACCESSIBILITY

```
TELEGRAM (Mobile-first):
├─ Owner: Setup (first time), monitor alerts
├─ Admin: Monitor stok, approve deliveries
├─ Kasir: Input transactions, reconcile daily
├─ Driver: Confirm deliveries, track proof
└─ All: Get notifications, quick actions

WEB DASHBOARD (Detailed):
├─ Owner: Setup master data, analytics reviews
├─ Admin: Reports, detailed monitoring, approvals
├─ Kasir: Reconciliation, transaction history
└─ All: Historical data, exports, insights

DATABASE (Backend):
├─ Real-time sync
├─ Multi-user concurrent access
├─ Role-based access control (RBAC)
└─ Audit trail of all changes
```

---

## ⏱️ TIME BREAKDOWN - DAILY

```
MORNING (7:00-8:00 AM):
├─ Auto stok alert → ✅ 0 menit (passive notification)
├─ Admin reviews & decides → ⏱️ 10 menit
└─ Total: ~10 menit

MIDDAY (9:00-12:00 PM):
├─ Belanja entry x 2-3 times → ⏱️ 3-5 menit (auto-fill saves 60%)
├─ Manual stok checks → ✅ 0 menit (auto alert on morning)
└─ Total: ~3-5 menit

AFTERNOON (1:00-4:00 PM):
├─ Delivery confirmations x 5 schools → ⏱️ 2-3 menit (auto-predict saves 70%)
├─ Portion adjustments if needed → ⏱️ 2-3 menit
└─ Total: ~4-6 menit

EVENING (5:00-6:00 PM):
├─ Daily reconciliation → ⏱️ 5-10 menit (auto-summarized saves 80%)
├─ Generate & approve report → ⏱️ 2 menit
└─ Total: ~7-12 menit

TOTAL DAILY: ~24-33 menit (vs. 60+ menit without automation)
```

---

## 🎯 KEY TAKEAWAYS

```
✅ WORKFLOW IS DESIGNED FOR:
  1. Minimize manual data entry (all auto-filled/predicted)
  2. Mobile-first (Telegram for on-the-go)
  3. Web dashboard (detailed planning & analytics)
  4. Real-time notifications (proactive, not reactive)
  5. Decision support (all data visible when needed)

✅ USERS GET:
  1. Less repetitive tasks → Focus on strategic work
  2. Fewer errors → Auto-validation & matching
  3. Better visibility → All data accessible
  4. Faster operations → Pre-fills reduce time 50-80%
  5. Compliance tracking → Complete audit trail

✅ THE SYSTEM DOES:
  1. Receipt recognition (OCR via AI)
  2. Smart matching (products, aliases, prices)
  3. Pattern detection (recurring orders, consumption)
  4. Automatic calculations (stok, budget, predictions)
  5. Real-time notifications (alerts & reminders)
```

---

## 📱 ONE MORE THING: SIMPLIFIED DEMO FLOW

If you want to see in action, try this flow:

```
Week 1:
  Day 1: Owner adds supplier ("Toko Maju")
  Day 2: Kasir takes 2 photos of nota → System OCR → Confirm ✅
  Day 3: Stok alert fires → Admin checks → All good ✅

Week 2:
  Day 1: Kasir belanja lagi (Toko Maju) → System suggests last items → Kasir click OK ✅
  Day 2: Driver delivers → Click confirm portions → Stok auto-updated ✅
  Day 3: Kasir reconciles → Everything matches → Approve ✅

= Simple, fast, reliable workflow! 🎉
```
