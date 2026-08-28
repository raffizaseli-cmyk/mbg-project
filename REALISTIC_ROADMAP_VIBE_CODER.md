# 🚀 REALISTIC AUTOMATION ROADMAP — Vibe Coder Edition

> **Target:** High Pain-Point Relief with Low Technical Complexity  
> **Timeline:** 4-6 weeks (doable solo with AI assistance)  
> **Approach:** Skip Bank APIs & IoT, focus on Logic + Notifications + Forms  
> **Status:** Ready to Code

---

## 🎯 GUIDING PRINCIPLES

✅ **Pick THIS:**
- Database logic + calculations (Python is strong here)
- Forms & notifications (Telegram + WhatsApp API)
- Batch processing & automation workflows
- Data validation & error handling
- Simple AI integration (Gemini, not complex vision)

❌ **Skip THIS (For Now):**
- Bank API reconciliation (requires compliance, test accounts)
- IoT device integration (hardware complexity)
- Mobile app development (native Android/iOS)
- Complex 3rd-party integrations

---

## 📊 PAIN POINT vs COMPLEXITY MATRIX

```
IMPACT (User Pain Relief)
    ▲
    │         💰 PAYROLL (HIGH / MEDIUM)
    │    🔔 COMPLIANCE (HIGH / MEDIUM)
    │  🏪 STOCK BOM (MEDIUM / EASY)
    │         🧾 PEMBUKUAN (HIGH / HARD - skip for phase 1)
    │  📦 MBG PRE-FILL (MEDIUM / EASY)
    │
    └─────────────────────────────────────► TECHNICAL COMPLEXITY
       EASY    MEDIUM    HARD
```

**Recommended Hit Order:**
1. **Stock BOM Auto-Deduction** (EASY + immediate relief)
2. **MBG Delivery Pre-filling** (EASY + quick win)
3. **Payroll Rules Engine** (MEDIUM + high impact)
4. **Compliance Push Notifications** (MEDIUM + critical safety)
5. **Pembukuan OCR** (HARD + defer to phase 2 unless have time)

---

## 🔧 PHASE 1: SPRINT-LEVEL ROADMAP (4 Weeks)

### SPRINT 1.1: Stock BOM Auto-Deduction (4-5 days)

**PAIN POINT SOLVED:**
- Inventory mismatch from 75% manual → 95% automatic
- No more manual recount monthly
- Real-time stock visibility

**What to Build:**

#### Step 1: DB Schema Update (0.5 days)
Add to `products` table:
```sql
ALTER TABLE products ADD COLUMN (
  is_ingredient BOOLEAN DEFAULT true,      -- dapat dijadikan BOM item
  base_quantity DECIMAL(10,2) NOT NULL,    -- unit dasar (kg, liter, dozen)
  base_unit VARCHAR(20) NOT NULL,          -- unit name
  reorder_quantity DECIMAL(10,2),          -- EOQ (Economic Order Quantity)
  reorder_point DECIMAL(10,2)              -- safety stock level
);

-- BOM composition (already exists in your schema):
-- recipes table → recipe_items → ref product
```

#### Step 2: API Endpoints (2 days)

**Endpoint 1: GET /stok/consumption-forecast** (read-only)
```python
# Input: date_from, date_to, tenant_id
# Logic:
#   1. Fetch daily_menus[date_from:date_to]
#   2. For each menu → fetch recipe (BOM)
#   3. For each BOM_item:
#        - qty_used = portions_count × recipe_item_qty
#   4. Aggregate: total_qty_per_product (date range)
#   5. Return: expected_consumption + current_stok + variance
# Output: {
#   "date": "2026-04-01",
#   "forecasted_consumption": [
#     {"product_id": "beras", "expected_qty": 50, "unit": "kg", "current_stok": 120, "variance": +70}
#   ]
# }
```

