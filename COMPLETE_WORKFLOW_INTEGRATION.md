# 🔗 COMPLETE WORKFLOW INTEGRATION - Web & Telegram (April 2026)

**Status**: Comprehensive integration guide for Web Dashboard + Telegram Bot  
**Last Updated**: April 20, 2026  
**Version**: 2.0  

---

## 📊 SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTEGRATED SYSTEM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐              ┌──────────────────────┐            │
│  │   TELEGRAM BOT       │              │   WEB DASHBOARD      │            │
│  │  (Mobile-first)      │              │  (Desktop/Detail)    │            │
│  │                      │              │                      │            │
│  │  • Real-time input   │◄────────────►│  • Setup & config    │            │
│  │  • Quick actions     │   Firebase   │  • Analytics         │            │
│  │  • Notifications     │   Real-time  │  • Reports           │            │
│  │  • Confirmations     │     Sync     │  • Detailed viewing  │            │
│  │                      │              │  • Bulk operations   │            │
│  └──────────────────────┘              └──────────────────────┘            │
│          ↓                                      ↓                            │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │                     FastAPI Backend                              │     │
│  │  (Core Business Logic & API Endpoints)                           │     │
│  │                                                                   │     │
│  │  • Transaction processing                                        │     │
│  │  • OCR & AI matching                                             │     │
│  │  • Role-based access control                                     │     │
│  │  • Background jobs (OCR, alerts)                                 │     │
│  │  • Webhook integrations                                          │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│          ↓                                                                   │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │                  Supabase (Database + Auth)                       │     │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────────┐  │     │
│  │  │  PostgreSQL DB  │  │  JWT Auth    │  │  Cloud Storage      │  │     │
│  │  │                 │  │              │  │  (Photos/PDFs)      │  │     │
│  │  │ • users         │  │  • Tokens    │  │                     │  │     │
│  │  │ • transactions  │  │  • Sessions  │  │  • Receipt photos   │  │     │
│  │  │ • products      │  │  • Roles     │  │  • Generated PDFs   │  │     │
│  │  │ • suppliers     │  │              │  │  • Exports          │  │     │
│  │  │ • schools       │  │              │  │                     │  │     │
│  │  │ • ledgers       │  │              │  │                     │  │     │
│  │  │ • ... (more)    │  │              │  │                     │  │     │
│  │  └─────────────────┘  └──────────────┘  └─────────────────────┘  │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

🔄 DATA SYNC: Real-time (WebSocket) for Telegram ↔ Web
🔐 AUTH: JWT tokens managed by Supabase
⚡ PERFORMANCE: Telegram = fast response, Web = detailed views
```

---

# 🌐 PART 1: WEB DASHBOARD WORKFLOW

## PHASE 1: SETUP & MASTER DATA (One-time, Owner)

### Step 1: Registration & Initial Setup

```
USER VISIT: app.example.com
    ↓
┌─ Registration Page ──────────────────┐
│ Input:                               │
│ • Business name                      │
│ • Email                              │
│ • Password                           │
│ • Phone                              │
│ • Address                            │
│                                      │
│ [Register]                           │
└──────────────────────────────────────┘
    ↓
BACKEND: POST /auth/register
    ├─ Hash password
    ├─ Create tenant (business)
    ├─ Create owner user
    ├─ Create JWT token
    └─ Send welcome email
    ↓
┌─ Redirect to Dashboard ──────────────┐
│ Welcome, Owner!                      │
│ Next: Setup master data              │
│ [Start Setup Wizard]                 │
└──────────────────────────────────────┘
```

### Step 2: Master Data Setup (Guided Wizard)

```
SETUP WIZARD SEQUENCE:

1️⃣ SUPPLIERS
   Dashboard → Settings → Suppliers
   
   ├─ Click [+ Add Supplier]
   │  Input:
   │  • Name: "Toko Maju"
   │  • Address
   │  • Phone
   │  • PIC name
   │  • Email
   │  • Payment terms
   │
   ├─ Save to DB: INSERT suppliers
   ├─ Repeat 5-10 times
   └─ OR Use: Bulk CSV Import
       File → Upload CSV with columns:
       (name, address, phone, pic_name, email)
       ✅ Batch insert 50+ suppliers in minutes

2️⃣ PRODUCTS/INGREDIENTS
   Dashboard → Settings → Products
   
   ├─ Click [+ Add Product]
   │  Input:
   │  • Name: "Beras Merah Premium"
   │  • Unit: kg/liter/pcs
   │  • Category: Ingredient/Packaging/Operational
   │  • Minimum stock
   │  • Last purchase price
   │  • Description
   │
   ├─ Save to DB: INSERT products
   ├─ Repeat 20-50 times
   └─ OR Use: Bulk CSV Import

3️⃣ SCHOOLS/BENEFICIARIES
   Dashboard → Settings → Schools
   
   ├─ Click [+ Add School]
   │  Input:
   │  • School name
   │  • NPSN (ID number)
   │  • Student count
   │  • Principal name
   │  • Principal phone
   │  • Address
   │  • Contact person
   │
   ├─ Save to DB: INSERT schools
   ├─ Repeat 3-10 times
   └─ OR Use: Bulk CSV Import

