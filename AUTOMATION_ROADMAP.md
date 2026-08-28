# 🎯 MBG ACCOUNTING SYSTEM - AUTOMATION ROADMAP

**STATUS:** Strategy Document | Date: 31 Maret 2026  
**Vision:** Replace Accountant with Software-Driven Workflow  
**Current Manual Effort:** 63% | **Target:** 20% | **ROI:** -43% effort reduction

---

## 📋 EXECUTIVE SUMMARY

Your system currently requires **63% manual input** across all modules. To truly **replace an accountant**, automation must increase to **80-90%**, reducing owner's effort from **10-15 hours/week** to **2-3 hours/week**.

**Key Issue:** You built a data entry system. Accountants don't enter data—they **verify, categorize, analyze & report**. System needs rebuild focus on **automation layer**, not UI.

**Timeline:** 3-4 bulan untuk Phase 1 & 2 (core automation)

---

## 🔍 MANUAL INPUT AUDIT BY MODULE

### 1. PEMBUKUAN (Accounting) - 🔴 80% MANUAL

**Current Workflow:**
```
Nota belanja diterima
    ↓ [Manual foto nota]
    ↓ [Upload ke app]
    ↓ [Owner input: tanggal, supplier, amount, kategori, metode bayar]
    ↓ [Mark: hutang/lunas]
    ↓ [Save transaction]
```

**Problems:**
- 7+ manual input steps per transaksi
- Typo dari handwriting foto nota → data mismatch
- Supplier baru harus create manual
- Kategori salah → laporan salah
- No verification vs actual stock received
- Monthly reconciliation manual

**Desired Workflow (80% → 30%):**
```
Nota atau invoice PDF/WhatsApp
    ↓ [Gemini OCR → extract tanggal, supplier, amount, items]
    ↓ [GPT categorization → predict kategori dari item names]
    ↓ [Bot lookup supplier dari database]
    ↓ [Pre-fill form: tanggal, supplier, amount, kategori]
    ↓ [Owner review + click APPROVE]
    ↓ [Auto-match dengan delivery/stok jika available]
    ↓ [Auto-mark hutang/lunas based on payment terms]
```

**Automation Options:**
- ✅ Gemini Vision API → photo nota → extract structured data
- ✅ GPT-4 → item name → kategori prediction (88% accuracy)
- ✅ Fuzzy matching → supplier lookup (handle typo)
- ✅ Bank reconciliation API → auto-match transfers dengan utang
- ✅ Payment term rules → auto-suggest hutang/lunas status

**Expected ROI:**
```
Before: 15 transaksi × 5 min = 75 min/hari = 6.25 jam/minggu
After: 15 transaksi × 2 min = 30 min/hari = 2.5 jam/minggu
Saved: 3.75 jam/minggu = 195 jam/tahun = 24 hari kerja = 1 akuntan

Monthly saving Rp 2-3 juta (akuntan salary/30)
```

---

### 2. MBG (Deliveries) - 🟡 50% MANUAL

**Current Workflow:**
```
Daily:
    - Input menu name (manual) ✋
    - Input schools list (manual) ✋
    - Input portions per school (manual) ✋
    ↓
    - System auto-calc revenue (from portions × price)
    ↓
Delivery:
    - Print/fill BAST form (semi-auto)
    - School sign (manual) ✋
    - School input consumption (manual) ✋
```

**Problems:**
- Alokasi MBG sudah ada di database, tapi re-input setiap hari
- Menu dari weekly planning tapi manual copy
- School address sudah di master tapi manual lookup
- Portion calculation dari alokasi tapi manual re-entry

**Desired Workflow (50% → 15%):**
```
Day before (5 menit full setup):
    - Alokasi master sudah ada:
        School A: 250 porsi
        School B: 180 porsi
        School C: 320 porsi
    - Menu planning sudah ada (e.g., Nasi Goreng, Ayam, etc)
    ↓ [System auto-populate delivery form]
        - Schools: [from alokasi]
        - Portions: [from alokasi]
        - Menu: [from planning]
    ↓ [Owner review: "Ok, looks good"]
    ↓ [System auto-generate BAST template 50% pre-filled]
    ↓ [Kitchen print BAST]
    ↓ [Driver fill: depart time, arrival time, temp, notes]
    ↓ [School scan QR BAST → auto-fill consumption form]
    ↓ [School staff input: porsi habis, sisa, alasan]
    ↓ [Auto-update: receivables, waste report, stock]
```

**Automation Options:**
- ✅ Load alokasi master as daily delivery template
- ✅ Link menu planning to delivery form
- ✅ QR code generation per delivery (BAST tracking)
- ✅ QR scan → pre-fill school consumption form
- ✅ WhatsApp link → school staff dapat form via WA (mobile-friendly)
- ✅ Form submission → auto-update backend (no manual entry school-side)

**Expected ROI:**
```
Before: 10 min setup/day + accounting staff time = 1 hour/day
After: 5 min setup/day (just approval) = 0.25 hour/day
Saved: 0.75 hour/day = 3.75 jam/minggu

Plus: School staff dapat auto form dengan QR link (no manual PDF download)
```

---

### 3. STOK (Inventory) - 🔴 75% MANUAL

**Current Workflow:**
```
Bahan tiba:
    - Manual count qty ✋
    - Search product ✋
    - Input qty ke sistem ✋
    ↓
Daily usage:
    - No tracking (guess-based)
    ↓
Monthly:
    - Manual recount semua stok ✋
    - Update qty ✋
    - Note discrepancies ✋
    - Adjust ✋
```

