# Analisa Fitur Telegram Bot MBG — Detail & Integration Roadmap

> **Status:** Telegram bot sudah 70% functional, siap diperluas untuk automation notifications
> 
> **User Target:** Owner, Admin, Kasir, Driver dengan role-based access
>
> **Integration Point:** Backend FastAPI + Supabase DB

---

## 1. FITUR YANG SUDAH ADA (Core Features)

### 1.1 Autentikasi & Akun Linking

**Command:** `/start`, `/logout`, `/settings`

**Alur:**
- User ketik `/start` → bot tanya pilih: login atau link akun
- **Opsi 1 (New User):** Lihat tombol "🔗 Hubungkan Akun" → klik → bot generate linking code → user masuk ke Web, get kode → ketik `/start <kode>` di bot → akun terhubung
- **Opsi 2 (Back User):** bot auto-retrieve session token → show main menu dengan role-specific buttons
- User bisa `/logout` untuk clear session

**Database:** User `telegram_id` disimpan di Supabase (modul 21.5a → `users.telegram_id`)

**Status:** ✅ Implemented (auth_handler.py + session management)

**Role-based Display:**
| Role | Menu Buttons | Comments |
|------|--------------|----------|
| owner | Semua fitur | Full access to all commands |
| admin | Hampir semua kecuali Laporan Laba | Can't view financial reports |
| kasir | Input (Menu, Belanja, Nota), Laporan Dasar | Can't modify settings |
| driver | /serah only (confirm deliveries) | Minimal access |

---

### 1.2 📅 Input Menu Mingguan (`/menu`)

**Command:** `/menu`

**Alur 6 steps (ConversationHandler):**

1. **SHOW_WEEK (State 0):** Bot tampil grid minggu Senin-Sabtu dengan status tiap hari
   - ✅ = BOM tersedia
   - ⚠️ = tanpa BOM
   - ⬜ = belum diisi

2. **SELECT_DAY:** User klik salah satu hari → bot tanya "Menu apa untuk [hari]?"

3. **WAITING_INPUT (State 1):** User ketik nama menu (misal: "Nasi Ayam Fillet")

4. **VALIDATING_MENU (State 2):** Bot kirim ke backend: `POST /weekly-menus/validate`
   - Backend cek: apakah menu sudah di BOM library?
   - Jika ada di BOM → auto-link + tanya "Tambah BOM? (Y/N)"
   - Jika baru → auto-create BOM placeholder, tanya user input BOM sekarang?

5. **CONFIRM_NO_BOM (State 3):** User pilih: "Simpan Tanpa BOM" atau "Input BOM Sekarang"
   - If tanpa BOM → save dengan `has_bom=false`
   - If input BOM → lanjut step 6

6. **INPUT_BOM_INLINE (State 4):** User input bahan baris-per-baris
   - Format: `Beras 10kg` (bot auto-parse qty & unit)
   - Bot terus tanya sampai user ketik `/selesai` → POST ke backend dengan full BOM

**Output:** Weekly menu saved dengan linked BOM → visible di web dashboard

**Status:** ✅ Implemented (menu_handler.py - WORKING)

**Automation Fit:** ⭐️⭐️⭐️⭐️ Ready for Phase 2 (AI menu suggestion bisa extend ini)

---

### 1.3 📝 Input Belanja Manual (`/belanja`)

**Command:** `/belanja`

**Alur 4 steps (ConversationHandler):**

1. **INPUT_SUPPLIER (State 0):** User ketik nama supplier atau `/skip`

2. **INPUT_ITEMS (State 1):** User ketik bahan baris-per-baris
   - Format: `Beras 10 kg 120000` (item, qty, unit, price)
   - Bot terus tanya sampai user ketik `/selesai`
   - Bot parse & validate: qty & price must be numeric

3. **CONFIRM_BELANJA (State 2):** Bot tampil ringkasan + tanya payment method:
   - 💰 Tunai (cash)
   - 🏦 Transfer (bank transfer)
   - 🤝 Hutang (diperhitungkan ke Hutang Supplier)
   - If hutang → go to step 4