4️⃣ TEAM MEMBERS & ROLES
   Dashboard → Settings → Team Members
   
   ├─ Click [+ Invite Member]
   │  Input:
   │  • Email: "admin@business.com"
   │  • Role: [Owner / Admin / Kasir / Driver]
   │  • Name
   │  • Phone
   │
   ├─ Send invite email
   ├─ User confirms & creates password
   ├─ Gets JWT token
   ├─ Access based on role:
   │  ├─ Owner = Full access
   │  ├─ Admin = Operations + Reports
   │  ├─ Kasir = Transactions + Reconcile
   │  └─ Driver = Deliveries only
   │
   └─ Repeat untuk semua team members

5️⃣ SETTINGS & CONFIGURATION
   Dashboard → Settings → General
   
   ├─ Budget allocation (total budget)
   ├─ Currency (IDR default)
   ├─ Time zone
   ├─ Financial year start
   ├─ Notification preferences
   └─ Integration settings (Telegram bot link)

RESULT: ✅ System fully configured & ready!
TIME: ~1-2 hours (one-time)
```

---

## PHASE 2: DAILY OPERATIONS (Admin/Kasir via Telegram or Web)

### Option A: Via TELEGRAM BOT (Fast, mobile)

**Kasir melakukan input transaksi via Telegram** → Real-time sync ke Web

```
KASIR SCENARIO: Mau record pembelian dari Toko Maju

┌─ PHOTO RECEIPT WORKFLOW ─────────────────────────────────────┐
│                                                                │
│ 📷 KASIR at store, take photos of receipts (5 items)         │
│                                                                │
│ Telegram Bot:                                                  │
│ [📷 Photo 1] [📷 Photo 2] [📷 Photo 3] [📷 Photo 4] [📷 Photo 5]
│                                                                │
│ After each: Bot responds                                      │
│ "✅ Photo 1/5 received. Compress 85% to 120px width"         │
│ "📷 2 photos gathered, click [Done] or send more..."         │
│                                                                │
│ After 5 or user click [✅ Selesai]:                          │
│ ├─ All 5 photos uploaded to Supabase Storage                 │
│ ├─ Backend: POST /transactions/ocr/batch                     │
│ ├─ Trigger async job: OCR process                            │
│ │  ├─ Call Gemini Vision API                                 │
│ │  ├─ Extract items, prices, total, supplier                │
│ │  ├─ Apply product alias matching                           │
│ │  ├─ Validate amounts                                       │
│ │  └─ Return confidence scores                               │
│ │                                                              │
│ ├─ Backend creates transaction record:                        │
│ │  ├─ transaction_id: TRX-2026-0420-001                      │
│ │  ├─ status: "pending_confirmation"                         │
│ │  ├─ photo_urls: [url1, url2, ...]                          │
│ │  └─ extracted_items: [...]                                 │
│ │                                                              │
│ ├─ Backend sends notification back to Telegram:              │
│ │  "✅ OCR SELESAI!"                                          │
│ │                                                              │
│ │  Items Detected:                                           │
│ │  ✅ Beras 10 kg @ Rp 12,000 (98% confidence)              │
│ │  ✅ Minyak 5 L @ Rp 15,000 (95% confidence)               │
│ │  ⚠️  Gula 20 kg @ Rp 8,000 (72% confidence)               │
│ │  ❓ Garam ??? (unclear item)                                │
│ │                                                              │
│ │  Supplier: Toko Maju                                        │
│ │  Total: Rp 395,000                                          │
│ │                                                              │
│ │  [✅ Confirm] [✏️ Edit Items] [❌ Cancel]                   │
│ │                                                              │
│ └─ KASIR clicks [✅ Confirm]                                 │
│    ├─ Backend: UPDATE transaction status="confirmed"         │
│    ├─ Auto-create stok_ledger entries (incoming stock)       │
│    ├─ Auto-create kas_ledger entry (cash in)                 │
│    ├─ Auto-update product stock quantities                   │
│    ├─ Auto-update budget allocation                          │
│    └─ Send confirmation to Telegram                          │
│       "✅ Transaksi #TRX-2026-0420-001 confirmed!"          │
│                                                                │
│ WEB DASHBOARD (Real-time update):                            │
│ ├─ Pembukuan page auto-refresh → new transaction visible    │
│ ├─ Stok page auto-refresh → quantities updated               │
│ ├─ Budget page auto-refresh → allocation updated             │
│ └─ Owner sees it immediately (if online)                     │
│                                                                │
│ ⏱️  TOTAL TIME: 1-2 minutes                                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘

OR