**Endpoint 2: POST /stok/deduct-bom** (write)
```python
# Input: date, portion_count, menu_id, tenant_id
# Logic:
#   1. Fetch menu → get recipe BOM
#   2. Fetch current stok for each BOM_item
#   3. For each BOM_item:
#        - qty_after = current_stok - (portion_count × bom_item_qty)
#        - IF qty_after < 0 → return error "Beras shortage: need 50kg, have 40kg"
#        - ELSE → update stok + create stock_transaction (type=consumption)
#   4. Return: success + new_stok_levels
# Error handling: Return 400 + shortage list (don't auto-skip, let user decide)
```

**Endpoint 3: GET /stok/variance-report** (read-only)
```python
# Input: date_from, date_to (e.g., month)
# Logic:
#   1. Expected consumption = SUM(daily forecasts for month)
#   2. Actual consumption = SUM(stock deductions from /stok/deduct-bom calls)
#   3. Variance = expected - actual (% error)
#   4. Flag items with variance > 10%
# Output: {
#   "month": "2026-04",
#   "total_variance_pct": 8.5,
#   "flagged_items": [
#     {"product": "minyak", "expected": 50, "actual": 56, "variance": -12%, "reason": "spillage?"}
#   ]
# }
```

#### Step 3: Telegram Bot Integration (1.5 days)

**New Handler: /stok-deduction**
```python
# Handler: /stok-deduction
# Require role: owner, admin, kasir

# Step 1: Bot fetch today's menu
#   GET /weekly-menus/today
#   Display: "Nasi Goreng (250 porsi)"

# Step 2: Bot confirm portion count
#   User ketik: "250" atau modify: "200"

# Step 3: Bot call POST /stok/deduct-bom
#   - Success: "✅ Stok updated! Beras: 120kg → 100kg, dll"
#   - Error (shortage): "❌ SHORTAGE! Minyak: need 5L, have 2L. Proceed anyway? [YES] [NO]"

# Step 4 (optional shortage bypass):
#   User click YES → create alert log (manual note)
#   POST /stok/shortage-notes
```

#### Step 4: Web Dashboard Update (1 day)

**Add to `/app/(dashboard)/stok/page.tsx`:**
- New tab: "📊 Tahun Accuracy"
- Show: Expected vs Actual consumption chart
- Show: Variance % per product (red if > 10%)
- Button: "🔄 Deduct Today's Menu" → call API + show result

#### Unit Tests (0.5 days)
```python
# test_stok_deduction.py
- test_bom_calculation_correct_qty
- test_bom_shortage_detection
- test_variance_calculation
- test_recipe_not_found_error
```

**Expected Output After Sprint 1.1:**
- ✅ Stock auto-deducts when menu confirmed
- ✅ Shortage alerts prevent negative inventory
- ✅ Monthly variance report shows data quality (80%+ accurate)
- **Pain point relief:** 75% manual → 20% (owner just confirms, system does rest)

---

### SPRINT 1.2: MBG Delivery Pre-filling (3-4 days)

**PAIN POINT SOLVED:**
- Daily duplication of school/portion data eliminated
- Setup time 10+ minutes → 1 minute review
- Error reduction from manual copy-paste

**What to Build:**

#### Step 1: API Endpoint (1 day)

**GET /mbg/deliveries/today-prefilled** (read-only)
```python
# Logic:
#   1. Fetch daily_menus[today] → get menu_name, menu_id
#   2. Fetch mbg_allocations WHERE date=today
#      → [School A: 250 porsi, School B: 180, School C: 320]
#   3. For each school → fetch master data (address, contact, principal)
#   4. Return: pre-filled delivery form
# Output: {
#   "date": "2026-04-01",
#   "menu": {"name": "Nasi Goreng", "id": "menu_abc123"},
#   "schools": [
#     {
#       "school_id": "s1",
#       "name": "SD Maju Jaya",
#       "address": "Jl. A No. 123",
#       "beneficiary_count": 250,
#       "portions_allocated": 250,
#       "principal_contact": "081234567890"
#     },
#     {...}
#   ],
#   "total_portions": 750,
#   "generated_at": "2026-04-01T08:00:00"
# }
```