**Problems:**
- **Stok qty ALWAYS mismatch** dengan actual (bisa 10-30% error)
- Supplier bayar based on manual adjustment (unreliable)
- No consumption tracking = no waste detection
- No reorder alert = stockout risk
- BOM recipe exist tapi no auto-deduction saat masak

**Desired Workflow (75% → 25%):**
```
Bahan tiba:
    - Barcode label setiap item ✋ (1 scan per batch)
    ↓ [System auto-lookup product dari barcode]
    ↓ [Input qty single field]
    ↓ [Auto-update stok]
    ↓
Daily cooking:
    - Kitchen view daily menu
    - Menu A (Nasi Goreng) has BOM recipe:
        - Beras: 2kg
        - Minyak: 0.5 liter
        - Telur: 1 dozen
        - (etc)
    ↓ [Kitchen confirm: "Buat 250 porsi menu A"]
    ↓ [System auto-deduct from inventory: Beras -500kg, Minyak -125ml, etc]
    ↓
Optional IoT:
    - Weight sensor di fridge/freezer
    - Auto-track saat bahan diambil
    - Alert jika qty < minimum
    ↓
Weekly reconciliation:
    - System show expected vs actual
    - Auto-alert if discrepancy > 5%
    - Owner mark reason (rusak, spillage, dll)
    ↓
Monthly:
    - Auto-generate consumption report
    - Auto-suggest reorder quantity based on usage pattern
```

**Automation Options:**
- ✅ Barcode/QR generation (Django batch generator)
- ✅ BOM-based deduction formula (database relationship)
- ✅ Expected consumption calculation (from % porsi × recipe)
- ✅ Automatic reorder suggestion (using EOQ formula)
- ✅ Optional: IoT temperature + weight sensors (Rp 500k-1jt per unit)
- ✅ Mobile barcode scanner app (cheap - use phone camera)

**Expected ROI:**
```
Before: 1 hour/week inventory check + 2 hours/month reconciliation = 3 hours/month
After: 15 min/week reconciliation (review only) = 1 hour/month

Saved: 2 hours/month = 10% inventory accuracy improvement
Plus: Real-time consumption insights (for supplier negotiation)
```

---

### 4. COMPLIANCE (Higiene, Suhu, Sampel, Waste, Incident, SLHS) - 🔴 80% MANUAL

**Current Workflow:**
```
Dapur:
    - Morning: Input higiene checklist 7 areas ✋ (10 min)
    - 3x daily: Input temperature 3 locations ✋ (5 min × 3 = 15 min)
    - Daily: Ambil sampel + input form ✋ (10 min)
    ↓
School:
    - Manual input: portions received ✋
    - Manual input: consumption ✋
    - Manual input: waste reason ✋
    ↓
Total: 35 min/day manual compliance tasks
```

**Problems:**
- Manual entry = humans forget/skip (compliance fail)
- No real-time monitoring (temperature alert delayed)
- No push notification (school forget to input waste)
- Monthly compliance report requires manual aggregation
- Incident response based on manual reporting (slow)

**Desired Workflow (80% → 25%):**
```
Temperature (Auto):
    - IoT sensors (if budget allow) OR manual entry optional
    - Auto-log setiap 1-2 jam
    - Auto-alert jika outside range (push notification)
    ↓
Higiene Checklist (Push-based):
    - Daily 08:00: Push notification "Cek higiene sekarang?"
    - Kitchen staff buka link → quick form (radio buttons only, 30 detik)
    - Optional attachment: photo jika status "Tidak Layak"
    - Auto-check: if any "Tidak Layak" → escalate to owner
    ↓
Bank Sampel (QR-based):
    - Label QR per menu per day
    - Kitchen scan QR + timestamp
    - System auto-calc: taken_at + 48h = expiry
    - Auto-alert: 4h sebelum expiry (push notification)
    - School/Owner mark "dibuang" via link
    ↓
Waste Reporting (Mobile-friendly):
    - School terima delivery → auto-send QR link via WA
    - Link pre-filled: School name, Menu, Portions sent
    - School just select: Portions consumed + Reason
    - Submit → auto-update database
    ↓
Incident (Auto-triggered):
    - Temperature abnormal 2x in a row → auto-create incident draft
    - Hygiene "Tidak Layak" → auto-create incident draft
    - Owner review + classify (serious / minor)
    ↓
SLHS (Automated alerts):
    - Certificate expiry date in database
    - 30 hari sebelum expiry → push notification "Renew SLHS"
    - Auto-generate renewal reminder email
```

**Automation Options:**
- ✅ Firebase Cloud Messaging (push notifications)
- ✅ QR code generation + WhatsApp API integration
- ✅ Mobile-first forms (not desktop-only)
- ✅ Automated incident draft creation (rules engine)
- ✅ Email alerts for critical issues (temp, hygiene fail)
- ⚠️ IoT sensors (optional, nice-to-have)

**Expected ROI:**
```
Before: 35 min/day × 25 days = 14.5 hours/month manual compliance
After: 5 min/day review (just check) = 2 hours/month

Saved: 12.5 hours/month = 50% reduction
Plus: Data quality improvement from 60% → 95% (less human error)
Plus: Faster incident response (auto-alert vs manual discovery)
```

---

### 5. KARYAWAN & PAYROLL - 🔴 70% MANUAL