┌─ MANUAL INPUT WORKFLOW ──────────────────────────────────────┐
│ (If no receipt or informal transaction)                       │
│                                                                │
│ Telegram command: /belanja                                    │
│                                                                │
│ Step 1: Select Supplier                                       │
│ ├─ Bot shows suggestions:                                     │
│ │  [Toko Maju] [Toko A] [Supplier XYZ] [Edit Manually]      │
│ ├─ KASIR clicks [Toko Maju]                                  │
│ └─ Next step                                                  │
│                                                                │
│ Step 2: Items (Pre-filled from last transaction)             │
│ ├─ Bot shows:                                                │
│ │  "Last items to Toko Maju:"                                │
│ │  • Beras 10 kg Rp 120,000                                  │
│ │  • Minyak 5 L Rp 75,000                                    │
│ │  • Gula 20 kg Rp 160,000                                   │
│ │                                                              │
│ │  [✅ Use These] [✏️ Edit] [❌ New]                         │
│ │                                                              │
│ ├─ KASIR clicks [✅ Use These] → Done with items             │
│ └─ Next step                                                  │
│                                                                │
│ Step 3: Payment Method                                       │
│ ├─ Bot shows buttons:                                        │
│ │  [💵 Tunai] [🏦 Transfer] [📋 Hutang]                     │
│ ├─ KASIR clicks [💵 Tunai]                                   │
│ └─ Next step                                                  │
│                                                                │
│ Step 4: Confirmation                                         │
│ ├─ Bot shows summary:                                        │
│ │  Supplier: Toko Maju                                        │
│ │  Items: 3                                                   │
│ │  Total: Rp 355,000                                          │
│ │  Payment: Tunai                                             │
│ │                                                              │
│ │  [✅ OK] [✏️ Edit] [❌ Cancel]                              │
│ │                                                              │
│ └─ KASIR clicks [✅ OK]                                      │
│    ├─ Backend creates transaction                            │
│    ├─ Auto-update stok & kas ledger                          │
│    ├─ Send confirmation                                       │
│    └─ WEB dashboard updates real-time                        │
│                                                                │
│ ⏱️  TOTAL TIME: 1-2 minutes (60% faster than typing all!)   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### Option B: Via WEB DASHBOARD (Detailed, historical)

**For recording past transactions or detailed entry**

```
KASIR SCENARIO: Enter yesterday's transaction (forgot to record via Telegram)

Web Dashboard → Pembukuan → [+ Add Transaction]

┌─ Transaction Entry Form ──────────────────────────────────────┐
│                                                                │
│ Basic Info:                                                    │
│ • Date: [Date Picker] (default: today)                        │
│ • Supplier: [Dropdown with search]                            │
│ • Reference No.: [Text field optional]                        │
│ • Notes: [Text area optional]                                 │
│                                                                │
│ Items Table:                                                   │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Product │ Qty │ Unit │ Price │ Subtotal │ Category    │   │
│ ├─────────────────────────────────────────────────────────┤   │
│ │ Beras   │ 10  │ kg   │ 12000 │ 120,000  │ Ingredient  │   │
│ │ Minyak  │ 5   │ L    │ 15000 │ 75,000   │ Ingredient  │   │
│ │ Gula    │ 20  │ kg   │ 8000  │ 160,000  │ Ingredient  │   │
│ │ [+ Add] │     │      │       │          │             │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                │
│ Payment Info:                                                  │
│ • Payment Method: [Tunai / Transfer / Hutang]                │
│ • If Hutang: Due Date: [Date picker]                         │
│                                                                │
│ Summary:                                                       │
│ • Subtotal: Rp 355,000                                        │
│ • Discount: Rp 0                                              │
│ • Tax (PPN): Rp 0                                             │
│ • TOTAL: Rp 355,000                                           │
│                                                                │
│ [Save] [Preview] [Cancel]                                     │
│                                                                │
└─────────────────────────────────────────────────────────────────┘

After clicking [Save]:
├─ Backend validates all fields
├─ Creates transaction record in DB
├─ Updates stok_ledger
├─ Updates kas_ledger
├─ Updates budget_allocation
├─ Notification sent to Telegram (if configured)
└─ Redirects to transaction detail view

RESULT:
• Transaction visible in Pembukuan table immediately
• History available for future reference
• Stok counts updated
• Can still edit if needed
```

---

## PHASE 3: MONITORING & ANALYTICS (All users)

### Daily Dashboard View

```
ADMIN/OWNER opens: app.example.com/dashboard

┌─────────────────────────────────────────────────────────────┐
│                     DASHBOARD HOME                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 KEY METRICS (Auto-refresh every 5 minutes)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Today's Spending: Rp 1,250,000                        │   │
│  │ Stock Status: 8 ✅ | 2 ⚠️ | 1 🔴                      │   │
│  │ Budget Used: 77% (Rp 15.4M / 20M)                   │   │
│  │ Pending Approval: 3 transactions                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  📈 CHARTS (Interactive)                                    │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Daily Spending   │  │ Stock Levels     │                │
│  │ (Line chart)     │  │ (Bar chart)      │                │
│  │ Last 7 days      │  │ vs Minimum       │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                               │
│  🔴 ALERTS & NOTIFICATIONS                                  │
│  • ⚠️ Beras stock: 5 kg (will run out in 4 days)           │
│  • 📝 3 transactions pending approval                       │
│  • 💰 Budget allocation updated (Minyak +8%)               │
│  • ✅ Delivery completed: 5 schools delivered today        │
│                                                               │
│  📋 RECENT TRANSACTIONS (Live feed)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ #TRX-2026-0420-005 | Toko A    | Rp 450,000 | 5 min ago│  │
│  │ #TRX-2026-0420-004 | Toko Maju | Rp 355,000 | 1 hr ago  │  │
│  │ #TRX-2026-0420-003 | Sup XYZ   | Rp 200,000 | 3 hrs ago │  │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  [View All] [Export] [Settings]                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Detailed Reporting Pages

```
📊 PEMBUKUAN (Bookkeeping / Transactions)
Dashboard → Pembukuan
├─ Filter by date range
├─ Filter by supplier
├─ Filter by payment status
├─ View transactions in table format
├─ Click row → View full details
├─ Click transaction → Edit if needed
├─ Bulk actions: Mark as approved, export
└─ Generate daily/weekly/monthly summaries