**POST /mbg/deliveries/confirm-today** (write)
```python
# Input: date, schools (list with optional portion override)
# Logic:
#   1. Validate: all schools still allocated for today (no changes needed)
#   2. For each school:
#        - Create mbg_delivery record
#        - Set: delivery_date, school_id, portions, status=pending
#        - Generate unique QR code (encode delivery_id)
#   3. Generate BAST template (50% pre-filled with school data)
#   4. Return: delivery_ids + BAST URL + QR codes
# Output: {
#   "deliveries_created": 3,
#   "bast_urls": ["https://app/bast/del_001", ...],
#   "qr_codes": ["iVBORw0KGgo...", ...]  # base64 PNG
# }
```

#### Step 2: Telegram Bot Integration (1.5 days)

**Update Handler: /serah** (enhance existing)
```python
# Current: Manual portion input per school
# New: Auto-prefill from allocations

# Before step INPUT_PORTIONS:
#   Bot call: GET /mbg/deliveries/today-prefilled
#   Bot display: "Hari ini: Nasi Goreng\n750 porsi ke 3 sekolah"
#   Tombol: [✅ Pakai Alokasi Standar] [✏️ Edit Porsi]

# If standard: finish faster
# If edit: same flow as before
```

**New Handler: /bast** (generate BAST)
```python
# Command: /bast
# Step 1: Bot show today's deliveries
# Step 2: User select delivery (buttons per school)
# Step 3: Bot show BAST pre-filled + QR download link
# Step 4: "Siap cetak ke printer?" [YES] → print instruction
```

#### Step 3: Web Dashboard Update (1 day)

**New page: `/app/(dashboard)/mbg/deliveries/[date]`**
```
Today: Senin, 1 April 2026
Menu: Nasi Goreng (250 porsi)

┌─ ALOKASI STANDARD ─────────────┐
│ ✅ SD Maju Jaya      250 porsi  │
│ ✅ SMP Bersih        180 porsi  │
│ ✅ SD Ceria          320 porsi  │
│ ────────────────────────────────│
│ TOTAL: 750 porsi               │
│ Alokasi: 80:15:5 breakdown     │
│                                │
│ [🔄 Refresh] [✏️ Edit] [✅ Set] │
└────────────────────────────────┘
```

Button actions:
- **[✅ Set]** → POST /mbg/deliveries/confirm-today → generate BAST + QR
- **[✏️ Edit]** → modal to change portions per school
- **[🔄 Refresh]** → call GET /mbg/deliveries/today-prefilled again

#### Step 4: Unit Tests (0.5 days)

```python
# test_mbg_prefill.py
- test_allocation_fetch_for_today
- test_schools_sorted_by_name
- test_qr_code_generation
- test_total_portions_calculation
```

**Expected Output After Sprint 1.2:**
- ✅ Daily delivery setup drops from 10 min → 1 min
- ✅ BAST templating 50% automated
- ✅ QR codes for tracking
- **Pain point relief:** 50% manual → 10% (just approval, pre-filling handles rest)

---

### SPRINT 1.3: Payroll Rules Engine (5-6 days) ⭐️ HIGH IMPACT

**PAIN POINT SOLVED:**
- Payroll calculation from 100% manual → 90% automatic
- Reduce payroll processing from 3+ hours → 20 minutes
- Eliminate salary math errors

**What to Build:**

#### Step 1: DB Schema Update (1 day)