4. **AWAIT_DUE_DATE (State 3):** User input due date (e.g., "3 hari" atau "15 Desember")
   - Bot parse tanggal → POST ke backend dengan `payment_method` + `due_date`

**Output:** Transaksi pembayaran dibuat di DB → visible di Web pembukuan

**Status:** ✅ Implemented (belanja_handler.py - WORKING but manual-heavy)

**Automation Fit:** ⭐️⭐️ Ini bisa disable ketika /nota (OCR) ready, karena /nota lebih cepat

---

### 1.4 📷 Foto Nota dengan Batch Processing (`/nota`)

**Command:** User kirim foto langsung ke chat (tidak ada command khusus)

**Workflow:**

1. **Photo Detection:** Telegram photo detected → handler `handle_photo()` dijalankan
   - Bot cek auth + role (`requires_role(['owner', 'admin', 'kasir'])`)
   - Bot download foto (biggest resolution)
   - Bot compress dengan `compress_photo()` (resize 1200px)

2. **Batch Accumulation:** Foto ditambah ke `context.user_data['photo_batch']`
   - Counter: `n = len(batch)`
   - Bot show: "📷 2 foto terkumpul" + tombol "✅ Selesai (2/5)"

3. **Auto-Submit Trigger:** 
   - If n >= 5 →auto-submit batch
   - If user click "✅ Selesai" → submit batch
   - If 5 menit no new photos → timeout & auto-submit

4. **Backend OCR + Storage:**
   - `POST /photo-batches` dengan semua foto ter-compress
   - Backend push ke job queue (Gemini Vision API call)
   - Async OCR: extract (nama_toko, items[], harga_satuan[], kategori, metode_bayar, confidence%)

5. **Konfirmasi Results:**
   - Backend OCR selesai → send Telegram message ke user
   - Tampil hasil parse: daftar items + harga + confidence % per item
   - Tombol: [✅ Konfirmasi] [✏️ Edit] [❌ Batalkan]
   - If edit → user select item no. → ketik teks baru → update

6. **Storage:** 
   - Confirmed OCR → POST `/transactions/bulk` dengan all items
   - Foto disimpan di Supabase Storage
   - Transaction entry created dengan `photo_batch_id` reference

**Status:** 🟡 Implemented (nota_handler.py - WORKING but Gemini integration status UNCLEAR)

**Automation Fit:** ⭐️⭐️⭐️⭐️⭐️ HIGHEST - This is Phase 1 Priority #1

**Key Files:**
- `nota_handler.py` - Photo handling + confirmation flow
- `handlers/confirm_nota()` - Confirm aggregated results
- `utils/image_utils.py` - compress_photo() function

---

### 1.5 🍱 Konfirmasi Penyerahan MBG (`/serah`)

**Command:** `/serah`

**Alur 2 steps (ConversationHandler):**

1. **INPUT_PORTIONS (State 0):** 
   - Bot fetch dari backend: `GET /mbg/allocations/today` → daftar sekolah + default portions
   - Bot tampil tombol tiap sekolah: "✏️ [Nama Sekolah] — 150 porsi"
   - User bisa klik untuk edit porsi, atau langsung "✅ Lanjut Dengan Kuota Default"

2. **CONFIRM_SERAH (State 1):**
   - Bot hitung & tampil: ringkasan total porsi + perkiraan alokasi (80:15:5)
   - Tombol: [✅ Konfirmasi] [❌ Batal]
   - If konfirmasi → `POST /mbg/deliveries/bulk` dengan all school data
   - Backend create delivery records + auto-calculate 80:15:5 breakdown → visible di Web Keuangan

**Status:** ✅ Implemented (serah_handler.py - WORKING)

**Automation Fit:** ⭐️⭐️⭐️ Medium - already automated but good for Driver role use-case

---

### 1.6 📊 Laporan & Dashboard Commands