📦 STOK (Inventory Management)
Dashboard → Stok
├─ All products with current quantities
├─ Minimum stock thresholds
├─ Status indicators (OK, Warning, Low)
├─ Consumption rates (30-day avg)
├─ Forecast: When will run out?
├─ Click product → Detailed history
├─ Stock movements (in/out ledger)
└─ Generate stok opname report

💰 HUTANG-PIUTANG (Payables & Receivables)
Dashboard → Hutang-Piutang
├─ Suppliers: Money we owe them
├─ By supplier with due dates
├─ Filter by: Due date, amount, status
├─ Mark as paid
├─ Generate payment reminders
└─ Export payment schedule

💹 TRACK HARGA (Price Tracking)
Dashboard → Track Harga
├─ Historical price per product
├─ Chart showing price trends
├─ Compare suppliers
├─ Identify best deals
├─ Alert if price spike detected
└─ Budget impact analysis

📈 LAPORAN (Reports)
Dashboard → Laporan
├─ Daily Summary Report
│  ├─ Cash in/out
│  ├─ Stock changes
│  ├─ Transactions summary
│  └─ Export as PDF
│
├─ Weekly Summary
│  ├─ Spending by supplier
│  ├─ Spending by category
│  ├─ Price trends
│  └─ Delivery performance
│
├─ Monthly Report
│  ├─ Budget vs actual
│  ├─ Year-to-date totals
│  ├─ Trend analysis
│  └─ Compliance check
│
└─ Export Options: PDF, Excel, CSV
```

---

# 📱 PART 2: TELEGRAM BOT WORKFLOW

## Core Commands & State Machines

```
TELEGRAM MENU STRUCTURE:

[Main Menu]
├─ 📷 [Catat Nota] → Photo batch OCR workflow
├─ 📝 [Input Belanja] → Manual transaction entry
├─ 📅 [Menu Minggu] → Weekly menu planning
├─ 📦 [Serah Barang] → Delivery confirmation
├─ 📊 [Lihat Stok] → Quick stock check
├─ 💰 [Laporan] → Quick report view
├─ ⚙️ [Settings]
│  ├─ [Ganti Bahasa]
│  ├─ [Notifikasi]
│  └─ [Logout]
└─ [Help]
```

### Command Deep Dive

#### 1. `/catat-nota` - Photo Receipt OCR (ConversationHandler)

```
STATE MACHINE:

INIT: User clicks [Catat Nota] or /catat-nota
  ↓
Bot response:
"📷 CATAT NOTA OTOMATIS
Kirim foto nota belanja (bisa multiple).
Max 5 foto sekaligus atau 5 menit timeout.
Klik [Selesai] ketika semua foto terkirim."

[Selesai] button always visible

USER: Sends photos
  ├─ Photo 1 → Handler: download, compress, add to batch
  │           → Bot: "📷 1 foto terkumpul [Selesai 1/5]"
  │
  ├─ Photo 2 → Handler: download, compress, add to batch
  │           → Bot: "📷 2 foto terkumpul [Selesai 2/5]"
  │
  ├─ Photo 3 → Handler: download, compress, add to batch
  │           → Bot: "📷 3 foto terkumpul [Selesai 3/5]"
  │
  └─ Photo 4 & 5...
    [After 5 or user click Selesai]

AUTO-TRIGGER: 5 menit timeout (no activity)
  ├─ Check: batch is not empty
  ├─ If yes → auto-submit
  └─ Send: "⏰ Auto-submit in 5 min" warning at 4.5 min

USER: Clicks [Selesai] after photos
  ↓
Backend: POST /transactions/ocr/batch
├─ Upload all photos to Supabase Storage
├─ Assign photo_batch_id
├─ Create pending transaction records
├─ Trigger async OCR job
│  ├─ Call Gemini Vision API
│  ├─ Extract items, prices, supplier
│  ├─ Apply product matching (fuzzy)
│  ├─ Validate amounts
│  └─ Calculate confidence scores
│
└─ When OCR done:
   Send Telegram notification with results

Bot response (after OCR):
"✅ OCR SELESAI!