Add to `employees` table:
```sql
ALTER TABLE employees ADD COLUMN (
  salary_per_month DECIMAL(15,2) NOT NULL,     -- base salary
  allowance_transport DECIMAL(15,2) DEFAULT 0,
  allowance_meal DECIMAL(15,2) DEFAULT 0,
  allowance_other JSON,                         -- flexible for future
  
  pph_exemption BOOLEAN DEFAULT false,          -- non-taxable income
  bpjs_peserta BOOLEAN DEFAULT true,            -- BPJS deduction
  bpjs_nomor VARCHAR(20),
  
  status_active BOOLEAN DEFAULT true,           -- soft delete
  hire_date DATE NOT NULL
);

-- New table: attendance_records
CREATE TABLE attendance_records (
  id SERIAL,
  employee_id INT,
  date DATE NOT NULL,
  status VARCHAR(10),        -- present, sakit (sick), izin (leave), alpha (absent)
  notes TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (id)
);

-- New table: payroll_calculations (audit trail)
CREATE TABLE payroll_calculations (
  id SERIAL,
  payroll_month DATE,        -- "2026-04" format
  employee_id INT,
  attendance_days INT,
  presence_days INT,
  sick_days INT,
  leave_days INT,
  
  salary_base DECIMAL(15,2),
  allowance_transport DECIMAL(15,2),
  allowance_meal DECIMAL(15,2),
  allowance_other DECIMAL(15,2),
  gross_salary DECIMAL(15,2),
  
  bpjs_deduction DECIMAL(15,2),
  pph_deduction DECIMAL(15,2),
  other_deduction DECIMAL(15,2),
  
  net_salary DECIMAL(15,2),
  
  status VARCHAR(20),        -- draft, approved, paid
  payment_date DATE,
  payment_method VARCHAR(20), -- cash, transfer, dll
  notes TEXT,
  
  created_at TIMESTAMP,
  created_by INT,
  PRIMARY KEY (id)
);
```

#### Step 2: API Endpoints (2 days)

**Endpoint 1: POST /hr/attendance** (write)
```python
# Used by: Telegram bot + Web form + attendance device

# Input: {date, employee_list, attendance_data}
# attendance_data = [
#   {"employee_id": "emp_001", "status": "present"},
#   {"employee_id": "emp_002", "status": "sakit", "notes": "demam"}
# ]

# Logic:
#   1. For each employee_id in data:
#        - Check if already recorded for date (conflict check)
#        - Create attendance_record (status + notes)
#   2. Return: confirmation + count

# Output: {
#   "date": "2026-04-01",
#   "recorded": 15,
#   "failed": 0,
#   "message": "✅ 15 attendance records created"
# }
```

**Endpoint 2: GET /hr/payroll/draft** (read-only)
```python
# Input: month (ISO: "2026-04"), tenant_id
# Logic:
#   1. Fetch active employees for tenant
#   2. For each employee:
#        - attendance_days[month] = attendance_records count
#        - presence_days = count(status=present)
#        - sick_days = count(status=sakit)
#        - leave_days = count(status=izin)
#        - alpha = 20 - (present + sick/2 + leave/2)  [simple formula]
#
#        3. salary_calculation:
#           - gross_salary = base + allowances
#           - daily_rate = gross_salary / 20  (indo standard)
#           - paid_days = presence_days + (sick_days * 0.5) + (leave_days * 0.75)
#           - taxable_salary = (daily_rate × paid_days)
#
#           4. deductions:
#              - BPJS = taxable_salary × 4.24% (employee share)
#              - PPh = calculate_pph(taxable_salary, pph_bracket) if not exempt
#              - other_deduction = fetched from custom rules
#
#           5. net_salary = taxable_salary - bpjs - pph - other
#
#   6. Create payroll_calculation record (status=draft)
#   7. Return: list of all employee calculations
#
# Output: {
#   "month": "2026-04",
#   "employees": [
#     {
#       "employee_id": "emp_001",
#       "name": "Budi",
#       "position": "Chef",
#       "attendance_days": 20,
#       "presence_days": 18,
#       "sick_days": 1,
#       "leave_days": 1,
#       "gross_salary": 4000000,
#       "bpjs_deduction": 169600,
#       "pph_deduction": 0,
#       "other_deduction": 0,
#       "net_salary": 3830400,
#       "status": "draft",
#       "can_approve": true
#     }
#   ],
#   "total_gross": 60000000,
#   "total_net": 58000000,
#   "total_deductions": 2000000
# }
```