**Current Workflow:**
```
Setup (once):
    - Master job positions ✋
    - Master employee data + salary ✋
    - Salary structure & allowances ✋
    ↓
Monthly:
    - Manual attendance tracking ✋ (or attendance machine, then export)
    - Count attendance days ✋
    - Calculate: base salary + overtime - deductions ✋
    - Manual bank transfer list ✋
    - Create payroll slip ✋
    - Process payment ✋
    ↓
Report:
    - Manual payroll summary ✋
```

**Problems:**
- Attendance data isolated from payroll (manual copy)
- Overtime calculation manual (error-prone)
- Deduction rules manual (salary component = spaghetti code)
- Bank transfer manual (high fraud risk)
- No audit trail (who changed salary when?)

**Desired Workflow (70% → 20%):**
```
Setup (once):
    - Define salary structure as rules:
        - Base salary Rp X
        - Allowance Rp Y
        - Overtime: 1.5× hourly rate
        - Deduction: absen = -50% daily
        - Deduction: late = -10k per 5 min
    ↓ [Save as "Default Structure" in database]
    ↓
Daily attendance (Automate):
    - QR code punch-in/out at gate ✋ (1 scan in, 1 out)
    - GEO-location mobile app check-in (if no QR machine)
    - Auto-log: time_in, time_out
    - System calculate: hours_worked per day
    ↓
Monthly payroll (Auto):
    - Trigger: 1st of month
    - Pull attendance data
    - Apply salary structure × formula
    - Auto-generate payroll slip per employee
    - Summary report auto-generated
    - Payroll status: pending → approved (manager review)
    ↓
Payment (Automated):
    - Approved payroll → export to bank API
    - (BRI/Mandiri/BCA batch payment integration)
    - OR generate QR bulk payment (store → owner → process)
    - Auto-track: payment_status = sent/confirmed
    ↓
Report:
    - Payroll historical data (searchable by date/employee)
    - Tax calculation (PPh 21) auto-computed
    - Annual payroll summary auto-generated
```

**Automation Options:**
- ✅ QR code scanners at gate (Rp 500k-2jt)
- ✅ Mobile attendance app (geo-location + PIN)
- ✅ Salary calculation rules engine (database + formula)
- ✅ Bank batch API integration (BRI/Mandiri/BCA)
- ✅ Attendance data sync (punch-in → payroll no manual copy)
- ✅ Audit log (who approved, when, what changed)

**Expected ROI:**
```
Before: 2 hours/month payroll processing × 12 = 24 hours/year
After: 30 min/month review = 6 hours/year

Saved: 18 hours/year
Plus: Salary transparency (employee dapat slip otomatis, no hardcopy manual)
Plus: Tax compliance automated (PPh 21 calculation built-in)
Plus: Fraud prevention (automated approval workflow)
```

---

### 6. KEUANGAN (Receivables/Payables) - 🟡 40% MANUAL

**Current Workflow:**
```
Piutang (Receivable):
    - Manual track jika ada outstanding ✋
    - Manual reminder ✋
    - Manual mark lunas ✋
    ↓
Hutang (Payable):
    - Auto-track dari pembukuan
    - Manual mark lunas ✋
    - No payment reminders
```

**Problems:**
- School bisa lupa bayar (no reminder)
- Supplier bisa complain (no proof of payment)
- Manual reconciliation (error-prone)
- No aging report (How old is this invoice?)

**Desired Workflow (40% → 10%):**
```
Piutang (Auto):
    - Auto-link dari MBG delivery revenue
    - Auto-generate invoice PDF
    - Auto-email/WA invoice ke school
    - Auto-expect payment date (dari term)
    ↓ [3 hari sebelum due date]
    - Auto-send reminder SMS/WA ke school
    ↓ [School transfer payment]
    - Bank reconciliation auto-match
    - Payment status auto-update (lunas)
    ↓ [Payment overdue]
    - Auto-send escalation notification
    ↓
Hutang (Auto):
    - Auto-link dari pembukuan transaction
    - Auto-generate PO
    - Auto-send PO ke supplier
    ↓ [3 hari sebelum due date]
    - Auto-send payment reminder
    ↓ [Owner prepare payment]
    - System auto-calc: total hutang bulan ini
    - Generate bank transfer list
    - Process payment
    ↓ [Bank transfer sent]
    - Auto-mark hutang status: pending → sent
    - Track confirmation via bank

Report:
    - Aging report: 0-30d, 30-60d, >60d (auto-generated)
    - Receivable/Payable summary (auto-aggregated)
```

**Automation Options:**
- ✅ Email/SMS/WhatsApp API (notification)
- ✅ Bank reconciliation API (match transfer with invoice)
- ✅ Auto-invoice generation (template + data merge)
- ✅ Aging calculation (date arithmetic)
- ✅ Payment term rules (due date from terms)

**Expected ROI:**
```
Before: 1 hour/week piutang follow-up + hutang tracking = 4 hours/month
After: 15 min/week review = 1 hour/month

Saved: 3 hours/month
Plus: Collection rate improvement 5-10% (automatic reminders)
Plus: Supplier satisfaction improvement (no late payment surprises)
```

---

### 7. ANGGARAN (Budget) - 🟡 50% MANUAL

**Current Workflow:**
```
Setup (once/year):
    - Manual input total pagu ✋
    - Manual breakdown per kategori ✋
    ↓
Track spending:
    - Auto from pembukuan (OK)
    - But kategori salah → budget salah ✋
    ↓
Report:
    - Auto vs target calculation
    - Auto alert jika over budget
```