Items:
✅ Beras 10 kg @ Rp 12,000 (98%)
✅ Minyak 5 L @ Rp 15,000 (95%)
⚠️ Gula 20 kg @ Rp 8,000 (72%)
❓ [Unknown item 1] - unclear

Supplier: Toko Maju
Total: Rp 395,000

[✅ Confirm] [✏️ Edit] [❌ Cancel]"

USER: Clicks [✅ Confirm]
  ↓
Backend:
├─ Finalize transaction
├─ Update stok ledger
├─ Update kas ledger
├─ Update budget
└─ Create notification

Bot response:
"✅ Transaksi #TRX-2026-0420-001 CONFIRMED!

Transaction saved with:
- 3 verified items
- Rp 395,000 total
- Status: Posted

All ledgers updated. ✅"

END OF WORKFLOW
```

#### 2. `/belanja` - Manual Transaction Entry (ConversationHandler)

```
STATE MACHINE: 4 states

STATE 0: INPUT_SUPPLIER
─────────────────────────
User triggers: /belanja or [Input Belanja] button
  ↓
Bot:
"📝 INPUT BELANJA MANUAL
Langkah 1/3: Siapa supplier?

(Suggestions from history)
[Toko Maju] [Toko A] [Supplier XYZ]

Atau ketik nama lain..."

USER: Clicks [Toko Maju]
  → context.user_data["supplier_id"] = "..."
  → context.user_data["supplier_name"] = "Toko Maju"
  → Move to STATE 1

─────────────────────────

STATE 1: INPUT_ITEMS
──────────────────────
Bot:
"Langkah 2/3: Daftar belanja

Last items to Toko Maju:
• Beras 10 kg Rp 120,000
• Minyak 5 L Rp 75,000
• Gula 20 kg Rp 160,000

[✅ Use these] [✏️ Edit qty] [❌ New items]"

USER: Clicks [✅ Use these]
  → context.user_data["items"] = [auto-filled items]
  → Move to STATE 2

─────────────────────────

STATE 2: CONFIRM_BELANJA
─────────────────────────
Bot:
"Langkah 3/3: Metode bayar?

Items: 3
Total: Rp 355,000

[💵 Tunai] [🏦 Transfer] [📋 Hutang]"

USER: Clicks [💵 Tunai]
  → context.user_data["payment_method"] = "tunai"
  → Move to STATE 3 (if tunai/transfer) OR wait for more input (if hutang)

─────────────────────────

STATE 3: CONFIRM_FINAL (if needed)
──────────────────────────────────
If payment_method == "hutang":
  
Bot:
"Kapan hutang ini akan dibayar?

Contoh: '3 hari', '20 April', '15 Mei'"

USER: Ketik "1 minggu"
  → Parse date → Add to transaction
  → Move to confirmation

─────────────────────────

FINAL CONFIRMATION:
──────────────────
Bot:
"Ringkasan belanja:

Supplier: Toko Maju
Items: 3
Total: Rp 355,000
Bayar: Tunai

[✅ OK] [✏️ Edit] [❌ Batal]"

USER: Clicks [✅ OK]
  ↓
Backend: POST /transactions
├─ Create transaction record
├─ Update ledgers
├─ Send notification
└─ Confirm to Telegram

Bot:
"✅ Transaksi #TRX-2026-0420-002 SAVED!

Status: Posted
All ledgers updated."

END OF WORKFLOW
```

#### 3. `/menu` - Weekly Menu Planning (ConversationHandler)

```
STATE MACHINE: 5 states

STATE 0: SHOW_WEEK
──────────────────
User: /menu or [Menu Minggu]
  ↓
Bot shows grid:

"📅 MENU MINGGU (14-20 April 2026)

[Senin 14]   ⬜ Kosong
[Selasa 15]  ⬜ Kosong
[Rabu 16]    ⬜ Kosong
[Kamis 17]   ⬜ Kosong
[Jumat 18]   ✅ Nasi Kuning (with BOM)
[Sabtu 19]   [Optional]

Klik hari untuk edit..."

Buttons:
[Senin] [Selasa] [Rabu] [Kamis] [Jumat] [Sabtu]

─────────────────────────

STATE 1: WAITING_INPUT
──────────────────────
User: Clicks [Selasa]
  ↓
Bot:
"Masukkan menu untuk Selasa, 15 April 2026:
(Contoh: 'Nasi Goreng', 'Soto Ayam', dll)"

User: Ketik "Nasi Goreng"
  ↓
context.user_data["selected_day"] = "Selasa"
context.user_data["menu_name"] = "Nasi Goreng"
  → Move to STATE 2

─────────────────────────

STATE 2: VALIDATING_MENU
──────────────────────────
Backend: POST /weekly-menus/validate
├─ Check: is "Nasi Goreng" already in BOM library?
├─ If yes → auto-link BOM
├─ Calculate ingredients needed
└─ Return: menu_id, bom_items[]

Bot:
"✅ Menu ditemukan di perpustakaan!

Bahan (BOM):
• Beras: 50 kg
• Ayam: 20 kg
• Minyak: 5 L
• Garam: 2 kg

Ada BOM sudah tersimpan.