**Endpoint 3: POST /hr/payroll/approve** (write)
```python
# Input: month, employee_ids (list), tenant_id
# Logic:
#   1. For each employee_id:
#        - Fetch payroll_calculation (status=draft)
#        - Validate: all required fields filled
#        - Update status → "approved"
#   2. Create log entry: who approved, when, change notes
#   3. Return: confirmation
#
# Output: {
#   "approved": 15,
#   "message": "✅ Payroll approved for 15 employees. Ready to pay."
# }
```

**Endpoint 4: POST /hr/payroll/mark-paid** (write)
```python
# Input: month, payment_method (cash/transfer), payment_date, tenant_id
# Logic:
#   1. For all payroll_calculations (month, status=approved):
#        - Update status → "paid"
#        - Set payment_date + payment_method
#   2. Create payment_log (audit trail)
#   3. Return: payment confirmation
#
# Output: {
#   "paid": 15,
#   "total_paid": 58000000,
#   "payment_method": "transfer",
#   "payment_date": "2026-04-05",
#   "message": "✅ Payroll payment marked complete"
# }
```

#### Step 3: Telegram Bot Integration (2 days)

**New Handler: /absensi** (attendance)
```python
# Conversation handler: /absensi
# State 1: Show date picker ("Tanggal berapa?")
# State 2: Show employee list + status buttons
#   - Per employee: [Hadir] [Sakit] [Izin] [Alpha]
# State 3: Collect notes (optional)
# Final: POST /hr/attendance

# Output example:
# ✅ ATTENDANCE RECORDED
# Tanggal: Selasa, 1 April 2026
# Hadir: 15 | Sakit: 1 | Izin: 1 | Alpha: 0
# [📊 Lihat Summary] [✅ Done]
```

**New Handler: /gajian** (payroll)
```python
# Conversation handler: /gajian
# Step 1: Show current month
#   "Proses gaji Bulan April 2026?"
#   [Sudutkan Kirim] [Lihat Draft] [Batal]

# Step 2 (if "Lihat Draft"):
#   GET /hr/payroll/draft → show summary
#   - Total gross: Rp 60.000.000
#   - Total deductions: Rp 2.000.000
#   - Total net: Rp 58.000.000
#   - Preview: [Show top 5 employees + "...and 10 more"]

# Step 3 (if "Sudutkan Kirim"):
#   POST /hr/payroll/approve
#   Output: "✅ Gajian siap dibayar Rp 58.000.000"

# Step 4: Confirm payment method
#   Ask: "Metode bayar? [💰 Transfer] [💵 Cash]"
#   Ask: "Tanggal bayar? [Hari ini] [Besok] [Custom]"

# Step 5: POST /hr/payroll/mark-paid
#   Output: "✅ PAYROLL COMPLETE! 15 employees paid via transfer on 2026-04-05"
```

#### Step 4: Web Dashboard Addition (1.5 days)

**New page: `/app/(dashboard)/karyawan/gajian`**

```
PAYROLL PROCESSING
└─ Bulan April 2026

┌─ STEP 1: ATTENDANCE ─────────────────┐
│ [✅] Attendance recorded              │
│ Tanggal: 1-30 April 2026             │
│ Total employees: 15                  │
│ [📝 Edit Attendance]                 │
└──────────────────────────────────────┘

┌─ STEP 2: DRAFT CALCULATION ──────────┐
│ [Kalkulasi Otomatis]                 │
│ Gross: Rp 60.000.000                 │
│ Deductions: Rp 2.000.000             │
│ Net: Rp 58.000.000                   │
│                                      │
│ Per Employee:                        │
│ ┌──────────────────────────────────┐ │
│ │ Budi (Chef)                      │ │
│ │ Base: 4M + Transport: 500K       │ │
│ │ Gross: 4.500.000                │ │
│ │ Deductions: 670.400              │ │
│ │ Net: 3.829.600                  │ │
│ │ [✏️ Edit] [🗑️ Remove]            │ │
│ └──────────────────────────────────┘ │
│ [➕ Add More] [📥 Import CSV]         │
└──────────────────────────────────────┘

┌─ STEP 3: APPROVAL & PAYMENT ────────┐
│ Status: DRAFT                        │
│ [✅ Approve] [❌ Draft Again]         │
│                                      │
│ Once approved:                       │
│ Payment method: [Transfer/Cash]      │
│ Payment date: [2026-04-05]           │
│ [💳 Mark Paid]                       │
└──────────────────────────────────────┘
```