**Commands:**
- `/hariini` - Daily summary (today's deliveries, expenses, revenue)
- `/laporan` - Monthly report (ringkasan bulan)
- `/stok` - Stock status (bahan melimpah/warning/habis)
- `/piutang` - Receivables from schools (tagihan belum dibayar)
- `/hutang` - Payables to suppliers (hutang belum dibayar)

**Workflow:**

Each command fetch dari backend endpoint:
- `/reports/daily` → daily KPIs
- `/reports/monthly` → monthly summary
- `/stok` → inventory status
- `/keuangan/piutang` → receivables
- `/keuangan/hutang` → payables

**Output:** Formatted Telegram message dengan:
- Rupiah formatting (Rp 1.234.567,00)
- Inline buttons: [❌ Batal] untuk quick navigation
- Role-based filtering (Driver tidak bisa lihat Laba)

**Example /hariini output:**
```
📊 RINGKASAN HARI INI
Senin, 15 Desember 2024

🍱 MBG DISTRIBUTION:
  - Total porsi: 1,250
  - Rata-rata per sekolah: 125 porsi
  - Revenue: Rp 18.750.000

💰 REVENUE:
  - Pemerintah MBG: Rp 18.750.000
  - Catering (tambahan): Rp 0
  
💸 EXPENSES:
  - Bahan Pangan: Rp 15.000.000 (-80%)
  - Upah: Rp 2.800.000 (-15%)
  - Operasional: Rp 750.000 (-5%)

💵 LABA BERSIH: Rp 200.000

[❌ Kembali]
```

**Status:** ✅ Implemented (report_handler.py - WORKING)

**Automation Fit:** ⭐️⭐️⭐️⭐️ Good for monitoring but read-only (no pain points)

---

### 1.7 ⚙️ Role-Based Access Control (RBAC)

**Framework:** `@requires_role(allowed_roles)` decorator (handlers/security.py)

**Applied To:**
- `catat_nota_cb()` → owner, admin, kasir only
- `handle_photo()` → owner, admin, kasir only
- Menu input → owner, admin only (drivers dapat hanya view)
- Financial reports → owner, admin only

**Access Matrix:**

| Fitur | Owner | Admin | Kasir | Driver | Notes |
|-------|-------|-------|-------|--------|-------|
| /menu | ✅ | ✅ | ❌ | ❌ | Input mingguan |
| /belanja | ✅ | ✅ | ✅ | ❌ | Input belanja manual |
| /nota (foto) | ✅ | ✅ | ✅ | ❌ | Upload nota |
| /serah | ✅ | ✅ | ✅ | ✅ | Confirm deliveries |
| /hariini | ✅ | ✅ | ✅ | ❌ | Daily summary |
| /laporan | ✅ | ✅ | ❌ | ❌ | Monthly financial |
| /stok | ✅ | ✅ | ❌ | ❌ | Stock status |
| /piutang, /hutang | ✅ | ✅ | ❌ | ❌ | Financial tracking |
| /settings | ✅ | ✅ | ❌ | ❌ | Configure account |

**Status:** ✅ Implemented + working (security.py - VERIFIED)

**Automation Fit:** ⭐️⭐️⭐️⭐️⭐️ Already in place for automation notifications (can restrict push alerts by role)

---

## 2. MISSING FEATURES (Gaps vs Automation Roadmap)

### Gap 1: Push Notifications ⛔ NOT YET IMPLEMENTED

**Required by Automation Roadmap Phase 1:**
- Compliance temperature alerts (real-time if too hot/cold)
- Food sample expiry reminders (⏰ 48h warning)
- Overdue payables alerts (⏰ payment due in X days)
- Compliance task reminders (⏰ daily/weekly)

**Current State:** 
- Bot = pull-based (user sends command → bot replies)
- No server-initiated notifications

**Architecture Gap:**
- Need webhook receiver OR
- Need polling middleware OR
- Need Firebase Cloud Messaging (FCM) integration

**Design Choice for Phase 1:**
- ✅ Option A: Telegram webhook (`/telegram/webhook`) endpoint
  - Pro: No external service needed, Django webhook receiver
  - Con: Requires static IP/reverse proxy
- ⚠️ Option B: Long-polling with job queue (Redis + RQ)
  - Pro: Works anywhere, familiar pattern
  - Con: Less real-time, higher latency
- ⭐️ Option C: Firebase Cloud Messaging (FCM)
  - Pro: Battle-tested, real-time, multi-device
  - Con: Additional cost, requires mobile app OR web push

**Recommendation for Phase 1:** Use **Option A (Telegram webhook)** as primary since it's already Telegram-integrated. Can add FCM later for web/mobile.

---

### Gap 2: Compliance Module Extension ⛔ NOT YET IMPLEMENTED

**Required by Automation Roadmap Phase 1:**
- Daily compliance checklist via bot (Higiene, Suhu, Sampel, Waste, Incidents)
- Photo upload for compliance (SLHS docs, incident photos)
- Real-time alert if temperature too high/low

**Current State:**
- Compliance module only on Web (/app/compliance/page.tsx)
- No Telegram integration

**New Handler Needed:**
```
/compliance or /checklist
  → Bot tampil form: Higiene (7 checks) + Suhu (3 areas) + etc
  → User can't fill BOM entry-by-entry like /menu
  → Push photo + quick stats
  → Auto-post ke backend
```

**Estimated Effort:** 3 handlers × ~200 lines = 600 lines

---

### Gap 3: IoT Device Integration ⛔ NOT YET IMPLEMENTED

**Required by Automation Roadmap Phase 2:**
- Temperature sensor → auto post to `/compliance/temperature` endpoint
- Attendance device → QR scan → auto upload
- Scale on warehouse shelf → auto stock deduction

**Current State:**
- No IoT device connection code in bot
- Thermal sensor data would need webhook receiver from device

**Future Consideration:** 
- Add webhook receiver for device-to-bot data ingestion
- Parse temp sensor JSON → auto-post compliance alert if out of range

---

### Gap 4: Payroll Processing Interface ⛔ NOT YET IMPLEMENTED

**Required by Automation Roadmap Phase 1:**
- `/payroll` command to view payroll summary
- Salary approval workflow (via callback buttons)
- Batch payment marking (mark as "paid" / set payment date)

**Current State:**
- No payroll commands in bot
- Web karyawan page is 70% manual

**New Handler Needed:**
```
/payroll
  → Bot fetch: GET /hr/payroll/current-month
  → Show: Total karawan, total gaji, outstanding
  → Button: [📝 Approve & Pay] → konfirmasi due date
  → POST /hr/payroll/mark-paid
```

---

### Gap 5: Multi-tenant Command Isolation ⛔ PARTIALLY VERIFIED

**Issue:** Bot token shared across ALL tenants globally?

**Current State:**
- `settings.telegram_bot_token` is single token per deployment
- Session store user via Telegram user_id + backend token
- Tenant_id derived from user's tenant_id in DB

**Concern:**
- If 2 SPPG share same bot deployment, can user see other's data?
  - Likely NO (backend enforces `tenant_id` isolation on auth)
  - But should verify in `api_client.get_token()` → check tenant_id header in all API calls

**Recommendation:** Audit `utils/api_client.py` to verify tenant_id is sent in headers on ALL requests

---

## 3. CURRENT INTEGRATION POINTS

### Backend API Endpoints Used

| Endpoint | Handler(s) | Method | Purpose |
|----------|-----------|--------|---------|
| `/auth/me` | auth_handler | GET | Verify authenticated user |
| `/tenants/telegram-link` | auth_handler | POST | Link Telegram account to web user |
| `/weekly-menus/validate` | menu_handler | POST | Validate menu name + get BOM |
| `/transactions/bulk` | belanja_handler, nota_handler | POST | Create expense transactions |
| `/photo-batches` | nota_handler | POST | Submit batch of OCR photos |
| `/mbg/allocations/today` | serah_handler | GET | Get today's school allocation |
| `/mbg/deliveries/bulk` | serah_handler | POST | Confirm deliveries |
| `/reports/daily` | report_handler | GET | Daily KPI summary |
| `/reports/monthly` | report_handler | GET | Monthly report |
| `/stok` | report_handler | GET | Stock status |
| `/keuangan/piutang` | report_handler | GET | Receivables |
| `/keuangan/hutang` | report_handler | GET | Payables |

### Database Tables Touched

| Table | Operation | Used By |
|-------|-----------|---------|
| `users` | UPDATE `telegram_id` | auth_handler (linking) |
| `weekly_menus` | CREATE/GET | menu_handler |
| `transactions` | CREATE | belanja_handler, nota_handler, serah_handler |
| `photo_batches` | CREATE | nota_handler |
| `mbg_deliveries` | CREATE | serah_handler |

### Session Storage

- **Method:** PicklePersistence (file: `bot_data.pickle`)
- **Data Stored:**
  - auth token (JWT)
  - user role
  - user name
  - conversation state (for ConversationHandlers)
  - batch photo metadata (photo_batch_id, accumulated photos)
- **Limitation:** File-based, not scalable for multi-instance deployment

**Recommendation for Phase 2:** Migrate to Redis persistence (railway-redis-addon)

---

## 4. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM USER                            │
└────────────────────┬────────────────────────────────────────┘
                     │ Messages/Photos/Callbacks
                     ▼
         ┌───────────────────────────┐
         │  Telegram Bot Polling     │
         │  (python-telegram-bot)    │
         └────────┬──────────────────┘
                  │
         ┌────────▼──────────┐
         │  Handler Router   │
         ├───────────────────┤
         │ • auth_handler    │
         │ • menu_handler    │
         │ • belanja_handler │
         │ • nota_handler    │
         │ • serah_handler   │
         │ • report_handler  │
         └────────┬──────────┘
                  │ API calls
         ┌────────▼──────────────────┐
         │  FastAPI Backend          │
         │  (python, async)          │
         ├───────────────────────────┤
         │ POST /photo-batches       │
         │ POST /transactions/bulk   │
         │ POST /mbg/deliveries/bulk │
         │ GET /reports/*            │
         └────────┬──────────────────┘
                  │
         ┌────────▼──────────────────┐
         │  Supabase PostgreSQL      │
         │  (multi-tenant + RLS)     │
         └───────────────────────────┘
                  │
         ┌────────▼──────────────────┐
         │ Async Job Queue (Redis?)  │
         │ → Gemini Vision OCR       │
         │ → Photo compression       │
         │ → Email/notification task │
         └───────────────────────────┘
```

---

## 5. TELEGRAM BOT FIT INTO AUTOMATION ROADMAP

### Phase 1 (Weeks 1-4): Foundation Automation

**What Telegram Enables:**
- ✅ Photo nota upload + OCR confirmation (Sprint 1.1 - Pembukuan)
- ✅ Compliance checklist + push alerts (Sprint 1.2 - Compliance)
- ✅ Payroll approval workflow + payment marking (Sprint 1.3 - HR)

**What Needs Addition:**
- ❌ Push notifications (webhook receiver)
- ❌ Compliance extension (new handler)
- ❌ Payroll interface (new handler)

### Phase 2 (Weeks 5-8): Advanced Automation

**What Telegram Can Do:**
- Bot queries AI recommendations ("Menu apa minggu depan? [Rekomendasi AI]")
- Driver receives delivery notifications
- Owner receives alerts when stock running low

**What Needs Addition:**
- IoT device webhook integration
- Redis persistence (for scaling)

### Phase 3 (Weeks 9-12): Intelligence & Optimization

**What Telegram Can Do:**
- Receipt of business insights ("Harga beras naik 5% minggu ini")
- Batch action confirmations (mark 10 payments as paid via single button)

---

## 6. RECOMMENDATIONS FOR NEXT STEPS

### Immediate (Before Phase 1 Development)

**Priority 1: Verify Tenant Isolation** ⏱️ 1 hour
- Code review: `utils/api_client.py` → ensure `tenant_id` sent in ALL requests
- Test: Create 2 test users in different tenants → verify they can't see each other's data via bot

**Priority 2: Verify OCR Integration Status** ⏱️ 2 hours
- Check: Is Gemini API integration code in backend? Where?
- Check: `/photo-batches` endpoint → does it call Gemini or is it stubbed?
- If stubbed: This is blocking Phase 1 Sprint 1.1

**Priority 3: Design Webhook Receiver** ⏱️ 3 hours
- Spec: Create `/telegram/webhook` endpoint in backend
- Spec: Design notification payload format (temperature alert, compliance task, payable reminder)
- Should work without modifying bot code (bot stays pull-based)

### Phase 1 Preparation

**Extend Notification Capabilities:**
1. Add `/telegram/webhook` endpoint (can POST notifications to)
2. Create notification queue in backend (store alerts, retry logic)
3. Add Telegram notification formatter (break long messages, add buttons)
4. Decide: Telegram webhook vs Firebase FCM for primary channel

**Compliance Module Extension:**
1. New handler: `/compliance` command
2. Form: Higiene (7 checkboxes) + Temp (3 text inputs) + Sampel photo upload
3. Backend: POST to `/compliance/entries` endpoint

**Payroll Interface:**
1. New handler: `/payroll` command
2. Display: Monthly summary, pending approvals
3. Workflow: Approve → confirm payment date → batch POST payment records

---

## 7. TECHNICAL DEBT & RISKS

### Risk 1: Pickle-Based Session Storage

**Issue:** `bot_data.pickle` not suitable for production multi-instance bot

**Impact:** 
- If you scale to 2+ bot instances, sessions might desync
- File loss = all user States reset

**Mitigation:** Use Redis persistence (1 day to migrate in Phase 2)

### Risk 2: Photo Batch Timeout

**Issue:** 5-minute timeout for batch accumulation might be too aggressive

**Impact:** 
- If Wi-Fi slow, user's photos might trigger timeout separately
- Results in 2-3 separate OCR jobs instead of batch of 5

**Mitigation:** Increase timeout to 10min or add "waiting for more photos" message

### Risk 3: No Operator Training

**Issue:** Current bot has 12 commands + deep conversation flows — unclear for new users

**Impact:** 
- Users might misuse `/belanja` (prefer to use `/nota`)
- Users might not know about `/serah` for drivers

**Mitigation:** Add "inline help" + operation manual in Web settings

### Risk 4: Unhandled Edge Cases in Photo Parsing

**Issue:** Photo metadata might be incomplete (unclear items, bad lighting, handwriting)

**Impact:** 
- OCR confidence < 60% → user must manually edit each line
- Could negate time savings of OCR

**Mitigation:** Add confidence % display + batch edit mode (edit all items at once)

---

## 8. COMPARISON: Telegram vs Web for Data Entry

| Feature | Telegram | Web | Better Choice |
|---------|----------|-----|---|
| Photo Upload | ✅ Native | ⚠️ Needs file input | **Telegram** |
| Multi-step form | ✅ Conversation | ✅ Tab-based | Tie (depends on user preference) |
| BOM entry | ⚠️ Line-by-line | ✅ Structured form | **Web** |
| Compliance checklist | ⚠️ Callback buttons | ✅ Rich checkbox form | **Web** |
| Menu planning | ✅ Quick input | ✅ Structured calendar | Tie |
| Real-time alerts | ✅ Push notification | ❌ Poll-based | **Telegram** |
| Approval workflows | ✅ Callback buttons | ✅ Status badges | Tie |

**Conclusion:** Telegram excels at INPUT (photos, quick forms, real-time alerts). Web excels at SETUP (master data, complex forms, visualization).

---

## SUMMARY TABLE: Telegram Feature Readiness

| Feature | Status | Phase | 
|---------|--------|-------|
| Auth & Linking | ✅ Ready | Now |
| Menu Input | ✅ Ready | Now |
| Manual Shopping | ✅ Ready | Now (can retire Phase 2) |
| Photo OCR | 🟡 Partial (OCR backend unclear) | Phase 1 |
| Delivery Confirmation | ✅ Ready | Now |
| Reports & Dashboards | ✅ Ready | Now |
| RBAC (roles) | ✅ Ready | Now |
| Push Notifications | ❌ Missing | Phase 1 |
| Compliance Module | ❌ Missing | Phase 1 |
| Payroll Interface | ❌ Missing | Phase 1 |
| IoT Integration | ❌ Missing | Phase 2 |
| Multi-instance Scaling | ❌ Needs Redis | Phase 2 |