[✅ Pakai BOM ini] [✏️ Edit BOM] [❌ Ubah Menu]"

User: Clicks [✅ Pakai BOM ini]
  → context.user_data["bom_id"] = "..."
  → Save to DB: INSERT weekly_menus
  → Move back to SHOW_WEEK (STATE 0)
  → Grid updates to show [Selasa] ✅

─────────────────────────

STATE 3: CONFIRM_NO_BOM (if new menu)
──────────────────────────────────────
If menu not in library:

Bot:
"Menu 'Nasi Ayam Spesial' belum ada di BOM.

[✅ Simpan Tanpa BOM] [📝 Input BOM Sekarang]"

If user clicks [📝 Input BOM]:
  → Move to STATE 4

─────────────────────────

STATE 4: INPUT_BOM_INLINE
──────────────────────────
Bot:
"Ketik bahan-bahan per baris:

Format: Nama Qty Unit
Contoh: Beras 50 kg
        Ayam 20 kg
        Minyak 5 L

Ketik /selesai ketika selesai"

User: 
Beras 50 kg
Ayam 20 kg
Minyak 5 L
/selesai

Bot parses each line → validates qty & unit
  ↓
Backend: POST /weekly-menus
├─ Create menu record
├─ Create BOM items
├─ Link to weekly schedule
└─ Update inventory forecast

Bot:
"✅ Menu Nasi Ayam Spesial dengan BOM saved untuk Rabu!"

Grid updates → [Rabu] ✅ with BOM indicator

END OF WORKFLOW
```

#### 4. `/serah` - Delivery Confirmation

```
USER SCENARIO: Driver confirm delivery

Telegram command: /serah or [Serah Barang]
  ↓
Bot:
"📦 PENYERAHAN BARANG

Sistem memprediksi portions berdasarkan:
• Enrollment per sekolah
• Attendance historis
• Menu hari ini

SEKOLAH ABC (250 siswa @ 95% attendance):
• Beras: 48.5 kg (75g per anak)
• Lauk:  65 kg (100g per anak)
• Sambal: 15 kg (50g per anak)

SEKOLAH XYZ (180 siswa @ 92% attendance):
• Beras: 34 kg
• Lauk:  48 kg
• Sambal: 12 kg

[✅ OK] [✏️ Edit] [📝 Manual Input]"

User: Clicks [✅ OK]
  ↓
Bot:
"Mulai delivery:

[Sekolah ABC] [Sekolah XYZ] [Sekolah DEF] ..."

User: Clicking on Sekolah ABC
  ↓
Bot:
"Apakah sudah deliver ke Sekolah ABC?

Confirm:
• Beras: 48.5 kg
• Lauk:  65 kg
• Sambal: 15 kg

Siapa yang menerima? [Name input field]
Ambil foto tanda terima (optional)

[✅ Confirm] [❌ Skip for now]"

User: Clicks [✅ Confirm]
  ↓
Backend: POST /deliveries
├─ Create delivery record
├─ Update stok_ledger (outgoing)
├─ Record attendance/delivery data
├─ Create delivery note
└─ Notify Admin

Bot:
"✅ Sekolah ABC: DELIVERED
48.5 kg Beras, 65 kg Lauk, 15 kg Sambal

[Next School] [Done] [Edit]"

User: Clicks [Next School]
  → Repeat for next school

When done with all schools:

Bot:
"✅ DELIVERY COMPLETE!

Summary:
- 5 schools delivered
- 250 kg total distributed
- All stok updated
- Proof of delivery saved

[View Receipt] [Report] [Done]"

END OF WORKFLOW
```

#### 5. `/stok` - Quick Stock Check

```
USER: Clicks [Lihat Stok] or /stok
  ↓
Bot:
"📦 STOCK STATUS (As of April 20, 2026 - 3:45 PM)

✅ Beras: 50 kg (min: 10 kg) - GOOD
✅ Gula: 45 kg (min: 20 kg) - GOOD
⚠️ Minyak: 3 L (min: 5 L) - WARNING
🔴 Garam: 2 kg (min: 10 kg) - LOW!

[📊 Detailed] [⏰ History] [📝 Adjust]"

User: Clicks [📊 Detailed]
  → Web link opens to dashboard
  → Can see full stok chart with trends

END OF WORKFLOW
```

---

# 🔄 INTEGRATION PATTERNS

## Real-time Sync: Telegram ↔ Web

```
When KASIR creates transaction via TELEGRAM:

1. Telegram command sent
   ↓
2. Backend processes (creates DB records)
   ↓
3. WebSocket event fired: transaction_created
   ↓
4. All connected Web clients receive update
   ↓
5. Dashboard automatically refreshes:
   ├─ Pembukuan page (new transaction visible)
   ├─ Stok page (quantities updated)
   ├─ Dashboard (metrics updated)
   └─ Budget page (allocation adjusted)
   ↓
6. Owner/Admin sees live update (no refresh needed!)

⏱️ Latency: <1 second
```

## Push Notifications: Web → Telegram

```
When transaction requires APPROVAL:

1. Kasir creates transaction via Telegram
   ↓
2. If amount > threshold → needs approval
   ↓