Interactive features:
- Click employee row → view full salary breakdown (gross, deductions, net)
- [✏️ Edit] → modal for quick adjustments (change allowances, override days)
- [📥 Import CSV] → bulk upload attendance
- [📊 Print Slip] → generate PDF gaji slip per employee

#### Step 5: Unit Tests (1 day)

```python
# test_payroll.py
- test_attendance_recording
- test_gross_salary_calculation_correct
- test_bpjs_deduction_correct_rate
- test_pph_deduction_calculation
- test_net_salary_accurate
- test_payroll_draft_creation
- test_payroll_approval_validation
- test_payment_marking
- test_edge_case_leave_days_half_salary
```

**Expected Output After Sprint 1.3:**
- ✅ Attendance auto-recorded (via Telegram)
- ✅ Payroll auto-calculated with correct deductions
- ✅ Approval workflow (draft → approved → paid)
- ✅ Audit trail of all changes
- **Pain point relief:** 70% manual → 5% (just attendance + approval, calculation is automatic)

---

### SPRINT 1.4: Compliance Push Notifications (4-5 days)

**PAIN POINT SOLVED:**
- Compliance reminders from 0% automated → 100% pushed to users
- Temperature alerts real-time instead of manual check
- SLHS renewal reminders automatic instead of forgotten

**What to Build:**

#### Step 1: Telegram Webhook Setup (1.5 days)

**New Backend Endpoint: POST /telegram/webhook**
```python
# Purpose: Receive webhook calls FROM backend to send Telegram messages
# This allows backend to INITIATE messages (not just bot polling)

# Input: {
#   "telegram_user_id": 123456789,
#   "message_type": "temperature_alert|compliance_reminder|payable_alert|incident_alert",
#   "data": {...}
# }

# Logic:
#   1. Format message based on message_type
#   2. Send via bot.send_message(telegram_user_id, text)
#   3. If callback_query needed: add inline buttons
#   4. Retry logic: if delivery fails, queue for retry

# Example: Temperature Alert
# {
#   "message_type": "temperature_alert",
#   "data": {
#     "location": "Freezer",
#     "temperature": -5,
#     "threshold_normal": [-18, -20],
#     "status": "TOO_WARM"
#   }
# }
# → Message: "⚠️ ALERT: Freezer temperature -5°C (threshold: -18 to -20). Check now!"
```

#### Step 2: Compliance Notification Scheduler (2 days)

**Backend Task: Daily Compliance Reminders (Cron)**
```python
# Trigger: Every day at 08:00 AM
# For each SPPG tenant:

# 1. Temperature logging reminder
#    → Send to: all users with role=owner/admin/kasir
#    → Message: "🌡️ Time to log temperature. [Log Now]"
#    → Link: Telegram message → `/compliance-temp` command

# 2. Hygiene checklist reminder
#    → Send to: kitchen staff
#    → Message: "✅ Higiene check time (7 areas, 2 min). [Start]"

# 3. Food sample check reminder
#    → Send to: owner/admin
#    → Message: "📦 Sample bank check. Any expiring today? [Check]"

# 4. SLHS renewal check
#    → Send to: owner
#    → Message: IF cert expires < 30 days: "⏰ SLHS expires in 15 days. Renew? [Renew Form]"

# 5. Pending compliance tasks
#    → Send to: owner
#    → Message: "3 compliance items pending review. [Review]"
```