**Problems:**
- Initial budget breakdown = guesswork
- No spend pattern analysis
- Manual categorization from pembukuan (garbage in, garbage out)
- Budget adjustment manual mid-year

**Desired Workflow (50% → 15%):**
```
Setup (once/year):
    - Input total annual pagu
    - System analyze last 2 years:
        - Historical spend per kategori
        - Seasonal patterns
        - Growth rate
    ↓ [System auto-suggest breakdown]
        - Operasional: 50%
        - Peralatan: 20%
        - Personnel: 30%
    ↓ [Owner adjust if needed]
    ↓ [System auto-allocate monthly budget]
        - Based on seasonal pattern
        - (Some months higher, some lower)
    ↓
Track spending (Auto):
    - From pembukuan with AI categorization
    - Manual override only if wrong (< 5% of cases)
    ↓
Report (Auto):
    - Real-time dashboard showing:
        - Year-to-date spend vs budget
        - Monthly burn rate
        - Forecast: will we over/under?
        - Red/yellow/green status per kategori
    ↓
Alert (Auto):
    - Kategori approaching 80% → yellow warning
    - Kategori exceeding 100% → red alert
    - (No manual checking needed)
```

**Automation Options:**
- ✅ Historical data analysis (SQL aggregation)
- ✅ Pattern detection (seasonal adjustment)
- ✅ AI categorization (from pembukuan OCR)
- ✅ Forecast calculation (burn rate × remaining period)
- ✅ Real-time dashboard (update on every transaction)

**Expected ROI:**
```
Before: 1 hour/month budget tracking + adjustments = 12 hours/year
After: 15 min/month review = 3 hours/year

Saved: 9 hours/year = minimal time saving BUT
Plus: Better budget planning (data-driven, not guesswork)
Plus: Early warning (catch overspend before too late)
```

---

## 📊 OVERALL SUMMARY TABLE

| Module | Current Manual % | Target Manual % | Time Saved/Month | Priority |
|--------|-------------------|-----------------|------------------|----------|
| Pembukuan | 80% | 30% | 4 hours | 🔴 P0 |
| MBG | 50% | 15% | 0.75 hour | 🟡 P1 |
| Stok | 75% | 25% | 2 hours | 🔴 P0 |
| Compliance | 80% | 25% | 12.5 hours | 🔴 P0 |
| Payroll | 70% | 20% | 1.5 hours | 🟡 P1 |
| Keuangan | 40% | 10% | 3 hours | 🟡 P1 |
| Anggaran | 50% | 15% | 0.75 hour | 🟢 P2 |
| **TOTAL** | **63%** | **20%** | **24 hours/month** | - |

**Interpretation:**
- **Current:** Owner/akuntan spending **~6 hours/week = 24 hours/month** on manual tasks
- **Target:** Owner spending **~1.5 hours/week = 6 hours/month** (mostly reviewing, not entering)
- **Result:** Saved **18 hours/month = TIME FOR OTHER BUSINESS ACTIVITIES**

---

## 🚀 IMPLEMENTATION ROADMAP

### **PHASE 1: FOUNDATION (Months 1-2) — Core Automation Layer**

#### Sprint 1.1: Pembukuan Automation (2 weeks)
**Goal:** Reduce pembukuan manual effort from 80% → 50%

**Tasks:**
- [ ] Integrate Gemini Vision API
  - Get invoice PDF/photo input
  - Extract: tanggal, supplier, amount, items
  - Output: structured JSON
- [ ] Setup Gemini AI categorization
  - Train on existing transactions
  - Create prompt: "Based on items {item_list}, predict kategori"
  - Fallback: show top 3 suggestions to owner
- [ ] Modify pembukuan form UI
  - Pre-fill fields from OCR
  - Show "Recommended kategori: Operasional"
  - Owner just click APPROVE + adjust if needed
- [ ] Create fuzzy-match supplier lookup
  - Handle typo from OCR (e.g., "TOKO SUMBER REJEKI" ≈ "TOKO SUMBER")
  - Suggest closest match
  - Allow "Create new supplier"
- [ ] Add bank reconciliation skeleton
  - (Phase 2 full integration)
  - For now: manual bank statement upload → parse dates/amounts
  - Match with pembukuan transactions automatically

**Output:** Owner dapat upload invoice → form 70% pre-filled → click OK

**Effort:** 80 hours (backend + frontend)  
**Cost:** Gemini Vision API usage (Rp 50k-100k/hari)

---

#### Sprint 1.2: Compliance Push Notifications (2 weeks)
**Goal:** Reduce compliance manual effort from 80% → 50% + improve data quality

**Tasks:**
- [ ] Setup Firebase Cloud Messaging (FCM)
  - Create admin panel untuk schedule push
  - Test push delivery
- [ ] Mobile-first compliance forms
  - Higiene: radio buttons only (baik/perlu_perbaikan/tidak_layak)
  - Temperature: number input + preset buttons
  - Redesign untuk mobile (large buttons, minimal scrolling)
- [ ] Daily push notification scheduler
  - 08:00: "Cek higiene sekarang?"
  - 09:00, 13:00, 16:00: "Catat suhu dapur?"
  - Owner dapat customize timing
- [ ] QR code generation per bank sampel
  - Generate QR → label
  - QR link → pre-filled consumption form
- [ ] WhatsApp API integration (basic)
  - Send form link ke school via WA (not full chat bot yet)
  - Track link click → auto-fill form header

**Output:** Staff can't forget compliance tasks (nudged via notifications)