3. Backend sends notification:
   
   To: Admin's Telegram
   Message:
   "🔔 APPROVAL NEEDED
   
   Transaction #TRX-2026-0420-003
   Supplier: Toko Besar
   Amount: Rp 5,000,000 (exceeds threshold)
   
   Details: [View on Web]
   
   [✅ Approve] [❌ Reject] [🔍 Details]"
   ↓
4. Admin clicks [✅ Approve] in Telegram
   ↓
5. Backend processes approval
   ↓
6. Confirmation sent to Kasir & Owner
   ↓
7. Web dashboard updates automatically
```

## Automated Alerts: Backend → Telegram

```
MORNING ALERTS (7 AM daily):

System checks:
├─ Stock levels < minimum
├─ Budget approaching limit
├─ Pending approvals
├─ Deliveries scheduled
└─ Payment reminders

Sends to: Admin/Owner Telegram

Example:
"🔴 DAILY ALERTS (April 20, 2026)

1. Stock Low:
   ⚠️ Minyak: 2 L (min: 5 L) → Will run out in 2 days
   
2. Budget Status:
   ✅ Used: Rp 15.4M / Rp 20M (77%)
   
3. Pending:
   📝 1 transaction awaiting approval
   
4. Deliveries Today:
   ✅ 5 schools scheduled
   
[View Full Report]"
```

---

# 📊 DATA SYNCHRONIZATION

## Database Tables Involved

```
MASTER DATA (Set once):
├─ users (with telegram_id)
├─ suppliers
├─ products
├─ schools
└─ weekly_menus

TRANSACTION DATA (Real-time sync):
├─ transactions
├─ transaction_items
├─ photo_batches
├─ stok_ledger
└─ kas_ledger

OPERATIONAL DATA (Live):
├─ deliveries
├─ daily_portions
├─ attendance
└─ notifications_log

SETTINGS:
├─ tenant_settings
├─ role_matrix
└─ notification_preferences
```

## Sync Mechanism

```
TELEGRAM → WEB:
├─ User input (belanja, nota, serah) via Telegram
├─ Backend processes → DB update
├─ WebSocket event fired
├─ Web clients listening → receive update
└─ Dashboard refreshes (partial or full)

WEB → TELEGRAM:
├─ User changes settings on Web
├─ Backend updates DB
├─ Webhook event fired
├─ Telegram notifications sent
└─ Users informed via bot

BACKEND WORKERS:
├─ Every 5 minutes: Check for low stock
├─ Every hour: Generate reports
├─ Daily 7 AM: Send morning alerts
└─ On-demand: OCR processing for photos
```

---

# 🎯 USER JOURNEYS BY ROLE

## OWNER JOURNEY

```
Day 1 (Setup):
  9 AM: Register online
  ├─ Setup wizard (suppliers, products, schools)
  └─ Invite team members

Day 2+:
  7 AM: Open app → Dashboard
        ├─ Check daily metrics
        ├─ Review alerts
        └─ See yesterday's summary
  
  10 AM: Open Reports
         ├─ Spending analysis
         ├─ Budget tracking
         └─ Trend analysis
  
  Weekly: Detailed analytics
          ├─ Supplier performance
          ├─ Cost optimization
          └─ Strategic planning
  
  Tools Used: 90% Web Dashboard, 10% Telegram for alerts
```

## ADMIN JOURNEY

```
Daily Routine:
  7 AM: Telegram bot
       ├─ Receive stok alert
       ├─ Check what's low
       └─ Plan day
  
  9-12 PM: Monitor
          ├─ Receive belanja notifications from Kasir
          ├─ Approve if needed
          └─ Monitor operations
  
  1-4 PM: Check deliveries
         ├─ Receive delivery confirmations
         ├─ Verify portions
         └─ Confirm stok updates
  
  5 PM: Web dashboard
       ├─ Review daily reconciliation
       ├─ Check final numbers
       └─ Generate report
  
  Tools Used: 50% Telegram, 50% Web Dashboard
```

## KASIR JOURNEY

```
Daily Routine:
  Morning: Check schedule
  
  9-12 PM: Record purchases
          ├─ Take photos of receipts
          ├─ Send to Telegram /catat-nota
          ├─ Confirm OCR results
          └─ Transaction recorded
  
  1-4 PM: Quick checks
         ├─ /stok to verify inventory
         └─ Handle any adjustments
  
  5 PM: Reconciliation
       ├─ Open Web dashboard
       ├─ Review all transactions
       ├─ Reconcile cash
       └─ Generate daily report
  
  Tools Used: 70% Telegram, 30% Web Dashboard
```

## DRIVER JOURNEY

```
Afternoon (1-4 PM):
  ├─ Receive delivery manifest (Telegram notification)
  ├─ Pick up goods
  ├─ Drive to schools
  │  └─ For each school:
  │     ├─ Open Telegram /serah
  │     ├─ Confirm portions delivered
  │     ├─ Get recipient signature
  │     └─ System records delivery
  │
  └─ Return & confirm all done
  
  Tools Used: 99% Telegram, minimal Web use