**Implementation:**
```python
# backend/tasks/compliance_notifications.py (Celery / RQ task)

@periodic_task(run_at=time(8, 0, 0))  # 8 AM daily
def send_daily_compliance_reminders():
    for tenant in Tenant.objects.filter(is_active=True):
        # Check if tenant has telegram users
        users = User.objects.filter(tenant=tenant, telegram_id__isnull=False)
        for user in users:
            send_telegram_notification(user, "daily_compliance")
```

#### Step 3: Telegram New Commands (1.5 days)

**Command: /compliance-temp**
```python
# Quick temperature logging

# Conversation Handler:
# Step 1: Show locations: [Gudang] [Chiller] [Freezer]
# Step 2: User select location → input temperature
# Step 3: Input example: "-18" or "5" (positive for Room Temp)
# Step 4: POST /compliance/temperature with timestamp + location + temp

# Output: "✅ Temperature logged! Gudang: 28°C (normal)"
```

**Command: /compliance-higiene**
```python
# Quick hygiene checklist

# Form: 7 radio button groups
# Areas: [Kitchen Floor] [Kitchen Walls] [Equipment] [Utensils] [Apron/Hair] [Hands] [Nails]
# Options for each: [✅ Baik] [⚠️ Perlu Perbaikan] [❌ Tidak Layak]

# If any "❌ Tidak Layak": auto-escalate to owner with photo upload prompt

# POST /compliance/hygiene-check
```

**Command: /compliance-sampel** (Food Sample Tracking)
```python
# Show list: "Sampel bank today:"
# Sampel A: Nasi Goreng (taken 09:00, expires 11:00 tmrw)
# Sampel B: Ayam Goreng (taken 09:30, expires 11:30 tmrw)

# For each: [✅ Masih Baik] [❌ Dibuang] [⏰ Diperpanjang]

# If expired < 4 hours:
#   Message: "⏰ SAMPEL EXPIRING! Nasi Goreng expires in 2h. [Discard?]"
```

**Command: /slhs-renew** (Certificate Renewal Reminder)
```python
# Show: "SLHS Certificate Status"
# Current: Valid until 2026-06-15 (2 months left)
# [Renew Now] → link to Web form or PDF generator

# Owner: Can acknowledge + mark as "in process"
```

#### Step 4: Backend Notification Routes (1 day)

**Endpoint: GET /compliance/summary** (dashboard)
```python
# Purpose: Show on Web dashboard + Telegram
# Return all pending compliance items

# Output: {
#   "temperature_alerts": [
#     {"location": "Freezer", "current": -5, "status": "TOO_WARM", "time": "15:30"}
#   ],
#   "hygiene_pending": 0,
#   "sampel_expiring_soon": 2,
#   "slhs_renewal_needed": 1,
#   "total_alerts": 3,
#   "last_check": "2026-04-01T16:00:00"
# }
```

#### Step 5: Unit Tests (0.5 days)

```python
# test_compliance_notifications.py
- test_temperature_alert_triggers_when_out_of_range
- test_hygiene_checklist_form_validation
- test_sampel_expiry_countdown_correct
- test_slhs_renewal_reminder_30days_before
- test_telegram_message_formatting
```

**Expected Output After Sprint 1.4:**
- ✅ Daily compliance reminders pushed to users
- ✅ Real-time temperature alerts
- ✅ SLHS renewal reminders automatic
- ✅ Quick-entry commands for all compliance items
- **Pain point relief:** 80% manual → 40% (compliance reminders + auto-alerts + quick-entry forms)

---

## 📅 TIMELINE SUMMARY

```
SPRINT 1.1: Stock BOM Deduction      4-5 days    ← START HERE
SPRINT 1.2: MBG Delivery Pre-filling 3-4 days
SPRINT 1.3: Payroll Rules Engine     5-6 days   ⭐ HIGHEST RELIEF
SPRINT 1.4: Compliance Notifications 4-5 days

Total: 16-20 working days = 3-4 weeks
```

---

## 💡 WHY THESE 4 SPRINTS?