**Effort:** 60 hours (backend + frontend + FCM setup)  
**Cost:** Firebase (free tier ok for start), or Twilio (Rp 5k per SMS if use SMS instead)

---

#### Sprint 1.3: Payroll Rules Engine (2 weeks)
**Goal:** Reduce payroll manual effort from 70% → 40% + audit trail

**Tasks:**
- [ ] Design salary calculation schema
  ```json
  {
    "salary_structure": {
      "position_id": "pos_001",
      "base_salary": 3000000,
      "allowances": [
        {"name": "transport", "amount": 200000},
        {"name": "meal", "amount": 100000}
      ],
      "deductions": [
        {"name": "absent", "percent_per_day": -50},
        {"name": "late_5min", "amount": -10000}
      ],
      "tax_pph21": true
    }
  }
  ```
- [ ] Create payroll calculation function
  - Input: attendance data (days_worked, days_absent, hours_overtime)
  - Output: gross_salary, deductions, net_salary, tax
  - Add audit log: "Calculated on 2026-03-31 by system"
- [ ] Implement QR-based attendance
  - Create QR code at entry
  - Staff scan In/Out
  - App auto-log: time_in, time_out
  - Not required: existing attendance machine still OK (manual import)
- [ ] Auto-generate payroll slip
  - PDF template atau HTML
  - Include: gross, deductions breakdown, net, tax
  - Timestamp + calculation proof
- [ ] Monthly payroll trigger
  - Every 1st of month at 01:00 AM:
    - Calculate all employees
    - Generate slips
    - Payroll status: auto_calculated (pending owner approval)
- [ ] Payroll approval workflow
  - Owner view: "Payroll report for March 2026"
  - Show: total salary, total deductions, total net
  - Approve button
  - Once approved: payroll_status = approved

**Output:** Owner enter 5 lines salary structure once → auto-calculated monthly

**Effort:** 70 hours (backend rules engine + frontend + QR scanner mobile app)  
**Cost:** QR library (free), Firebase for geo-location backup (free tier)

---

#### Sprint 1.4: Deployment & Testing (1 week)
**Tasks:**
- [ ] Integration testing (all 3 sprints together)
- [ ] UAT with owner (trial run, feedback)
- [ ] Performance testing (Gemini API rate limit, FCM reliability)
- [ ] Documentation for owner
- [ ] Deployment to staging

**Effort:** 40 hours

---

### **PHASE 2: ECOSYSTEM EXPANSION (Months 3-4) — Data Integration & Intelligence**

#### Sprint 2.1: MBG Alokasi Integration (2 weeks)
**Goal:** MBG manual effort 50% → 20%

**Tasks:**
- [ ] Link alokasi master to daily delivery generation
  - Endpoint: `/api/delivery/generate-daily?date=2026-04-01`
  - Load from alokasi_mbg table
  - Pre-fill: schools[], portions[], menu_id
  - Owner review + click APPROVE
- [ ] QR code per delivery
  - Generate unique QR per delivery
  - QR link → consumption form (school side)
  - Pre-filled: school_name, portions_sent
- [ ] WhatsApp delivery notification
  - Send QR link to school contact
  - School scan or click link
  - Form opens mobile-optimized
  - Submit → auto-update database
- [ ] BAST auto-generation
  - Template with pre-filled data
  - Print-ready PDF
  - Includes: menu, portions, schools, signature line
  - Driver/school fill only: times, temp, notes

**Output:** Daily setup 5 min (just approve) instead of manual entry

**Effort:** 50 hours

---

#### Sprint 2.2: Stock BOM Deduction (2 weeks)
**Goal:** Stock manual effort 75% → 40%

**Tasks:**
- [ ] Create BOM (Bill of Materials) per recipe
  - Database schema: recipe_id, product_id, qty, unit
  - Example: Nasi Goreng = Beras 2kg, Minyak 0.5L, Telur 1dz, etc
- [ ] Daily kitchen menu selection
  - Kitchen select: "Make 250 porsi Nasi Goreng"
  - System show: "Expected deduction: Beras 500kg, Minyak..."
  - Kitchen confirm
  - Auto-deduct from inventory
- [ ] Weekly reconciliation UI
  - Show: Expected qty, Actual qty, Difference
  - Alert if > 5% variance
  - Owner select reason: "Spillage", "Damaged", "Recount", etc
  - Adjust qty
- [ ] Reorder suggestion algorithm
  - Historical consumption (last 3 months average)
  - Minimum stock level
  - Lead time
  - Calculate: when to reorder + how much
  - Suggest to owner: "Time to order Beras (usually 200kg/week, current 50kg)"
- [ ] Barcode integration
  - Generate barcode for each product
  - Receiving module: scan barcode + input qty
  - Auto-lookup product
  - Auto-update stock

**Output:** Real-time stock tracking with auto-deduction

**Effort:** 80 hours

---

#### Sprint 2.3: Bank & Supplier Integration (2 weeks)
**Goal:** Keuangan manual effort 40% → 15%

**Tasks:**
- [ ] Bank reconciliation (beta)
  - Support: BRI, Mandiri, BCA (via sandbox API)
  - Pull daily transactions
  - Match with pembukuan entries
  - Show: matched, unmatched
  - Owner verify & approve
- [ ] Bank batch payment API
  - Payroll payment list → convert to bank format
  - Supplier payment list → convert to bank format
  - Option: auto-send to bank OR download + owner review
- [ ] Invoice auto-email to school
  - Trigger: MBG delivery completed
  - Generate invoice PDF
  - Email to school_contact_email
  - Include: payment term, bank details, QR code