```

---

# 🔐 ROLE-BASED ACCESS CONTROL

```
┌────────────────────────────────────────────────────────────────────┐
│ Role        │ Telegram      │ Web Dashboard      │ Database Access │
├────────────────────────────────────────────────────────────────────┤
│ Owner       │ All commands  │ Full access        │ Full (admin)    │
│             │ Notifications │ Settings           │                 │
│             │               │ Reports            │                 │
│             │               │ Analytics          │                 │
├────────────────────────────────────────────────────────────────────┤
│ Admin       │ Most commands │ Operations         │ Operational     │
│             │ Notifications │ Reports            │ data only       │
│             │               │ No settings        │                 │
│             │               │ No financials      │                 │
├────────────────────────────────────────────────────────────────────┤
│ Kasir       │ Input cmds    │ Pembukuan          │ Transactions    │
│             │ /belanja      │ Reconciliation     │ only            │
│             │ /nota         │ No reports         │                 │
│             │ Notifications │ No analytics       │                 │
├────────────────────────────────────────────────────────────────────┤
│ Driver      │ /serah only   │ Minimal/None       │ Deliveries      │
│             │ Notifications │                    │ only            │
│             │               │                    │                 │
└────────────────────────────────────────────────────────────────────┘
```

---

# ⚙️ TECHNICAL ARCHITECTURE

## API Endpoints Used

```
TELEGRAM BOT ENDPOINTS:

POST /transactions/ocr/batch
  ├─ Upload photos
  ├─ Trigger OCR job
  └─ Return photo_batch_id

POST /transactions
  ├─ Create transaction from manual input
  └─ Return transaction_id

POST /transactions/{id}/confirm
  ├─ Finalize transaction
  └─ Update ledgers

GET /suppliers/recent
  ├─ Get suggestion suppliers
  └─ Return: [supplier]

GET /products/by-supplier/{id}
  ├─ Get last items for supplier
  └─ Return: [product]

GET /weekly-menus/validate
  ├─ Check if menu exists in BOM
  └─ Return: menu_id, bom_items

POST /weekly-menus
  ├─ Create menu with BOM
  └─ Return: menu_id

POST /deliveries
  ├─ Record delivery confirmation
  ├─ Update stok ledger
  └─ Return: delivery_id

GET /products/stock
  ├─ Get current stock levels
  └─ Return: [product with qty]

WEB DASHBOARD ENDPOINTS:

Same as above, plus:

GET /transactions (with filters)
GET /reports/daily
GET /reports/weekly
GET /reports/monthly
POST /bulk-import/suppliers
POST /bulk-import/products
GET /analytics/spending
GET /analytics/budget
GET /analytics/trends
... and many more
```

---

# 📝 WORKFLOW SUMMARY TABLE

| Scenario | Via Telegram | Via Web | Time | Best For |
|----------|--------------|---------|------|----------|
| Record pembelian foto | ✅ /catat-nota | ❌ | 1-2 min | Fast, mobile-first |
| Manual transaksi | ✅ /belanja | ✅ | 1-2 min / 2 min | Quick vs detailed |
| Plan menu minggu | ✅ /menu | ❌ | 10 min / 20 min | Interactive vs bulk |
| Confirm delivery | ✅ /serah | ❌ | 30s-1min | Mobile in field |
| Daily reconciliation | ❌ | ✅ | 5-10 min | Detailed review |
| Analytics/reports | ❌ | ✅ | 10-20 min | Strategic view |
| Master data setup | ❌ | ✅ | 1-2 hours | One-time, bulk |
| Stock monitoring | ✅ /stok | ✅ | 1 min / 5 min | Quick check vs trends |

---

# 🎯 AUTOMATION ROADMAP APPLIED

```
CURRENT STATE (April 2026):
├─ Photo OCR: 60% automated (Gemini + manual confirm)
├─ Manual input: 40% automated (suggestions + pre-fill)
├─ Alerts: 80% automated (daily checks + notifications)
└─ Reporting: 50% automated (summary generation)

AFTER QUICK WINS (8 weeks):
├─ Photo OCR: 80% automated
├─ Manual input: 80% automated
├─ Alerts: 95% automated
└─ Reporting: 80% automated
└─ RESULT: 70% manual reduction

FULL ROADMAP (8-16 weeks):
├─ Predictive portions: 90%
├─ Recurring pattern detection: 85%
├─ Smart scheduling: 80%
└─ ML-based optimization: 75%
└─ RESULT: 90% manual reduction
```

---

# 📞 SUPPORT & DOCUMENTATION

For more details on specific workflows, see:
- USER_WORKFLOWS.md - User journeys by role
- TELEGRAM_FEATURES_ANALYSIS.md - Telegram features deep-dive
- AUTOMATION_STRATEGY.md - Automation roadmap
- QUICK_WINS.md - Upcoming quick wins
- FRONTEND_IMPLEMENTATION_PLAN.md - Web dashboard implementation

---

**Document Status**: ✅ Current (April 20, 2026)  
**Covers**: Complete Telegram & Web integration  
**Last Review**: April 20, 2026
