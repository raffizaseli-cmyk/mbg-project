# 🗺️ Complete Workspace Data Flow Map

## Quick Summary
Your system has **6 primary manual input points**, all flowing through a centralized Supabase database:
1. **Photo receipts** → Bot → Backend OCR → Database
2. **Manual transaction entry** → Form parsing → Backend → Database  
3. **Weekly menus** → Menu input → Backend → Database
4. **Daily deliveries** → Portion confirmation → Backend → Database + Stock updates
5. **Web user registration** → Account creation → Backend database
6. **Master data setup** → Web dashboard → Backend → Database

---

## 📥 MANUAL INPUT POINT DETAILS

### INPUT #1: Photo Receipt Upload (Automated OCR)
**Location**: [bot/handlers/nota_handler.py](bot/handlers/nota_handler.py#L60)  
**Command**: `/catat-nota` (appears as button in main menu)  
**User Role**: owner, admin, kasir (verified by `@requires_role` decorator)  
**Data Format**: Binary image (JPEG/PNG)  
**Processing**:
```
User sends 1+ photos
  ↓ [bot/handlers/nota_handler.py:handle_photo()]
Compress each with compress_photo() utility
  ↓ [bot/utils/image_utils.py]
Store in context.user_data["active_batch"]
  ↓ Auto-submit when:
     - 5 photos received, OR
     - User clicks "Selesai Kirim", OR
     - 5-minute timeout (BATCH_TIMEOUT = 300s)
  ↓ POST /transactions/from-photo (multipart)
  ↓ [backend/routers/transactions.py:upload_photo()]
Backend:
  1. Upload to Supabase Storage → photo_url
  2. Create transaction row (status="pending_ocr")
  3. Return transaction_id immediately
  4. Push OCR job to BackgroundTasks
  ↓ [backend/workers/ocr_worker.py:process_ocr_job()]
OCR Worker (async thread):
  1. Download photo from Storage
  2. Call Gemini Vision API
  3. Extract: items[], total, subtotal, PPN, shop_name
  4. Apply aliases (AliasService) to standardize product names
  5. Validate with ValidationService
  6. INSERT transaction_items
  7. UPDATE transaction (status="pending_confirmation")
  8. Send Telegram notification back to user
  ↓ [backend/services/notification_service.py]
User sees OCR results in Telegram:
  "✅ OCR Complete!
   Items: [Beras 10kg @ Rp12000, ...]
   Total: Rp 120.000
   [Confirm] [Edit] [Cancel]"
  ↓ User clicks [Confirm]
  ↓ POST /transactions/{id}/confirm
  ↓ Backend locks transaction (is_locked=true)
     Updates kas_ledger
     Updates stok_quantity
     Updates budget_allocation
```

**Database Tables Updated**:
- `transactions` (1 row)
- `transaction_items` (N rows)
- `kas_ledger` (1 entry per kas_account)
- `stok_ledger` (N entries, one per product)

**Error Handling**:
- OCR fails → status="failed", error notification sent
- File too large (>2MB) → 413 error before OCR
- Invalid MIME type → 422 error

**Code Key Points**:
- Batch timeout job: `context.job_queue.run_once(check_batch_timeout, ...)`
- Compression: Image bytes reduced typically by 60-70%
- Max batch: 5 photos (configurable `MAX_BATCH_SIZE = 5`)

---

### INPUT #2: Manual Transaction Entry (Form-based)
**Location**: [bot/handlers/belanja_handler.py](bot/handlers/belanja_handler.py#L1)  
**Command**: `/belanja`  
**User Role**: owner, admin, kasir  
**States**: ConversationHandler with 4 states

**State Machine**:
```
State 0: INPUT_SUPPLIER
  ↓ User types supplier name OR /skip
  → Go to State 1

State 1: INPUT_ITEMS
  ↓ User inputs line-by-line:
    "Beras 10 kg 12000"
    "Minyak 5 liter 15000"
    "/selesai" when done
  ↓ Parse each: name qty unit price
     Using _parse_item_line(line: str)
  → Go to State 2

State 2: CONFIRM_BELANJA
  ↓ Show summary:
    Supplier: [name]
    Item 1: Beras 10 kg @ 12,000 = 120,000
    Item 2: Minyak 5 L @ 15,000 = 75,000
    Total: 195,000
  ↓ User selects payment method:
    [💵 Tunai] [🏦 Transfer] [📋 Hutang]
  → If Hutang: Go to State 3
  → Else: Go to confirm

State 3: AWAIT_DUE_DATE (only if hutang)
  ↓ User types due date (e.g., "2026-04-15")
  ↓ Post transaction
  → End ConversationHandler

POST /transactions (source="manual"):
{
  "type": "expense",
  "source": "manual",
  "supplier_id": "...",
  "ref_number": null,
  "date": "2026-04-02",
  "subtotal": 195000,
  "ppn_amount": 0,
  "pph22_amount": 0,
  "discount": 0,
  "total": 195000,
  "payment_method": "tunai",
  "payment_status": "lunas",
  "items": [
    {
      "product_name": "Beras",
      "qty": 10,
      "unit": "kg",
      "price": 12000
    },
    ...
  ]
}
```

**Parsing Logic** (`_parse_item_line`):
```python
tokens = "Beras 10 kg 12000".split()
# ["Beras", "10", "kg", "12000"]
harga = parse_id_number(tokens[-1])       # 12000
satuan = tokens[-2]                        # "kg"
qty = parse_id_number(tokens[-3])          # 10
nama = " ".join(tokens[:-3])               # "Beras"
# Handles multi-word product names: "Telur Ayam 3 kg 18000"
```

**Validation**:
- qty > 0 AND < 1000
- harga > 0
- Decimal parsing errors caught and rejected

**Database Effect**:
- 1 transaction record (status="confirmed" if validated OK)
- N transaction_item records (1 per line input)
- 1 kas_ledger entry (if payment="tunai")
- N stok_ledger entries (one per product)

---

### INPUT #3: Weekly Menu Input
**Location**: [bot/handlers/menu_handler.py](bot/handlers/menu_handler.py#L150)  
**Command**: `/menu`  
**User Role**: owner, admin ONLY  
**States**: 5-state ConversationHandler

**Flow**:
```
State 0: SHOW_WEEK
  ↓ GET /mbg/weekly-menus (Mon-Sat of current week)
  ↓ Display grid:
    "📅 MENU MINGGU INI
     Periode: 1 April — 6 April 2026
     
     Senin    1 April: [Nasi Kuning] ✅
     Selasa   2 April: [Nasi Merah]  ⚠️
     Rabu     3 April: [belum diisi] ⬜
     Kamis    4 April: [belum diisi] ⬜
     Jumat    5 April: [belum diisi] ⬜
     Sabtu    6 April: [opsional]    ⬜"
  ↓ User clicks day button: "edit_day_2026-04-03"
  → Go to State 1

State 1: WAITING_INPUT
  ↓ "Apa nama menu untuk Rabu 3 April?"
  ↓ User types: "Nasi Goreng"
  → Go to State 2

State 2: VALIDATING_MENU
  ↓ POST /mbg/weekly-menus/validate
     { menu_name: "Nasi Goreng", date: "2026-04-03" }
  ↓ Backend validates product exists + has BOM
  → Go to State 3

State 3: CONFIRM_NO_BOM
  ↓ "BOM untuk Nasi Goreng:"
    [✅ Ada BOM] [⚠️ Tanpa BOM] [← Cancel]
  ↓ If [Ada BOM]: Go to State 4
  → Else: POST and end

State 4: INPUT_BOM_INLINE
  ↓ Show current BOM items (if any)
  ↓ User can add more: "Beras 3 kg" / "Ayam 2 kg"
  ↓ Format same as manual entry (_parse_item_line)
  ↓ When complete: POST /mbg/weekly-menus
     + INSERT mbg_bom_items
  → End ConversationHandler
```

**POST Structure**:
```json
{
  "date": "2026-04-03",
  "menu_name": "Nasi Goreng",
  "bom_items": [
    { "product_id": "prod-001", "qty": 3, "unit": "kg" },
    { "product_id": "prod-002", "qty": 2, "unit": "kg" }
  ]
}
```

**Database Tables**:
- `weekly_menus` (1 row per day)
- `mbg_bom_items` (N rows, items in BOM)

---

### INPUT #4: Daily Delivery Confirmation
**Location**: [bot/handlers/serah_handler.py](bot/handlers/serah_handler.py#L120)  
**Command**: `/serah`  
**User Role**: owner, admin, kasir, driver  
**States**: 2-state + Sunday warning

**Flow**:
```
Check if Sunday:
  IF yes → Show warning modal
     "⚠️ Hari ini MINGGU (bukan hari kerja MBG)
      MBG beroperasi Senin-Sabtu saja
      Yakin ingin lanjut?"
     [✅ Tetap Lanjut] [❌ Batal]

State 0: INPUT_PORTIONS
  ↓ Load in parallel:
    GET /mbg/weekly-menus/today → menu_name
    GET /schools?is_active=true&limit=50 → schools[]
  ↓ Display each school with default_portions:
    "✏️ SDN Mekar — 50 porsi
     ✏️ SDN Jaya — 40 porsi
     ✏️ SMP Harapan — 80 porsi
     ...
     [✅ Lanjut dengan Kuota Default]"
  ↓ User can:
     - Edit a school's portion: callback="edit_porsi_{school_id}"
     - Proceed with defaults
     - Cancel

State 1: CONFIRM_SERAH
  ↓ Show summary:
    "Menu: Nasi Goreng
     Sekolah: 10
     Total Porsi: 500
     Estimasi Stok:
       Beras: -30 kg
       Ayam: -10 kg
     [✅ KIRIM] [❌ BATAL]"
  ↓ User confirms

POST /mbg/deliveries/bulk:
{
  "delivery_date": "2026-04-02",
  "deliveries": [
    { "school_id": "sch-001", "portions_sent": 50 },
    { "school_id": "sch-002", "portions_sent": 40 },
    ...
  ]
}

Backend actions:
  1. INSERT mbg_deliveries (N rows, one per school)
  2. FOR EACH delivery:
     - Get menu BOM for today
     - Calculate stok deduction = BOM * portions
     - UPDATE stok_ledger
     - Record in mbg_budget_allocations
  3. Lock allocation (is_locked=true)
  4. Send Telegram confirmation
```

**Database Tables Updated**:
- `mbg_deliveries` (N rows)
- `stok_ledger` (N rows, one per product)
- `mbg_budget_allocations` (1 row, updated)

**Side Effect**: After confirmation, can check status with `/laporan` command.

---

### INPUT #5: Web User Registration
**Location**: [web/app/(auth)/register/page.tsx](web/app/(auth)/register/page.tsx#L1)  
**Endpoint**: POST /auth/register-tenant  
**User Role**: Any (new tenant owner)

**Form Fields**:
```
1. Tenant Name (e.g., "MBG Catering Jaya")
2. Slug (e.g., "mbg-jaya") — must be unique
3. Owner Email (e.g., "owner@mbgjaya.com")
4. Password (hashed with bcrypt)
5. Phone (e.g., "+62812345678")
```

**Backend Processing** ([backend/routers/auth.py](backend/routers/auth.py#L1)):
```
POST /auth/register-tenant:
  1. Validate required fields
  2. Check slug uniqueness
  3. Check email uniqueness
  4. INSERT tenants table
  5. INSERT users table (role="owner", is_active=true)
  6. Generate JWT token
  7. Return { access_token, user: {...} }
  ↓ Frontend stores JWT in localStorage
  ↓ All subsequent requests include:
     Authorization: Bearer <jwt_token>
```

**Database Tables**:
- `tenants` (1 row)
- `users` (1 row, role="owner")

**Session Management**:
- Web: JWT in localStorage, auto-attach to axios requests
- Bot: JWT in context.user_data, obtained via /tenants/telegram-link

---

### INPUT #6: Master Data Setup (Web Dashboard)
**Location**: [web/app/(dashboard)/settings/](web/app/(dashboard)/settings/)  
**User Role**: owner, admin  
**Setup Type**: One-time configuration

**Master Data Categories**:

#### A. Products (Master Catalogue)
**File**: Backend router [backend/routers/products.py](backend/routers/products.py#L1)
```
POST /products:
{
  "name": "Beras Premium",
  "unit": "kg",
  "category": "Bahan Pokok",
  "stock_min": 5,
  "stock_max": 50,
  "price_default": 12000,
  "supplier_id": "sup-001"
}

GET /products → list all for bot reports
```

#### B. Schools
**File**: Backend router [backend/routers/schools.py](backend/routers/schools.py#L1)
```
POST /schools:
{
  "name": "SDN Mekar Jaya",
  "address": "Jl. Pendidikan No. 5",
  "contact_name": "Ibu Siti",
  "default_portions": 50,
  "school_level": "sd_smp",
  "is_active": true
}
```

#### C. Suppliers
**File**: Backend router [backend/routers/suppliers.py](backend/routers/suppliers.py#L1)
```
POST /suppliers:
{
  "name": "Toko Beras Makmur",
  "phone": "+6281234567",
  "address": "Jl. Pasar No. 10",
  "contact_person": "Pak Hasan",
  "payment_terms": 14  (days)
}
```

#### D. Budget & Allocation
**File**: Backend router [backend/routers/budget.py](backend/routers/budget.py#L1)
```
POST /budget/allocate:
{
  "date": "2026-04-02",
  "total_revenue": 500000,
  "budget_bahan": 200000,
  "budget_ops": 100000,
  "budget_insentif": 50000
}
```

**Effect**: These master data entries are referenced by:
- Bot reports (to format product names)
- Transaction item matching (via AliasService)
- Stock tracking
- Budget comparisons

---

## 🔄 DATA SYNC BETWEEN COMPONENTS

### Bot ↔ Backend (API Calls)
| Method | Endpoint | Caller | Purpose |
|--------|----------|--------|---------|
| POST | /auth/login | Bot auth_handler | User login |
| POST | /tenants/telegram-link | Bot auth_handler | Link Telegram to account |
| POST | /transactions/from-photo | Bot nota_handler | Submit photo batch |
| POST | /transactions | Bot belanja_handler | Submit manual entry |
| PUT | /transactions/{id} | Bot nota_handler | Edit transaction |
| POST | /transactions/{id}/confirm | Bot nota_handler | Lock transaction |
| DELETE | /transactions/{id} | Bot nota_handler | Void transaction |
| GET | /mbg/weekly-menus | Bot menu_handler | Fetch weekly menu |
| POST | /mbg/weekly-menus | Bot menu_handler | Store menu |
| GET | /mbg/weekly-menus/today | Bot serah_handler | Get today's menu |
| GET | /schools | Bot serah_handler | Get active schools |
| POST | /mbg/deliveries/bulk | Bot serah_handler | Record deliveries |
| GET | /reports/daily | Bot report_handler | Daily summary |
| GET | /reports/monthly | Bot report_handler | Monthly report |
| GET | /reports/stock | Bot report_handler | Stock status |
| GET | /reports/receivables | Bot report_handler | Receivables |
| GET | /reports/payables | Bot report_handler | Payables |

### Backend ↔ Database (Supabase)
- **Single source of truth**: All 3 clients (Bot, Backend, Web) query same Supabase
- **No caching**: Real-time reads from database
- **Transaction guarantees**: Backend manages ACID via Supabase transactions

### Web ↔ Backend (API Calls)
| Method | Endpoint | Component | Purpose |
|--------|----------|-----------|---------|
| POST | /auth/register-tenant | auth page | Register new tenant |
| POST | /auth/login | auth page | User login |
| GET | /transactions | pembukuan page | View transactions |
| GET | /reports/daily | keuangan page | Financial dashboard |
| GET | /mbg/weekly-menus | mbg page | View menu schedule |
| POST | /products | settings page | Add product |
| POST | /schools | settings page | Add school |
| POST | /suppliers | settings page | Add supplier |
| GET | /price-tracking | insights page | Price history |

---

## 📊 KEY DATABASE TABLES & FIELDS

### transactions
```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,          -- Multi-tenant
  user_id uuid,                     -- Who created it
  supplier_id uuid,                 -- FK to suppliers
  type: "expense" | "income" | "purchase",
  source: "photo" | "manual" | "import",
  status: "pending_ocr" | "pending_confirmation" | "confirmed" | "failed" | "voided",
  is_locked: boolean,               -- Locked after confirm
  ref_number: string,               -- Invoice #
  date: DATE,
  subtotal: DECIMAL,
  ppn_amount: DECIMAL,
  pph22_amount: DECIMAL,
  discount: DECIMAL,
  total: DECIMAL,
  payment_method: "tunai" | "transfer" | "hutang",
  payment_status: "lunas" | "belum_lunas",
  due_date: DATE,
  photo_url: string,                -- Supabase Storage URL
  notes: text,
  created_at: TIMESTAMP,
  nama_toko: string                 -- From OCR
);
```

### transaction_items
```sql
CREATE TABLE transaction_items (
  id uuid PRIMARY KEY,
  transaction_id uuid FK,
  product_id uuid,                  -- Optional match
  product_name: string,             -- Actual name
  qty: DECIMAL,
  unit: string,
  price: DECIMAL,
  subtotal: DECIMAL,
  kategori: string,                 -- OCR category
  needs_confirmation: boolean,       -- If alias unsure
  ocr_nama_asli: string             -- Original OCR name
);
```

### weekly_menus
```sql
CREATE TABLE weekly_menus (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  date: DATE,                       -- Mon-Sat only
  day_of_week: int,                 -- 1=Mon, 6=Sat
  menu_name: string,
  is_filled: boolean,
  has_bom: boolean,
  created_at: TIMESTAMP
);
```

### mbg_deliveries
```sql
CREATE TABLE mbg_deliveries (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  school_id uuid FK,
  delivery_date: DATE,              -- Must have menu for this day
  portions_sent: integer,
  actual_portions_served: integer,
  revenue_gross: DECIMAL,
  status: "scheduled" | "delivered" | "confirmed",
  created_at: TIMESTAMP
);
```

### kas_ledger
```sql
CREATE TABLE kas_ledger (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  kas_account_id uuid FK,
  entry_date: DATE,
  entry_type: "debit" | "credit",
  amount: DECIMAL,
  reference_type: "transaction" | "manual_entry",
  reference_id: uuid,
  description: string,
  balance_after: DECIMAL,           -- Auto-calculated
  created_at: TIMESTAMP
);
```

---

## 🔐 Authentication & Authorization

### Bot Authentication Flow
```
1. User sends: /start linking_code
2. Bot calls: POST /tenants/telegram-link
   { telegram_id: 123456, linking_code: "ABC123" }
3. Backend validates linking_code (short-lived)
4. Backend responds with JWT token + user_role
5. Bot saves in context.user_data:
   {
     "token": "jwt_...",
     "tenant_id": "uuid",
     "user_role": "owner",
     "user_name": "Budi"
   }
6. All subsequent API calls include:
   Authorization: Bearer <jwt_token>
```

### Web Authentication Flow
```
1. User fills form: POST /auth/register-tenant
2. OR: User logs in: POST /auth/login
3. Backend validates & issues JWT
4. Frontend stores in localStorage:
   localStorage.setItem("auth_token", jwt)
5. Axios interceptor auto-attaches to requests:
   Authorization: Bearer <jwt_token>
6. On 401 response: localStorage cleared, redirect to /login
```

### Role-Based Access Control (RBAC)
```
Roles: owner | admin | kasir | viewer | driver

Input capabilities:
  - owner/admin: All endpoints
  - kasir: Transaction input only (/catat-nota, /belanja, /serah)
  - driver: Delivery confirmation only (/serah)
  - viewer: Read-only reports

Backend enforces via:
  @require_role(["owner", "admin", "kasir"]) decorator
  Raises 403 Forbidden if role mismatch
```

---

## 🔍 Code Patterns YOU'LL SEE

### Pattern 1: Photo Upload Loop in Bot
```python
# [bot/handlers/nota_handler.py:60]
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    batch = context.user_data.get("active_batch")
    if not batch:
        batch = {
            "batch_id": str(uuid4()),
            "photos": [],
            "start_time": time.time(),
        }
        context.user_data["active_batch"] = batch
        # Schedule 5-min timeout
        context.job_queue.run_once(
            check_batch_timeout,
            when=300,
            name=f"batch_timeout_{chat_id}"
        )
    
    # Download + compress
    photo_file = await photo.get_file()
    raw_bytes = await photo_file.download_as_bytearray()
    photo_bytes = compress_photo(bytes(raw_bytes))
    
    batch["photos"].append(photo_bytes)
    n = len(batch["photos"])
    
    # Auto-submit if 5 photos
    if n >= MAX_BATCH_SIZE:
        await submit_batch(batch, ...)
```

### Pattern 2: ConversationHandler State Machine
```python
# [bot/handlers/belanja_handler.py]
ConversationHandler(
    entry_points=[CommandHandler("belanja", belanja_entry)],
    states={
        INPUT_SUPPLIER: [MessageHandler(filters.TEXT, on_supplier_input)],
        INPUT_ITEMS: [MessageHandler(filters.TEXT, on_item_input)],
        CONFIRM_BELANJA: [CallbackQueryHandler(on_payment_choice)],
        AWAIT_DUE_DATE: [MessageHandler(filters.TEXT, on_due_date)],
    },
    fallbacks=[CommandHandler("cancel", cancel_conversation)],
)
```

### Pattern 3: Async OCR Job in Backend
```python
# [backend/routers/transactions.py:upload_photo()]
@router.post("/from-photo")
async def upload_photo(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    current_user: UserInDB = Depends(get_current_user),
):
    # ... validation & upload ...
    
    # Push async job (doesn't block)
    background_tasks.add_task(
        run_ocr_in_background,
        trx_id=transaction_id,
        photo_url=photo_url,
        tenant_id=current_user.tenant_id,
        telegram_id=user.telegram_id,
    )
    
    # Return immediately
    return {"transaction_id": transaction_id}

# [backend/workers/ocr_worker.py]
def run_ocr_in_background(trx_id, photo_url, ...):
    ocr_result = ocr_svc.extract_from_url(photo_url)
    supabase.table("transactions").update({...}).eq("id", trx_id).execute()
    notif_svc.send_ocr_result(trx_id, telegram_id, bot_token)
```

### Pattern 4: API Error Handling with RBAC
```python
# [backend/core/dependencies.py]
def require_role(allowed_roles: list[str]):
    async def role_checker(
        current_user: UserInDB = Depends(get_current_user)
    ) -> UserInDB:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail={"error": "Akses ditolak"}
            )
        return current_user
    return role_checker

# Usage:
@router.post("/", dependencies=[Depends(require_role(["owner", "admin"]))])
def create_product(...): ...
```

### Pattern 5: Supabase Transaction Atomicity
```python
# [backend/routers/transactions.py]
supabase = get_supabase()
transaction_data = {
    "tenant_id": current_user.tenant_id,
    "status": "confirmed",
    "is_locked": True,
}
supabase.table("transactions").update(transaction_data).eq("id", trx_id).execute()

# Insert kas entry
supabase.table("kas_ledger").insert({
    "kas_account_id": kas_id,
    "entry_type": "debit",
    "amount": total,
    "reference_id": trx_id,
    ...
}).execute()

# Update stok
for item in items:
    supabase.table("stok_ledger").insert({
        "product_id": item.product_id,
        "qty_out": item.qty,
        "reference_id": trx_id,
        ...
    }).execute()
```

---

## ⚡ CRITICAL WORKFLOW SEQUENCES

### Complete Receipt-to-Report Cycle
```
T=0:00 → User takes photo of receipt
T=0:05 → Photo batch submitted (5 photos or manual click)
T=0:06 → Backend receives, stores to Supabase Storage
T=0:07 → Backend creates transaction row (pending_ocr)
T=0:08 → Backend returns transaction_id to bot
T=0:09 → OCR worker starts (async thread)
T=0:10-0:15 → Gemini Vision API processes photo
T=0:16 → OCR results received by worker
T=0:17 → Worker inserts transaction_items rows
T=0:18 → Worker sends Telegram notification
T=0:19 → User receives: "OCR Complete! [Confirm] [Edit]"
T=0:20 → User clicks [Confirm] in Telegram
T=0:21 → Bot posts: POST /transactions/{id}/confirm
T=0:22 → Backend:
         - Locks transaction (is_locked=true)
         - Inserts kas_ledger entry
         - Inserts stok_ledger entries
T=0:23 → Telegram: "✅ Transaksi Terkunci"
T=0:24 → User can view in bot: /hariini or /laporan
T=0:25 → User can view in web: /dashboard/pembukuan
```

### Weekly Menu Workflow
```
Senin pagi:
  - Admin opens bot, /menu
  - Selects Senin-Sabtu menus for week
  - Inputs BOM for each day
  - Menu locked Mon-Fri, Sat optional

Setiap hari pukul 09:00:
  - User calls /serah
  - Portions per school confirmed
  - Stock auto-decremented
  - Allocation locked

Setiap Jumat:
  - Admin inputs menu via /menu
  - For NEXT week (Senin-Sabtu)
  - Becomes active on Monday
```

---

## 📝 QUICK FILE REFERENCE

| Purpose | Files |
|---------|-------|
| **Bot Main Loop** | bot/main.py |
| **Photo Input** | bot/handlers/nota_handler.py |
| **Manual Entry** | bot/handlers/belanja_handler.py |
| **Menu Input** | bot/handlers/menu_handler.py |
| **Delivery Confirm** | bot/handlers/serah_handler.py |
| **Reports** | bot/handlers/report_handler.py |
| **Bot Auth** | bot/handlers/auth_handler.py |
| **Bot Session** | bot/utils/session.py |
| **Bot API Client** | bot/utils/api_client.py |
| **Backend Main** | backend/main.py |
| **Transaction Router** | backend/routers/transactions.py |
| **MBG Router** | backend/routers/mbg.py |
| **Reports Router** | backend/routers/reports.py |
| **Auth Router** | backend/routers/auth.py |
| **Transaction Model** | backend/models/transaction.py |
| **OCR Worker** | backend/workers/ocr_worker.py |
| **OCR Service** | backend/services/ocr_service.py |
| **Notification Service** | backend/services/notification_service.py |
| **KAS Service** | backend/services/kas_service.py |
| **Database** | backend/core/database.py |
| **Dependencies** | backend/core/dependencies.py |
| **Web API Client** | web/lib/api.ts |
| **Web Login** | web/app/(auth)/login/page.tsx |
| **Web Register** | web/app/(auth)/register/page.tsx |
| **Web Pembukuan** | web/app/(dashboard)/pembukuan/page.tsx |
| **Web MBG** | web/app/(dashboard)/mbg/page.tsx |

---

## 🎯 AUTOMATION OPPORTUNITIES (Current Manual Points)

1. **Photo Upload** ✅ AUTOMATED
   - User sends photo → OCR automatic → DB update automatic
   - Manual point: User clicks [Confirm]

2. **Manual Entry** ⚠️ SEMI-AUTOMATED
   - Form parsing automated
   - Still needs: Supplier name + item details

3. **Menu Entry** ⚠️ SEMI-AUTOMATED
   - Menu name still manual
   - BOM can be templated

4. **Delivery** ⚠️ SEMI-AUTOMATED
   - Default portions can auto-apply
   - Confirmation still manual (prevents mistakes)

5. **Master Data** ❌ MANUAL
   - NO automation possible here
   - One-time setup cost

---

**Last Updated**: April 2, 2026  
**System Version**: v1.0.2  
**Database**: Supabase (PostgreSQL)  
**Bot Framework**: python-telegram-bot  
**Backend**: FastAPI  
**Frontend**: Next.js 14+ (App Router)