- [ ] Aging report automation
  - Show receivables by age: 0-30d, 30-60d, >60d
  - Show payables by age
  - Sort: most urgent first
  - Auto-calculate: expected revenue vs actual (for forecasting)

**Output:** Payment reconciliation semi-automated

**Effort:** 70 hours

---

#### Sprint 2.4: Anggaran Forecasting (2 weeks)
**Goal:** Budget planning smarter (not just reduction, but enablement)

**Tasks:**
- [ ] Historical analysis
  - Analyze last 2 years data
  - Calculate monthly pattern (seasonality)
  - Identify trends
- [ ] Budget suggestion algorithm
  - Input: expected growth % + total pagu
  - Output: suggested breakdown per kategori + monthly allocation
- [ ] Spend trend dashboard
  - Real-time vs budget comparison
  - Forecast: will we over/under?
  - Status: on-track / at-risk / critical
- [ ] Auto-categorization improvement
  - Gemini categorization (from sprint 1) should be 90%+ accurate by now
  - Train model on collected data
  - Reduce manual override to < 5%

**Output:** Budget manager instead of budget tracker

**Effort:** 60 hours

---

#### Sprint 2.5: Integration Testing & Documentation (1 week)
**Tasks:**
- [ ] End-to-end workflow testing
- [ ] Performance optimization
- [ ] User documentation (video tutorial-ready)
- [ ] Owner training session

**Effort:** 40 hours

---

### **PHASE 3: INSIGHTS & REPORTING (Month 5 — Optional but High-Value)**

This phase turns software into a **business intelligence tool**, not just accounting.

#### Tasks:
- [ ] AI-generated financial summary
  - Monthly: "Revenue up 15%, expenses down 3%, profit margin 22%"
  - Trend: "Revenue trend: ↑ Improving (YoY +8%)"
  - Alert: "Operasional expense over budget by 12% (Rp 45jt)"
- [ ] Anomaly detection
  - Flag unusual transactions: "Supplier charge 2x normal price?"
  - Flag unusual patterns: "Temperature out of range 3x this week"
  - Flag unusual behavior: "New supplier payment 5 days early?"
- [ ] Predictive analytics
  - Forecast next month revenue based on alokasi
  - Forecast cash flow (when low?)
  - Suggest: "Consider stockpiling bahan X next month (seasonal)"
- [ ] Comparison reports
  - Month-to-month
  - Year-to-year
  - vs Budget
  - vs Industry benchmark (if available)
- [ ] Export reports
  - PDF formal financial statements
  - Excel with raw data (for auditor)
  - On-demand (owner click "Generate Report")

**Output:** Owner can generate full financial report in 5 minutes (no akuntan needed)

**Effort:** 100 hours

---

## 💰 COST BREAKDOWN

### Development Cost

| Component | Effort (hrs) | Rate/hr | Total |
|-----------|-------------|---------|-------|
| Phase 1 (Foundation) | 250 | Rp 150k | Rp 37.5M |
| Phase 2 (Integration) | 300 | Rp 150k | Rp 45M |
| Phase 3 (Intelligence) | 100 | Rp 200k (senior) | Rp 20M |
| **Total Development** | **650** | - | **Rp 102.5M** |

### Operational Cost (Annual)

| Service | Usage | Cost/Month | Cost/Year |
|---------|-------|-----------|-----------|
| Gemini Vision API | 300 invoices/month × Rp 200/image | Rp 60k | Rp 720k |
| Firebase FCM | < 10M messages/month (free tier) | Rp 0 | Rp 0 |
| Bank API (BRI) | 1 pull/day + batch payment | Rp 500k | Rp 6M |
| Twilio/SMS | 50 SMS/month | Rp 50k | Rp 600k |
| Cloud storage | Invoices + receipts (1GB/month) | Rp 100k | Rp 1.2M |
| Email service | 100/month | Rp 0 | Rp 0 |
| **Total Ops** | - | **Rp 710k** | **Rp 8.52M** |

### ROI Analysis

**Scenario: Remove 1 Accountant**

```
Akuntan salary: Rp 3,500,000/bulan = Rp 42M/year

Development cost: Rp 102.5M (amortized over 2 years = Rp 51.25M/year)
Operational cost: Rp 8.52M/year
Total cost year 1: Rp 51.25M + Rp 8.52M = Rp 59.77M

Akuntan salary saved: Rp 42M
Net cost year 1: Rp 59.77M - Rp 42M = Rp 17.77M (investment year 1)

Year 2 onwards:
Akuntan salary saved: Rp 42M
Development cost: Rp 0 (already paid)
Operational cost: Rp 8.52M
Profit: Rp 42M - Rp 8.52M = Rp 33.48M/year
```

**Payback period: ~17 months**

**Additional benefits:**
- Better data quality (90% vs 60% accuracy)
- Real-time reports (vs monthly manual)
- Audit trail (vs no documentation)
- Scalability (handle 2-3 branches without proportional cost)

---

## 🔧 TECH STACK FOR AUTOMATION

### APIs & Services

```
OCR:
  - Gemini Vision API (invoke from backend)
  
AI Categorization:
  - Gemini AI (for invoice categorization)
  - Fallback: Rule-based (if Gemini fail)
  
Push Notifications:
  - Firebase Cloud Messaging (FCM)
  - Fallback: WhatsApp API (if FCM blocked in region)
  
Payment Integration:
  - Bank APIs: BRI, Mandiri, BCA (for reconciliation + batch payment)
  - Stripe/Xendit (if need third-party payment aggregator)
  
Communication:
  - Twilio SMS (or Zendesk, MessageBird)
  - WhatsApp API (official, via Meta)
  
Reporting:
  - ReportLab / Jasper (PDF generation)
  - Plotly / Recharts (charts, already have Recharts)
  
QR Code:
  - Python-qrcode (backend generation)
  - ZXing or native camera (mobile scanning)
```