### ✅ Stock BOM Deduction (FIRST)
- **Low complexity:** Pure database logic + calculation
- **Immediate relief:** 75% manual → 20%
- **No dependencies:** Doesn't need other systems working first
- **Builds confidence:** Quick win to prove automation works

### ✅ MBG Pre-filling (SECOND)
- **Low complexity:** Data pre-population + UI tweaks
- **Quick execution:** Mostly frontend changes
- **High frequency pain:** Daily task that this fixes

### ✅ Payroll Rules (THIRD)
- **Medium complexity:** Requires salary math + attendance tracking
- **Highest pain relief:** 70% manual → 5%
- **Reusable pattern:** Teach you how build calculation engines
- **Tangible ROI:** Owner sees immediate time saving

### ✅ Compliance Notifications (LAST)
- **Medium complexity:** Webhook + task scheduler + formatting
- **Completes automation loop:** Moves from pull-based to push-based
- **Safety improvement:** Reduces compliance risks
- **Has dependencies:** Assumes stock + payroll logic working first

---

## 🚀 IMPLEMENTATION TIPS (For Vibe Coding)

### AI Partnership Strategy

**Phase 1: Specification** (You + ChatGPT)
- Write business requirements
- Have AI generate SQL schema
- Have AI write endpoint signatures
- Paste into your codebase

**Phase 2: Implementation** (You code + AI refines)
- Write the core function (you understand the logic)
- Paste into Claude → ask "refactor for error handling + edge cases"
- Iterate 2-3 rounds
- Your code becomes production-ready

**Phase 3: Testing** (AI generates tests)
- Write 1-2 test examples
- Paste function into Claude → "Generate 10 unit tests for edge cases"
- Copy tests, run locally

**Phase 4: Documentation**
- Let Claude generate API docs from code
- Let Claude write README sections

### Tools That Work Great with Vibe Coding

✅ **Use frequently:**
- GitHub Copilot for autocomplete
- Claude for refactoring existing code
- ChatGPT for SQL queries + schema design

❌ **Avoid:**
- Multi-file refactoring (AI struggles with context)
- Mega-functions (break into 3-4 smaller functions first)
- Premature optimization (get it working, then optimize)

---

## 🎯 SUCCESS METRICS

After completing Phase 1 (all 4 sprints):

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Owner time/day | 10-15 hours | 3-5 hours | ✅ |
| Manual input % | 63% | 25% | ✅ |
| Stock accuracy | 60% | 90% | ✅ |
| MBG setup time | 10 min | 1 min | ✅ |
| Payroll time | 3 hours | 20 min | ✅ |
| Compliance reminder missed | 30% | 5% | ✅ |

---

## ⏭️ NEXT STEPS

### This Week:
1. Pick SPRINT 1.1 (Stock BOM Deduction)
2. Create database schema (ask Claude or me for SQL)
3. Write first API endpoint
4. Test with Telegram bot

### Next Week:
1. Complete SPRINT 1.1
2. Start SPRINT 1.2
3. Collect user feedback on usability

### Week 3-4:
1. SPRINT 1.3 (Payroll) + SPRINT 1.4 (Compliance)
2. Full testing + bug fixes
3. Deploy Phase 1

---

## 🚨 COMMON PITFALLS (Avoid These)

❌ **Pitfall 1:** Try to do everything at once
→ Pick ONE sprint, finish fully, then move

❌ **Pitfall 2:** Over-engineer error handling on first pass
→ Make it work first, refactor for robustness second week

❌ **Pitfall 3:** Forget to test edge cases
→ Use AI to generate test cases, don't guess

❌ **Pitfall 4:** Don't deploy until "perfect"
→ Deploy working → gather feedback → iterate

---

## 💬 QUESTIONS TO ASK YOURSELF

Before starting each sprint:
- [ ] Can I build this in Python/FastAPI without external APIs?
- [ ] Will this solve a real pain point for the owner?
- [ ] Can I test this locally before deploying?
- [ ] Is the success criteria clear (how do I know when done)?
- [ ] Can I explain this in 1-2 sentences?

If YES to all 5 → Go build it! 🚀