### Database Schema Additions

```sql
-- Salary Structure (new)
CREATE TABLE salary_structures (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants,
  position_id UUID REFERENCES positions,
  base_salary DECIMAL,
  rules JSONB, -- {allowances: [...], deductions: [...]}
  created_at TIMESTAMP
);

-- Invoice Data (enhanced)
ALTER TABLE transactions ADD COLUMN (
  ocr_extracted JSONB, -- raw OCR output
  ocr_extracted_at TIMESTAMP,
  ai_suggested_category TEXT,
  ai_confidence DECIMAL
);

-- BOM (Bill of Materials) - new
CREATE TABLE recipes (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants,
  name TEXT,
  portions INTEGER,
  created_at TIMESTAMP
);

CREATE TABLE recipe_items (
  id UUID PRIMARY KEY,
  recipe_id UUID REFERENCES recipes,
  product_id UUID REFERENCES products,
  qty DECIMAL,
  unit TEXT
);

-- Attendance (enhanced)
CREATE TABLE attendance (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employees,
  date DATE,
  time_in TIME,
  time_out TIME,
  hours_worked DECIMAL,
  created_at TIMESTAMP
);

-- Payroll (new)
CREATE TABLE payroll (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employees,
  period_month INTEGER,
  period_year INTEGER,
  gross_salary DECIMAL,
  deductions DECIMAL,
  net_salary DECIMAL,
  tax_pph21 DECIMAL,
  status TEXT, -- auto_calculated, pending_approval, approved, paid
  created_at TIMESTAMP
);

-- Budget Forecast (enhanced)
CREATE TABLE budget_forecast (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants,
  period_year INTEGER,
  period_month INTEGER,
  category TEXT,
  budget_allocated DECIMAL,
  spend_ytd DECIMAL,
  forecast_eom DECIMAL,
  status TEXT -- on_track, at_risk, critical
);
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Foundation (Months 1-2)

**Sprint 1.1: Pembukuan Automation**
- [ ] Setup Gemini Vision API credentials + quota
- [ ] Test OCR on 10 sample invoices
- [ ] Create invoice upload endpoint (/api/transactions/upload-invoice)
- [ ] Implement OCR parsing (tanggal, supplier, amount, items extraction)
- [ ] Create AI categorization prompt
- [ ] Train on existing 100 transactions (if available)
- [ ] Update pembukuan form to show OCR-pre-filled fields
- [ ] Add fuzzy-match supplier lookup
- [ ] Create supplier creation flow
- [ ] UI/UX review & polish
- [ ] Testing: upload 50 invoices, check accuracy %
- [ ] Deploy to backend

**Sprint 1.2: Compliance Push Notifications**
- [ ] Setup Firebase FCM project
- [ ] Create mobile app for notifications (React Native / Flutter? or web PWA?)
- [ ] Design compliance form (higiene, temperature, sampel)
- [ ] Create mobile-optimized form UI
- [ ] Implement QR code generation per sampel
- [ ] Setup notification scheduler (background job)
- [ ] Create push notification templates
- [ ] Test FCM delivery (10 devices)
- [ ] WhatsApp API integration (optional for phase 2)
- [ ] Deploy to production

**Sprint 1.3: Payroll Rules Engine**
- [ ] Design salary structure schema
- [ ] Create salary calculation function (test with 5 employees)
- [ ] Implement QR attendance scanner (web + mobile)
- [ ] Create payroll slip PDF template
- [ ] Setup monthly payroll trigger (cron job)
- [ ] Create payroll approval workflow UI
- [ ] Test: calculate payroll for March 2026 (sample data)
- [ ] Deploy to backend

**Sprint 1.4: Testing & Documentation**
- [ ] Integration testing (all 3 components)
- [ ] UAT session with owner (feedback)
- [ ] Fix bugs found in UAT
- [ ] Document for owner (how to use + troubleshooting)
- [ ] Deployment to production

**Done Criteria:** 
- Pembukuan: Form 70% autofill, owner just click approve (80% → 50% manual)
- Compliance: Notifications sent daily, staff response 90%+ (80% → 50% manual)
- Payroll: Auto-calculated, slips generated (70% → 45% manual)
- Overall effort reduced: 24 hours/month → 15 hours/month

---

### Phase 2: Integration & ecosystem (Months 3-4)

**Sprint 2.1: MBG Alokasi Integration**
- [ ] Link alokasi master to delivery generation
- [ ] Create `/api/delivery/generate-daily` endpoint
- [ ] Generate QR per delivery
- [ ] Design consumption form (mobile-optimized)
- [ ] WhatsApp notification with form link
- [ ] Test: create 5 sample deliveries, school fill consumption
- [ ] Deploy

**Sprint 2.2: Stock BOM Deduction**
- [ ] Design BOM schema
- [ ] Create recipes database (Nasi Goreng, Ayam, etc)
- [ ] Input BOM for each recipe (2 hours per recipe, ~10 recipes = 20 hours)
- [ ] Kitchen interface: select menu + portions → auto-deduct
- [ ] Weekly reconciliation interface
- [ ] Reorder suggestion algorithm
- [ ] Barcode generation & scanning
- [ ] Test: 1 week trial with real kitchen data
- [ ] Deploy

**Sprint 2.3: Bank & Supplier Integration**
- [ ] Bank API setup (BRI sandbox)
- [ ] Reconciliation logic (match bank tx with pembukuan tx)
- [ ] Batch payment file generation
- [ ] Invoice auto-email setup
- [ ] Aging report dashboard
- [ ] Test: reconcile 1 month bank statement
- [ ] Deploy

**Sprint 2.4: Budget Forecasting**
- [ ] Historical data analysis
- [ ] Seasonality detection
- [ ] Budget suggestion algorithm
- [ ] Spend trend dashboard
- [ ] Test: forecast for April 2026
- [ ] Deploy

**Sprint 2.5: Integration Testing & Documentation**
- [ ] Full workflow testing
- [ ] Performance testing
- [ ] Documentation update
- [ ] Owner training (video + 1-on-1)

**Done Criteria:**
- MBG: Daily setup 5 min (instead of 15 min) (50% → 20% manual)
- Stock: Real-time tracking, no manual monthly count (75% → 40% manual)
- Keuangan: Bank reconciliation semi-auto (40% → 20% manual)
- Budget: Smart forecasting (50% → 20% manual)
- Overall effort: 15 hours/month → 6 hours/month

---

### Phase 3: Intelligence & Reporting (Month 5+)

- [ ] AI financial summary generation
- [ ] Anomaly detection rules
- [ ] Predictive forecasting
- [ ] Report export (PDF, Excel)
- [ ] Owner training
- [ ] Deploy

**Done Criteria:**
- Owner can generate full accounting report in 5 minutes
- Professional financial statements PDF auto-generated
- All insights & alerts available on dashboard
- Zero akuntan dependency ✅

---

## 📞 SUCCESS METRICS

### Measure After Phase 1 (Month 2):
- ✅ Time spent on pembukuan: reduced from X to X (target: 4 hours/week → 2 hours/week)
- ✅ Pembukuan accuracy: improved from 70% → 85%+
- ✅ Compliance participation: improved from 60% → 95%
- ✅ Payroll processing time: reduced to < 1 hour/month

### Measure After Phase 2 (Month 4):
- ✅ Total accounting time: < 3 hours/week (target met)
- ✅ Data quality: 90%+
- ✅ Cash flow visibility: real-time (vs monthly before)
- ✅ Stock accuracy: 95%+ (vs 70% before)

### Measure After Phase 3 (Month 5+):
- ✅ Can generate full financial report without akuntan
- ✅ Owner confidence level: "I understand my finances"
- ✅ Decision-making speed: improved (data-driven)
- ✅ Compliance: 100% hygiene/temp/sampel recording

---

## ⚠️ RISKS & MITIGATION

| Risk | Mitigation |
|------|-----------|
| Gemini API quota exceed | Monitor usage daily, setup alerts, fallback to rule-based |
| Bank API rate limit | Cache responses, batch requests during off-hours |
| FCM notification fail | Fallback to SMS/Email, test delivery daily |
| Data accuracy trash (GIGO) | Implement verification workflow, owner review > 10% sampling |
| Staff resistance (don't use) | Training session, make UI super simple, push notifications (push-based, not pull) |
| Over-engineering | Start with MVP (Gemini + notifications), add complexity later |

---

## 🎯 FINAL RECOMMENDATION

### **Start with Phase 1 (Foundation) - 2 months**

**Why:**
1. Highest ROI (pembukuan + payroll = 60% of owner pain)
2. Smallest scope (can finish in 2 months)
3. Quick win (owner see improvement immediately)
4. Foundation for Phase 2

### **Then Phase 2 (Integration) - 2 months**

**Why:**
1. Scales benefits (ecosystem becomes powerful)
2. Real-time data (banks + stock)
3. Daily operations easier (MBG + compliance)

### **Then Phase 3 (Intelligence) - 1 month if budget/time allows**

**Why:**
1. Transforms software into business partner
2. Owner can make smart decisions (not reactive)
3. Professional financial reporting

### **Don't skip automation for UI improvements**

The temptation will be to improve Karyawan HR features first. Resist this.

**Instead prioritize:** Getting the data in automatically (the hard part) vs displaying it nicely (the easy part).

---

## 📝 SUCCESS STORY (Projected)

```
BEFORE (Current 63% manual):
- Owner/akuntan: 6 hours/week = 24 hours/month = 288 hours/year
- Salary cost: Rp 42M/year
- Reports: Monthly (delayed 5 days)
- Data quality: 70%
- Decision-making: Reactive ("Why is this high?")

AFTER (Target 20% manual, fully automated):
- Owner time: 1.5 hours/week = 6 hours/month = 72 hours/year
- Salary cost: Rp 0 (no akuntan)
- Reports: Real-time (dashboard pull anytime)
- Data quality: 90%+
- Decision-making: Proactive ("Next month budget is tight, prepare alternatives")
- Additional branch: Can add branch 2 without hiring another akuntan (+Rp 42M savings)

Total annual benefit: Rp 84M/year (salary saved from not hiring akuntan for branch 2)
vs. Development cost: Rp 51.25M + Ops: Rp 8.52M = Rp 59.77M
= Net benefit Year 2+: Rp 24M+/year
```

---

**END OF AUTOMATION ROADMAP**

Document Version: 1.0  
Last Updated: 31 Maret 2026  
Prepared for: MBG Accounting System Automation Initiative
