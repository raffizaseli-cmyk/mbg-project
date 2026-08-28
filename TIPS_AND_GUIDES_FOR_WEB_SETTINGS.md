# 📚 APP USAGE TIPS & GUIDES - For Web Settings

**Purpose**: Complete usage guide organized by role and feature  
**Location**: Web Settings → Help & Tips  
**Format**: Can be rendered as collapsible sections in web UI  
**Last Updated**: April 20, 2026

---

## 📑 TABLE OF CONTENTS

1. [TIPS FOR AKUNTAN (Kasir)](#1-tips-for-akuntan--kasir)
2. [TIPS FOR ADMIN](#2-tips-for-admin)
3. [TIPS FOR OWNER](#3-tips-for-owner)
4. [TIPS FOR DRIVER](#4-tips-for-driver)
5. [TELEGRAM BOT GUIDE](#5-telegram-bot-guide)
6. [WEB DASHBOARD GUIDE](#6-web-dashboard-guide)
7. [INTEGRATION TIPS](#7-integration-tips)
8. [TROUBLESHOOTING](#8-troubleshooting)

---

# 1. TIPS FOR AKUNTAN (Kasir) 🧮

## Quick Start

**Role**: Kasir (Accounting/Finance Staff)  
**Main Tasks**: Input transactions, reconcile cash, manage payables  
**Tools Used**: 70% Telegram, 30% Web Dashboard  
**Time Commitment**: ~30 min per day

---

## ✨ Essential Tips for Daily Work

### Tip #1: Use Photo Receipt (Fastest Method)

**When**: Whenever you have a physical receipt/nota

**How**:
```
1. Open Telegram bot
2. Click [📷 Catat Nota] button
3. Take clear photos of receipts (max 5)
4. Click [✅ Selesai]
5. System auto-extracts items
6. Review & click [✅ Confirm]
```

**Why**: 
- ✅ **1-2 minutes** per transaction (vs 4-5 min manual)
- ✅ 98% accuracy with OCR
- ✅ Less typos
- ✅ Automatic ledger updates

**Pro Tips**:
- Take photos in good lighting
- Ensure receipt is flat & fully visible
- Stack multiple receipts per batch
- Photos auto-compress (don't worry about file size)

---

### Tip #2: Use Auto-Fill for Recurring Suppliers

**When**: Buying from same supplier multiple times

**How**:
```
1. Open Telegram → /belanja
2. Select supplier (suggestions show up!)
3. Bot shows: "Last items to [Supplier]:"
4. Click [✅ Use These] (auto-filled with quantities)
5. Select payment method
6. Confirm
```

**Why**:
- ✅ Save **2+ minutes** per transaction
- ✅ Prevents quantity mistakes
- ✅ Consistent data entry

**Example**:
```
Before: /belanja
"Ketik supplier, ketik items, ketik prices..."
(User has to type everything)

After: /belanja
"Toko Maju [selected]"
"Items: Beras 10kg, Minyak 5L, Gula 20kg [Pre-filled]"
"Confirm?" [✅]
(User just confirms in 2 clicks!)
```

---

### Tip #3: Morning Stock Check via Telegram

**When**: Start of each day

**How**:
```
Telegram auto-sends 7 AM alert:
"🔴 STOK RENDAH:
⚠️ Minyak: 2 L (min: 5 L)
   Will run out in 2 days
[📝 Input Belanja]"

Click [📝 Input Belanja] to auto-add to shopping list
```

**Why**:
- ✅ No need to manually check stok every morning
- ✅ Automatic alerts for low items
- ✅ One-click to plan restock

**Pro Tips**:
- Screenshot the alert if you need to track restock plan
- Discuss with Admin before ordering
- Note the "days until empty" for urgent items

---

### Tip #4: Payment Method Matters

**When**: Recording payment during transaction input

**Three Options**:
1. **💵 Tunai (Cash)**
   - Record immediately
   - Best for instant payments
   
2. **🏦 Transfer (Bank)**
   - Record in stok_ledger
   - Payment confirms separately
   
3. **📋 Hutang (Debt)**
   - Recorded as payable
   - Set due date
   - System reminds before due date

**Pro Tip**: 
- If unsure, ask Admin
- Payment method affects cash flow reporting
- Misclassification can skew budget analysis

---

### Tip #5: Reconciliation at End of Day

**When**: 5 PM daily (before leaving office)

**How**:
```
1. Open Web Dashboard
2. Go: Pembukuan → Reconciliation
3. Review all transactions for today
4. Check: Physical cash matches system?
5. If match → Click [✅ Approve Daily Report]
6. Generate PDF for archive
```

**Why**:
- ✅ Catch errors early
- ✅ Maintain audit trail
- ✅ Prevent cash discrepancies from piling up

**Pro Tips**:
- Do this EVERY day (not weekly)
- If discrepancy: note the exact amount
- Check: Did all Telegram transactions come through?
- Mark which transaction if it's wrong

**Example Checklist**:
```
□ Count physical cash
□ Open dashboard reconciliation
□ Check: All transactions listed?
□ Verify: Total cash IN matches?
□ Verify: Total cash OUT matches?
□ Discrepancy? <Rp 10K = OK, >Rp 10K = investigate
□ Click [Approve]
□ Download PDF backup
```

---

### Tip #6: Handle Payment Discrepancies

**When**: Physical cash ≠ System record

**Steps**:
```
1. Note exact discrepancy amount
2. Go to problematic transaction
3. Click [Edit] or [Query]
4. Add comment: "Cash short Rp 50K"
5. System suggests possible causes:
   - Missing transaction?
   - Wrong payment method?
   - Typo in amount?
6. Correct the record
7. Add note: "Corrected on 2026-04-20"
```

**Pro Tips**:
- Small discrepancies (<Rp 5K) can be absorbed
- Large ones must be investigated same day
- Always document what went wrong
- Don't delete - mark as corrected instead

---

## 📊 Sample Daily Workflow (Kasir)

```
7:00 AM - Receive stok alert
  └─ Review via Telegram
  └─ Plan restock if needed

9:00 AM - Supplier 1 arrives
  └─ Take 3 photos of receipt
  └─ Send to /catat-nota
  └─ Confirm OCR results (30 sec)
  └─ ✅ Transaction recorded

11:30 AM - Supplier 2 (repeat)
  └─ Supplier 2 arrives
  └─ Already did /belanja earlier?
  └─ Use /belanja → auto-fill → confirm (1 min)
  └─ ✅ Transaction recorded

2:00 PM - Delivery confirmation
  └─ Driver delivers to schools
  └─ Receive /serah confirmations via Telegram
  └─ System auto-updates stok
  └─ ✅ Deliveries confirmed

5:00 PM - Daily reconciliation
  └─ Open Web dashboard
  └─ Review all transactions
  └─ Physical cash count
  └─ Everything match? → [✅ Approve]
  └─ If discrepancy → [Query] → [Correct]
  └─ Generate daily report
  └─ ✅ Day complete!

Total time: ~30-40 minutes actual work
```

---

## ⚠️ Common Mistakes & How to Avoid

| Mistake | Problem | Fix |
|---------|---------|-----|
| Forget daily reconciliation | Cash discrepancies pile up | Do it EVERY day at 5 PM |
| Wrong payment method | Budget reporting broken | Ask Admin if unsure |
| Don't verify OCR result | Wrong items recorded | Always review confidence % |
| Type supplier name wrong | Duplicate suppliers | Use suggestions (don't type) |
| Forget to confirm delivery | Stok not updated | Confirm same day as delivery |

---

---

# 2. TIPS FOR ADMIN 📋

## Quick Start

**Role**: Admin (Operations Manager)  
**Main Tasks**: Monitor operations, approve transactions, manage deliveries, track budget  
**Tools Used**: 50% Telegram, 50% Web Dashboard  
**Time Commitment**: ~1 hour per day

---

## ✨ Essential Tips

### Tip #1: Morning Operations Review

**When**: 7:00-7:30 AM (start of day)

**Steps**:
```
1. Open Telegram → Receive morning alert:
   "🔴 STOK RENDAH:
   ⚠️ Minyak: 2L (min: 5L) - run out in 2 days
   ⚠️ Garam: 5kg (min: 10kg) - run out in 3 days"

2. Open Web Dashboard → [Dashboard Home]
   Check today's metrics:
   ├─ Stock status summary
   ├─ Budget used YTD
   ├─ Pending approvals
   └─ Scheduled deliveries

3. Action items:
   ├─ Low stok items → Plan restock
   ├─ Pending approvals → Review & approve/reject
   ├─ Today's deliveries → Coordinate with driver
```

**Pro Tips**:
- This takes 10-15 min
- Do it before team arrives
- Plan restock orders early in day

---

### Tip #2: Approve Transactions (Role Important!)

**When**: Large purchases or unusual amounts

**How**:
```
You receive Telegram notification:
"🔔 APPROVAL NEEDED
Transaksi #TRX-2026-0420-003
Supplier: Toko Besar
Amount: Rp 5,000,000
Reason: Exceeds approval threshold

[✅ Approve] [❌ Reject] [🔍 View Details]"

1. Click [🔍 View Details] to see full info
2. Verify: Is this expected/authorized?
3. If OK → Click [✅ Approve]
4. If issue → Click [❌ Reject] + add comment
```

**Why**: 
- Prevents unauthorized spending
- Controls budget adherence
- Maintains financial compliance

**Pro Tips**:
- Set clear approval thresholds with Owner
- Document rejections with reason
- Fast response (within 1 hour) helps kasir

---

### Tip #3: Monitor Stock & Plan Restock

**When**: Daily (during morning review + afternoon check)

**Web Dashboard → Stok Page**:
```
STATUS INDICATORS:
✅ GREEN: Above minimum (OK)
⚠️ YELLOW: Near minimum (order soon)
🔴 RED: Below minimum (urgent!)

COLUMNS:
├─ Product name
├─ Current qty
├─ Minimum qty
├─ Consumption rate (kg/day)
├─ Days until empty
└─ [Order Now] button

CLICK PRODUCT → See detailed history:
├─ Usage trend (30-day graph)
├─ Forecast chart
├─ Last supplier & price
├─ Suggested order qty
└─ [Quick Order] shortcut
```

**Pro Workflow**:
```
1. Scan the page for RED items
2. Click item → Check forecast
3. If "will run out in 2 days" → Urgent!
4. Click [Order Now] → Goes to Kasir workflow
5. Kasir inputs belanja via Telegram
6. You approve if needed
7. Supplier delivers → Driver confirms
8. Stok auto-updated
```

**Pro Tips**:
- Set minimum thresholds based on consumption
- Order when ⚠️ YELLOW appears (don't wait for 🔴)
- Keep history of which supplier is most reliable
- Note if prices changing (budget impact)

---

### Tip #4: Delivery Coordination

**When**: 1-4 PM (delivery hours)

**How**:
```
Driver starts deliveries:
Receives notification: "📦 5 schools scheduled today"

For EACH school:
1. Driver goes to school
2. Opens Telegram /serah
3. System shows: "Prediksi portions untuk Sekolah ABC:
   • Beras: 48.5 kg
   • Lauk: 65 kg
   • Sambal: 15 kg"
4. Driver confirms quantities delivered
5. Gets recipient signature
6. System records delivery

YOU (Admin):
├─ Receive real-time confirmation via Telegram
├─ Stok automatically updates
├─ Can see: Which schools done, which pending
├─ If issue → Can reach driver via Telegram
└─ Final count: All 5 schools delivered
```

**Pro Tips**:
- Predictive portions = less manual calculation
- Double-check portions if student count changed
- Proof photos help with disputes
- Mark delivery as done in system (for reporting)

---

### Tip #5: Daily Report Review

**When**: End of day (4-5 PM)

**Steps**:
```
1. Open Web Dashboard → Laporan
2. View today's summary:
   ├─ Cash in: Rp 1.5M (from belanja)
   ├─ Cash out: Rp 100K (delivery costs)
   ├─ Stok changes: Updated (from deliveries)
   ├─ Pending items: 0 (all processed)
   └─ Budget status: 77% used, on pace

3. Review yesterday's reconciliation
   ├─ Kasir approved? ✅
   ├─ Discrepancies? None
   ├─ PDF report generated? ✅

4. Flag any issues:
   ├─ One supplier late? → Note for next time
   ├─ Price spike? → Investigate with Owner
   ├─ Delivery failed? → Discuss with driver
```

**Pro Tips**:
- This is your "checkpoint" before Owner reviews
- Catch errors before Owner sees them
- Document issues for Owner briefing
- Weekly trend analysis (not daily)

---

## 📊 Sample Daily Workflow (Admin)

```
7:00 AM - Morning review (15 min)
  └─ Telegram stok alert
  └─ Web dashboard metrics
  └─ Plan for the day

8:00 AM - Team briefing
  └─ Tell Kasir what to order today
  └─ Tell Driver delivery schedule

10:00 AM - Spot check
  └─ Telegram notification: Kasir recorded transactions
  └─ Quick review of amounts
  └─ All look normal?

1:00 PM - Delivery coordination
  └─ Driver starts deliveries
  └─ Real-time monitoring via Telegram
  └─ Stok updating as deliveries confirm

4:00 PM - Mid-day report
  └─ Check Web for any issues
  └─ Follow up on pending approvals
  └─ Coordinate with Kasir on reconciliation

5:00 PM - Daily closeout
  └─ Review Kasir's reconciliation
  └─ Check daily report
  └─ Any issues? Address before day end
  └─ Briefing note for Owner

Total time: ~1 hour active, mostly monitoring
```

---

## ⚠️ Decision Points for Admin

| Situation | Action |
|-----------|--------|
| Stok RED (below min) | Order immediately |
| Stok YELLOW (near min) | Order next restock cycle |
| Price spike detected | Discuss with Owner |
| Delivery failed | Reschedule ASAP |
| Budget near limit | Alert Owner & limit new orders |
| Discrepancy in reconciliation | Don't approve, ask Kasir to investigate |
| Supplier late multiple times | Consider replacing supplier |

---

---

# 3. TIPS FOR OWNER 👤

## Quick Start

**Role**: Owner (Business Owner / CEO)  
**Main Tasks**: Strategic decisions, analytics, financial oversight, team management  
**Tools Used**: 95% Web Dashboard, 5% Telegram alerts  
**Time Commitment**: 30 min daily, 1-2 hours weekly analysis

---

## ✨ Essential Tips

### Tip #1: Dashboard Overview (Daily)

**When**: Start of day (7-8 AM)

**Steps**:
```
Open: app.example.com/dashboard

GLANCE AT:
1. Key Metrics Box (top of page):
   └─ Today's spending: Rp 1.2M
   └─ Stock status: 8✅ 2⚠️ 1🔴
   └─ Budget used: 77% of Rp 20M
   └─ Pending approvals: 3

2. Alert Section:
   └─ Low stok items needing restock
   └─ Budget nearing limit?
   └─ Delivery issues?
   └─ Any unusual transactions?

3. Recent activity feed:
   └─ Latest transactions
   └─ Any concerning patterns?
```

**Why**:
- Takes only 5 minutes
- Catches issues early
- Keeps finger on pulse of operations

---

### Tip #2: Weekly Spending Analysis

**When**: Friday afternoon (strategic review)

**Steps**:
```
1. Go: Web Dashboard → Laporan → Weekly Summary

2. Review spending by:
   ├─ Total: Rp 15.4M (vs budget: Rp 20M)
   ├─ By supplier:
   │  ├─ Toko Maju: Rp 6.2M (40%)
   │  ├─ Toko A: Rp 4.1M (27%)
   │  └─ Supplier XYZ: Rp 5.1M (33%)
   │
   ├─ By category:
   │  ├─ Ingredients: 60%
   │  ├─ Packaging: 20%
   │  └─ Operational: 20%
   │
   └─ Price trends:
      ├─ Beras: ↑ +4% (Rp 12K → 12.5K)
      ├─ Minyak: ↓ -1%
      └─ Gula: Stable

3. Decision points:
   ├─ Harga Beras naik 4% - consider alternatives?
   ├─ Toko Maju = 40% spending - diversify?
   ├─ Minyak harga turun - lock in supplier?
   ├─ Overall spending: 77% of budget - good pace
```

**Pro Tips**:
- Use trends to negotiate better prices
- Compare suppliers on price + reliability
- Document patterns for annual review

---

### Tip #3: Budget Tracking & Control

**When**: Weekly (as part of spending analysis)

**How**:
```
Web Dashboard → Budget Page

SHOWS:
├─ Total budget allocated: Rp 20M
├─ Spent YTD: Rp 15.4M (77%)
├─ Remaining: Rp 4.6M (23%)
├─ Trend line: On pace / Ahead / Behind
│
└─ By category breakdown:
   ├─ Ingredients: Rp 12M (80% of allocation)
   ├─ Packaging: Rp 2M (90%)
   ├─ Operational: Rp 1.4M (70%)

ALERTS:
🔴 Packaging is 90% spent (overage risk!)
🟡 Ingredients on track
🟢 Operational under budget
```

**Pro Tips**:
- Set alerts when category hits 80%
- If approaching limit: stop new orders
- Rebalance allocations quarterly
- Review if spending patterns change

---

### Tip #4: Supplier Performance Analysis

**When**: Monthly review

**Web Dashboard → Analytics → Suppliers**

```
METRICS:
For EACH supplier:
├─ Total spending
├─ Frequency (orders/week)
├─ Average order size
├─ Price stability
├─ Delivery reliability (%)
├─ Quality complaints (if any)
└─ Trend: Growing / Stable / Declining

EXAMPLE:
Toko Maju:
├─ Spending: Rp 6.2M/month (40% of total)
├─ Frequency: 3x/week
├─ Avg order: Rp 2.1M
├─ Price: Stable
├─ Delivery: 100% on-time
├─ Complaint: None
└─ Trend: ↑ Growing

DECISION:
- Top supplier, very reliable
- Negotiate volume discount (ordering 3x/week)
- Build long-term relationship
```

**Pro Tips**:
- Identify "problematic" suppliers (late deliveries, price issues)
- Reward good suppliers with loyalty
- Diversify: Not too dependent on 1 supplier
- Build backup suppliers for critical items

---

### Tip #5: Month-End Full Report

**When**: Last day of month

**Steps**:
```
1. Go: Laporan → Monthly Report

2. Review entire month:
   ├─ Total spending: Rp 62M
   ├─ Budget variance: Spent 77%, on pace
   ├─ Income vs expenses: Balanced?
   ├─ Payables status: Any overdues?
   ├─ Stock status: All items well-stocked?
   └─ Team performance: All roles working?

3. Generate PDF report:
   └─ Export to file
   └─ Share with board/donors if needed
   └─ Keep archive for records

4. Trend analysis:
   ├─ This month vs last month?
   ├─ Spending increasing or decreasing?
   ├─ Efficiency improving?
   └─ Any cost-saving opportunities?
```

**Pro Tips**:
- Monthly review = planning for next month
- Share with stakeholders (donors, board)
- Document decisions made
- Plan next month based on learnings

---

## 📊 Sample Weekly Workflow (Owner)

```
Monday - Brief check
  └─ Glance at dashboard (5 min)
  └─ Any red flags? All OK?

Tuesday-Thursday - Monitor
  └─ Telegram alerts if needed
  └─ Trust Admin to handle daily ops

Friday - Strategic review (1 hour)
  └─ Weekly spending analysis
  └─ Supplier performance
  └─ Budget tracking
  └─ Make decisions for next week

End of month - Full report
  └─ Monthly summary (30 min)
  └─ Trend analysis
  └─ Planning for next month
  └─ Team feedback session
```

---

## 🎯 Key Decisions Owner Makes

| Period | Decision | Based On |
|--------|----------|----------|
| Daily | Any red flags? | Dashboard glance |
| Weekly | Price negotiations | Weekly spending analysis |
| Weekly | Supplier changes | Supplier performance |
| Monthly | Budget adjustments | Budget vs actual |
| Monthly | Cost-saving initiatives | Trend analysis |
| Quarterly | Strategy alignment | Multi-month trends |

---

---

# 4. TIPS FOR DRIVER 🚚

## Quick Start

**Role**: Driver (Delivery Staff)  
**Main Tasks**: Confirm deliveries, deliver goods to schools, collect signatures  
**Tools Used**: 99% Telegram, 1% Web (just info)  
**Time Commitment**: 2-3 hours per day (delivery time, not app time)

---

## ✨ Essential Tips

### Tip #1: Delivery Preparation

**When**: Before leaving for deliveries (12-1 PM)

**Steps**:
```
1. Open Telegram → Check for notification:
   "📦 DELIVERY MANIFEST TODAY
   
   Schools to deliver:
   • Sekolah ABC (250 students)
   • Sekolah XYZ (180 students)
   • Sekolah DEF (200 students)
   • Sekolah GHI (150 students)
   • Sekolah JKL (120 students)
   
   Total: 5 schools
   Total items: 250 kg
   
   [View Details] [Start Delivery]"

2. Click [View Details] to see:
   ├─ Exact quantities for each school
   ├─ Contact person at each school
   ├─ Phone number for emergencies
   ├─ Delivery route/address
   └─ Special instructions (if any)

3. Preparation:
   └─ Confirm vehicle ready
   └─ Confirm goods loaded
   └─ Confirm delivery list printed (optional)
```

**Pro Tips**:
- Check manifest BEFORE loading vehicle
- Verify all items loaded per school
- Note any last-minute changes
- Have backup phone number for schools

---

### Tip #2: Delivery Confirmation (The Main Task!)

**When**: At each school (1-4 PM)

**Steps**:
```
1. Arrive at school

2. Open Telegram → /serah command

3. Bot shows:
   "📦 DELIVERY TO SEKOLAH ABC
   
   System predicted portions:
   • Beras: 48.5 kg (75g × 250 students @ 95% attendance)
   • Lauk: 65 kg (100g × students)
   • Sambal: 15 kg (50g × students)
   
   Quantities OK?
   [✅ Yes] [✏️ Edit] [📝 Manual Input]"

4. Review quantities:
   ├─ Does it look reasonable?
   ├─ Ask school staff: "Attendance today?"
   ├─ If different from prediction → Click [✏️ Edit]
   ├─ If OK → Click [✅ Yes]

5. Confirm delivery:
   Bot: "Siapa yang menerima? [Pick name from list]"
   └─ Select recipient name from dropdown
   
   Bot: "Ambil foto tanda terima? [Optional]"
   └─ Optional: Take photo as proof
   
   Bot: "Confirm delivered?"
   └─ Click [✅ Confirm]

6. System records:
   ├─ Delivery timestamp
   ├─ Recipient name
   ├─ Quantities delivered
   ├─ Proof photo (if taken)
   └─ School status: DELIVERED ✅

7. Bot: "Next school?"
   └─ Click [Next] or repeat step 2
```

**Pro Tips**:
- System calculates portions based on:
  - Student enrollment (from master data)
  - Attendance % (historical average)
  - Today's menu (if known)
- If discrepancy: TELL ADMIN immediately
- Proof photos help with disputes later
- Don't skip confirmation - ledger needs it

---

### Tip #3: Handle Special Cases

**Case 1: School not open / Closed**
```
Telegram → /serah
→ Select school
→ Bot: "School ABC not open?"
→ Click [❌ Cannot Deliver]
→ Add note: "School closed today, will deliver tomorrow"
→ Report to Admin via message
```

**Case 2: Different quantities requested**
```
Telegram → /serah
→ Bot shows predicted: 48.5 kg beras
→ Principal says: "Hari ini kami mau 50 kg saja"
→ Click [✏️ Edit qty]
→ Change: 48.5 → 50
→ Confirm delivery with new qty
→ System updates ledger correctly
```

**Case 3: Cannot find recipient**
```
Telegram → /serah
→ Bot asks: "Siapa yang menerima?"
→ You can't find named person
→ Click [Add Manual Name]
→ Type: "Ibu Siti (Kepala Sekolah)"
→ Confirm with that name
```

**Pro Tips**:
- Always communicate with Admin about changes
- Document unusual situations
- Take photos if there's a discrepancy
- Don't assume - ASK the school staff

---

### Tip #4: End of Delivery

**When**: After all schools delivered (4-5 PM)

**Steps**:
```
After confirming last school:

Telegram → /serah
→ Bot: "Delivery complete?"
→ Click [✅ All Done]

Bot shows summary:
"✅ DELIVERY COMPLETE!

Summary:
├─ 5 schools delivered
├─ 250 kg total distributed
├─ Time: 1:30 PM - 4:45 PM
├─ All schools: DELIVERED ✅
├─ No discrepancies

Deliveries Confirmed:
✅ Sekolah ABC: 48.5kg beras, 65kg lauk, 15kg sambal
✅ Sekolah XYZ: 34kg beras, 48kg lauk, 12kg sambal
✅ ...

[📊 View Receipt] [📝 Report Issue] [Done]"

3. If all OK:
   └─ Click [Done]
   └─ System finalizes ledgers
   └─ Notification sent to Admin/Owner

4. If issue found:
   └─ Click [📝 Report Issue]
   └─ Describe problem: "School ABC missing 5kg"
   └─ Add note: "Recipient name: Ibu Siti"
   └─ Admin investigates
```

**Pro Tips**:
- Always complete summary (don't skip)
- Report issues same day
- Keep delivery manifest for reference
- Document any unusual situations

---

## 📊 Sample Daily Workflow (Driver)

```
12:00 PM - Preparation
  └─ Check Telegram notification
  └─ Load vehicle
  └─ Verify all items

1:00 PM - Sekolah ABC
  └─ Arrive at school
  └─ Open /serah
  └─ Confirm portions
  └─ Verify recipient
  └─ Deliver goods
  └─ Get signature/photo
  └─ Confirm in system (30 sec)

2:00 PM - Sekolah XYZ
  └─ Repeat process (30 sec per school)

3:00 PM - Sekolah DEF
  └─ Repeat

4:00 PM - Sekolah GHI
  └─ Repeat

4:45 PM - Sekolah JKL
  └─ Last school, all deliveries done
  └─ Click [All Done]
  └─ System finalizes

5:00 PM - Return & Report
  └─ Return vehicle
  └─ Any issues? Message Admin
  └─ Done!

Total app time: ~3 minutes actual (5 schools × 30s)
Total delivery time: ~4 hours
```

---

## ⚠️ Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Can't find recipient at school | Ask principal/staff, add manual name |
| Quantities seem wrong | Ask school about enrollment/attendance |
| School closed | Report to Admin, deliver next day |
| Vehicle broke down | Message Admin immediately |
| Can't access Telegram in field | Use web link shared by Admin (backup) |
| Photo proof not uploading | Try again with better signal/smaller image |

---

---

# 5. TELEGRAM BOT GUIDE 📱

## Complete Telegram Commands Reference

### Available Commands

```
/start       - Start bot, login, show main menu
/menu        - Plan weekly menu for schools
/belanja     - Record purchase (manual input)
/serah       - Confirm delivery to school
/stok        - Quick stock check
/laporan     - Quick report view
/settings    - Preferences, language, notifications
/logout      - Disconnect from bot
/help        - Get help
```

### Main Menu Buttons (Visual)

```
┌─────────────────────────────────────┐
│        MAIN MENU (After Login)      │
├─────────────────────────────────────┤
│                                     │
│  📷 [Catat Nota]                   │
│     Take receipt photo → auto OCR   │
│                                     │
│  📝 [Input Belanja]                │
│     Manual transaction entry        │
│                                     │
│  📅 [Menu Minggu]                  │
│     Weekly menu planning            │
│                                     │
│  📦 [Serah Barang]                 │
│     Confirm delivery to schools     │
│                                     │
│  📊 [Lihat Stok]                   │
│     Quick stock check               │
│                                     │
│  💰 [Laporan]                      │
│     Quick report view               │
│                                     │
│  ⚙️ [Pengaturan/Settings]          │
│     Change preferences              │
│                                     │
│  [❓ Bantuan/Help]                 │
│     Get documentation               │
│                                     │
└─────────────────────────────────────┘
```

---

## Photo Receipt Workflow (Best for Speed)

```
/catat-nota or [📷 Catat Nota] button

STEP 1: Bot sends instructions
STEP 2: User sends 1-5 photos
STEP 3: Each photo compressed & batched
STEP 4: After 5 or user click [Selesai]:
        ├─ Upload to storage
        ├─ Trigger OCR job
        ├─ Extract items (Gemini Vision)
        ├─ Match to products
        └─ Show results

STEP 5: Results notification:
        "✅ OCR Selesai!
        Items: [list with confidence %]
        Total: [amount]
        [✅ Confirm] [✏️ Edit] [❌ Cancel]"

STEP 6: User confirms
        └─ Transaksi recorded & ledgers updated

RESULT: ✅ Transaction complete in 1-2 minutes!
```

---

## Manual Entry Workflow (Backup)

```
/belanja or [📝 Input Belanja]

STATE 0: SELECT SUPPLIER
  Bot shows suggestions from history
  User picks one (or types new)

STATE 1: SELECT ITEMS
  Bot shows last items to that supplier
  User confirms (auto-filled) or edits

STATE 2: PAYMENT METHOD
  Bot shows: Tunai / Transfer / Hutang
  User picks one
  
  If hutang: Bot asks for due date

STATE 3: FINAL CONFIRMATION
  Bot shows summary
  User confirms
  
RESULT: Transaction recorded
```

---

## Menu Planning Workflow

```
/menu or [📅 Menu Minggu]

SHOWS: Grid of week with status
USER: Clicks a day

BOT: "Masukkan menu untuk [hari]"
USER: Ketik menu name

BOT: Validates menu
     If exists: Auto-links BOM
     If new: Creates placeholder, asks for BOM

USER: Confirms BOM or enters new items

RESULT: Menu saved with BOM linked
```

---

## Delivery Confirmation Workflow

```
/serah or [📦 Serah Barang]

SYSTEM: Calculates expected portions per school
        (Based on enrollment × attendance × menu)

DRIVER: Reviews, edits if needed

FOR EACH SCHOOL:
├─ Confirm portions delivered
├─ Record recipient name
├─ Optional: Take proof photo
└─ Click confirm

RESULT: Delivery recorded, stok auto-updated
```

---

## Telegram Pro Tips

### Tip #1: Use Buttons (Don't Type)
✅ **DO**: Click [Toko Maju] button
❌ **DON'T**: Type "Toko Maju" manually
- Buttons = instant, no typos
- Typing = slow, error-prone

### Tip #2: Use Suggestions
✅ **DO**: Click supplier from suggestion list
❌ **DON'T**: Search for supplier manually
- Suggestions are sorted by frequency
- Most recent suppliers appear first

### Tip #3: Verify OCR Results
✅ **DO**: Review confidence % for each item
❌ **DON'T**: Blindly confirm all items
- Low confidence items may be wrong
- Edit before confirming if needed

### Tip #4: Check Notifications
✅ **DO**: Enable Telegram notifications
❌ **DON'T**: Disable and check manually
- Alerts keep you informed
- Real-time alerts = faster response

### Tip #5: Use Telegram Offline Mode
✅ **DO**: Take screenshots of important info
❌ **DON'T**: Rely on internet being always on
- Save receipts as photos
- Backup critical messages

---

---

# 6. WEB DASHBOARD GUIDE 💻

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Web App)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LEFT SIDEBAR (Navigation Menu)                                │
│  ├─ 🏠 Dashboard                                               │
│  ├─ 📋 Pembukuan (Transactions)                               │
│  ├─ 💰 Hutang-Piutang (Payables/Receivables)                 │
│  ├─ 📦 Stok (Inventory)                                        │
│  ├─ 💹 Track Harga (Price Tracking)                            │
│  ├─ 📈 Laporan (Reports)                                       │
│  ├─ ⚙️ Settings                                                │
│  └─ 📚 Help & Tips (THIS DOCUMENT!)                           │
│                                                                  │
│  MAIN CONTENT AREA                                             │
│  ├─ Breadcrumb navigation                                      │
│  ├─ Page title & description                                   │
│  ├─ Content (varies by page)                                   │
│  └─ Action buttons                                             │
│                                                                  │
│  TOP RIGHT (User Info)                                         │
│  ├─ User name                                                  │
│  ├─ 🔔 Notification bell                                       │
│  ├─ ⚙️ Settings shortcut                                       │
│  └─ 🚪 Logout                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Pages Overview

### 1. Dashboard (Home Page)

**What It Shows**:
```
📊 KEY METRICS (Top cards)
├─ Today's Spending: Rp 1,250,000
├─ Stock Status: 8✅ 2⚠️ 1🔴
├─ Budget Used: 77% (Rp 15.4M/20M)
└─ Pending Approvals: 3

📈 CHARTS
├─ Daily Spending (line chart, last 7 days)
├─ Stock Levels (bar chart, vs minimum)
├─ Budget Allocation (pie chart, by category)
└─ Spending Trend (area chart, last 30 days)

🔴 ALERTS & NOTIFICATIONS
├─ Low stock items
├─ Budget warnings
├─ Pending approvals
└─ Recent activity feed

📋 RECENT TRANSACTIONS
├─ Latest 5-10 transactions
├─ Status indicators
└─ Quick link to details
```

**Pro Tips**:
- Bookmark this page (first thing you open)
- Charts are interactive - hover for details
- Click any metric to drill down
- Refresh button for live data

---

### 2. Pembukuan (Bookkeeping/Transactions)

**What It Shows**:
```
TABLE VIEW - All transactions
├─ Date | Supplier | Amount | Payment Method | Status | Actions
├─ Searchable & filterable by:
│  ├─ Date range
│  ├─ Supplier
│  ├─ Amount range
│  └─ Status (confirmed, pending, etc)
│
├─ Click row → View full details:
│  ├─ Line items (what was purchased)
│  ├─ Photos (if from /catat-nota)
│  ├─ Payment details
│  ├─ Ledger impact
│  └─ [Edit] [Delete] buttons
│
└─ BULK ACTIONS:
   ├─ Select multiple → Bulk export
   ├─ Select multiple → Bulk approve
   └─ Select multiple → Bulk recategorize
```

**Pro Tips**:
- Filter by "pending" to see what needs approval
- Use date range for weekly reviews
- Click on supplier name to see all their transactions
- Edit before reconciliation (harder to edit after)

---

### 3. Hutang-Piutang (Payables & Receivables)

**What It Shows**:
```
TWO TABS: SUPPLIERS (We owe) | CUSTOMERS (Owe us)

SUPPLIERS TAB:
├─ Supplier name
├─ Total owed
├─ Due date
├─ Status (on time / overdue)
├─ [Pay] button
└─ [Details] link

FILTERING:
├─ Show all / Show overdue only
├─ Sort by: Due date / Amount
└─ Group by supplier or payment status

CLICK SUPPLIER → DETAILS:
├─ List of all outstanding debts
├─ Payment history
├─ Terms (e.g., net 30 days)
└─ [Mark Paid] button
```

**Pro Tips**:
- Review weekly to catch overdues
- Plan cash flow based on due dates
- Use [Payment Schedule] to export
- Set payment reminders in calendar

---

### 4. Stok (Inventory Management)

**What It Shows**:
```
TABLE VIEW - All products
├─ Product name
├─ Current quantity
├─ Unit (kg, liter, pcs)
├─ Minimum qty
├─ Status:
│  ├─ ✅ GREEN (above minimum)
│  ├─ ⚠️ YELLOW (near minimum)
│  └─ 🔴 RED (below minimum)
├─ Days until empty (forecast)
└─ [Order] [Details] buttons

CLICK PRODUCT → DETAILS VIEW:
├─ Stock movement history (in/out)
├─ 30-day consumption graph
├─ Forecast: when will run out?
├─ Last supplier & price
├─ Suggested order quantity
├─ [Quick Order] shortcut
└─ [Adjust Qty Manually] if needed
```

**Pro Tips**:
- Prioritize RED items (order immediately)
- Order when YELLOW (before runs out)
- Study consumption graph for patterns
- Adjust minimum thresholds if needed

---

### 5. Track Harga (Price Tracking)

**What It Shows**:
```
CHART VIEW - Historical price per product

FOR EACH PRODUCT:
├─ Line chart showing price over time
├─ Supplier comparison (if bought from multiple)
├─ Alerts if price spikes detected
├─ Trend: ↑ up, ↓ down, → stable
└─ [View Details] [Export] buttons

DETAILS:
├─ Transaction-by-transaction history
├─ Supplier comparison (this item, which supplier cheapest?)
├─ Price statistics (min/max/average)
└─ Recommendations (switch supplier if cheaper?)
```

**Pro Tips**:
- Use for supplier negotiations
- Identify best time to buy (when price low)
- Lock in price if trending up
- Find cheaper alternatives

---

### 6. Laporan (Reports)

**What It Shows**:
```
Multiple report options:

DAILY SUMMARY:
├─ Today's cash in/out
├─ Stock changes
├─ Transactions count
└─ Quick overview

WEEKLY SUMMARY:
├─ Spending by supplier
├─ Spending by category
├─ Price trends
├─ Delivery performance
└─ Budget vs actual

MONTHLY SUMMARY:
├─ Complete month overview
├─ Budget variance analysis
├─ Supplier performance
├─ Year-to-date totals
└─ Trend analysis

CUSTOM REPORTS:
├─ Date range picker
├─ Filter options
├─ Format: PDF / Excel / CSV
└─ Scheduled export (automatic)
```

**Pro Tips**:
- Export as PDF for external sharing
- Excel format for custom analysis
- Schedule weekly/monthly auto-export
- Keep archive of all reports

---

### 7. Settings

**What It Shows**:
```
MULTIPLE TABS:

GENERAL SETTINGS:
├─ Business name
├─ Currency (IDR)
├─ Time zone
├─ Financial year start
└─ Language

MASTER DATA:
├─ Suppliers [CRUD]
├─ Products [CRUD]
├─ Schools [CRUD]
├─ Bulk Import (CSV)
└─ Data Export

TEAM & ROLES:
├─ Team members
├─ Assign roles
├─ Permissions matrix
└─ [Invite] [Remove]

NOTIFICATIONS:
├─ Email notifications
├─ Telegram alerts
├─ Approval thresholds
└─ Alert frequency

INTEGRATIONS:
├─ Telegram bot link
├─ API keys
├─ Webhook settings
└─ External services

HELP & TIPS:
├─ User guides (THIS!)
├─ Video tutorials
├─ FAQ
└─ Contact support
```

---

## Web Dashboard Pro Tips

### Tip #1: Bookmarks
- Bookmark /dashboard (home)
- Bookmark /pembukuan (daily work)
- Bookmark /laporan (reporting)

### Tip #2: Keyboard Shortcuts
- Ctrl+S = Search page
- Ctrl+E = Export
- Ctrl+P = Print

### Tip #3: Data Filtering
- Use multiple filters together
- Save filter views as "favorites"
- Date range shortcuts: Today / This Week / This Month

### Tip #4: Export Data
- Most pages have [Export] button
- Format: PDF (nice looking) or Excel (editable)
- Excel useful for custom pivot tables

### Tip #5: Mobile Responsive
- Works on tablets (landscape)
- Mobile: Sidebar collapses to hamburger menu
- Telegram better for mobile field work

---

---

# 7. INTEGRATION TIPS 🔗

## Real-time Sync Between Telegram & Web

### How It Works

```
SCENARIO: Kasir creates transaction via Telegram

1. Kasir: /catat-nota (takes photos)
   └─ Backend processes → DB updates

2. Database: Transaction record created
   └─ Fires webhook/WebSocket event

3. Web Dashboard: Listening for updates
   └─ Receives real-time notification
   └─ Auto-refreshes relevant pages:
      ├─ Pembukuan (new transaction visible)
      ├─ Stok (quantities updated)
      ├─ Dashboard (metrics updated)
      └─ Budget (allocation adjusted)

4. Web Users: See update immediately
   └─ No manual refresh needed!
   └─ Live collaboration

⏱️ LATENCY: <1 second from Telegram to Web visible!
```

### What Updates Automatically

```
When Kasir records transaction via TELEGRAM:

AUTO-UPDATES ON WEB:
✅ Pembukuan page (new row appears)
✅ Stok page (quantities changed)
✅ Dashboard metrics (spending updated)
✅ Budget page (allocation changed)
✅ Recent activity feed (transaction logged)

Manual refreshes NOT needed!
All users see same data in real-time.
```

### Push Notifications (Web → Telegram)

```
SCENARIO: Transaction needs approval

1. Kasir: Creates large transaction via Telegram
   Amount: Rp 5,000,000 (exceeds threshold)
   Status: Pending Approval

2. Backend: Transaction created, fires event
   └─ Approval required (amount > threshold)

3. Admin: Receives Telegram notification
   "🔔 APPROVAL NEEDED
   TRX-2026-0420-003
   Amount: Rp 5,000,000
   
   [✅ Approve] [❌ Reject] [🔍 View Details]"

4. Admin: Clicks [✅ Approve] in Telegram
   └─ Backend processes approval
   └─ Status: Confirmed

5. Updates cascade:
   ├─ Telegram notification to Kasir: "✅ Approved!"
   ├─ Web updates: Status = Confirmed
   ├─ Ledgers finalized
   └─ All users see final state

RESULT: Seamless approval workflow!
```

---

## Data Consistency Tips

### Tip #1: Single Source of Truth
- All data lives in Supabase
- Telegram & Web both read/write same DB
- No duplicate data = no conflicts

### Tip #2: Role-Based Access
- Different users see different data based on role
- Kasir: Only transactions they create (+ summaries)
- Admin: All operations data
- Owner: Everything + analytics
- Driver: Only deliveries

### Tip #3: Offline Mode (Telegram)
- Telegram works better offline than Web
- Good for field work (delivery confirmation)
- Can queue messages if no signal
- Syncs when connectivity returns

### Tip #4: Audit Trail
- Every change logged with timestamp & user
- Can see who did what when
- Important for compliance
- Check: Dashboard → Activity Log

---

---

# 8. TROUBLESHOOTING 🔧

## Common Issues & Solutions

### Issue #1: "OCR Failed"

**Problem**: Photo receipt OCR didn't extract items correctly

**Solutions**:
```
1. Try again with better photo:
   ✅ Good lighting
   ✅ Receipt flat & in focus
   ✅ All text visible
   ❌ Blurry photos fail

2. If OCR still fails:
   └─ Use manual /belanja instead
   └─ Faster than trying OCR multiple times

3. Report to Admin if photos are clear:
   └─ Possible Gemini API issue
   └─ Admin can manually create transaction
```

---

### Issue #2: "Photo Upload Stuck"

**Problem**: Photo won't upload to Telegram

**Solutions**:
```
1. Check internet connection:
   └─ Close other apps using bandwidth
   └─ Try WiFi instead of mobile data
   └─ Move closer to router

2. Try smaller image:
   └─ Bot auto-compresses, but try:
      ├─ Take photo in low resolution
      ├─ Or re-take multiple times
      └─ One might upload

3. If still stuck:
   └─ Restart Telegram app
   └─ Clear app cache
   └─ Try again
```

---

### Issue #3: "Stok Quantity Wrong"

**Problem**: System shows wrong stock quantity

**Solutions**:
```
1. Check recent deliveries:
   └─ Did all /serah confirmations complete?
   └─ If not: manually confirm in web

2. Check recent transactions:
   └─ Was transaction recorded twice?
   └─ Contact Admin to delete duplicate

3. If still wrong:
   └─ Click [Adjust] in Stok page
   └─ Manually correct quantity
   └─ Add note: "Physical count: 50kg on 2026-04-20"
   └─ Admin can review and approve
```

---

### Issue #4: "Can't Find Transaction"

**Problem**: Can't find a transaction I created

**Solutions**:
```
1. Use Pembukuan search:
   └─ Go: Web → Pembukuan
   └─ Filter by date range
   └─ Filter by supplier
   └─ Use full-text search

2. If still can't find:
   └─ Check if it was saved:
   │  ├─ Did you click [✅ Confirm]?
   │  ├─ Or [✅ OK]?
   │  └─ Or did you click [❌ Cancel]?
   │
   └─ Check Telegram:
      └─ Did bot send "✅ Saved!" confirmation?

3. If still missing:
   └─ Contact Admin
   └─ Provide date/supplier/amount
   └─ They can search database
```

---

### Issue #5: "Payment Method Wrong"

**Problem**: Recorded as "Hutang" but should be "Tunai"

**Solutions**:
```
1. If recorded recently:
   └─ Go: Pembukuan → Find transaction
   └─ Click [Edit]
   └─ Change payment method
   └─ Save

2. If approved/locked:
   └─ Contact Admin
   └─ Ask Admin to unlock & edit
   └─ Or create new correction transaction
```

---

### Issue #6: "Budget Overage Alert"

**Problem**: Budget nearing or exceeded limit

**Solutions**:
```
1. Review spending:
   └─ Go: Web Dashboard → Budget page
   └─ See breakdown by category
   └─ Which category is over?

2. Analyze options:
   ├─ Reduce spending (negotiate lower prices)
   ├─ Reallocate budget (move from under to over category)
   ├─ Request increase (if justified)
   └─ Cut non-essential items

3. Communicate with Owner:
   └─ Send budget alert report
   └─ Provide analysis
   └─ Recommend action
   └─ Wait for approval
```

---

### Issue #7: "Telegram Bot Not Responding"

**Problem**: Bot doesn't reply to commands

**Solutions**:
```
1. Check your connection:
   └─ Internet working?
   └─ Try other Telegram functions first
   └─ Maybe global Telegram issue?

2. Re-authenticate:
   └─ /logout
   └─ /start
   └─ Re-login with credentials

3. Clear cache:
   └─ Close Telegram completely
   └─ Clear app cache (Settings → Apps → Telegram)
   └─ Re-open and try again

4. If still broken:
   └─ Contact Admin
   └─ Provide screenshot of error
   └─ Provide timestamp of issue
   └─ Admin contacts technical support
```

---

### Issue #8: "Web Dashboard Won't Load"

**Problem**: Page stuck loading or blank

**Solutions**:
```
1. Check connection:
   └─ Test other websites first
   └─ WiFi working?
   └─ Try mobile data

2. Clear cache:
   └─ Browser Settings → Clear Cache/Cookies
   └─ Close all tabs
   └─ Re-open app.example.com

3. Try different browser:
   └─ Chrome
   └─ Firefox
   └─ Safari
   └─ Edge

4. If still broken:
   └─ Contact Admin
   └─ Provide screenshot
   └─ Try from different device
```

---

### Issue #9: "Permission Denied"

**Problem**: Trying to view/edit data but access denied

**Solutions**:
```
1. Check your role:
   └─ Owner = Full access
   └─ Admin = Operations only
   └─ Kasir = Transactions only
   └─ Driver = Deliveries only

2. If role seems wrong:
   └─ Contact Owner
   └─ Ask to update permissions
   └─ Owner goes: Settings → Team Members → [Edit Role]

3. Examples:
   └─ Kasir trying to view Budget? → Denied (not allowed)
   └─ Driver trying to create transaction? → Denied (only delivery)
   └─ Admin trying to view confidential settings? → Denied (owner only)
```

---

### Issue #10: "Data Discrepancy"

**Problem**: Telegram says one amount, Web shows different

**Solutions**:
```
1. Wait for sync:
   └─ Real-time sync usually <1 second
   └─ But sometimes delayed
   └─ Refresh page (F5)
   └─ Check again

2. If still different:
   └─ Go: Pembukuan
   └─ Find the transaction
   └─ Check transaction details:
      ├─ Items listed
      ├─ Quantities
      ├─ Prices
      └─ Total calculated
   └─ Any discrepancy in calculation?

3. If math is wrong:
   └─ Contact Admin
   └─ Provide evidence (screenshot)
   └─ Admin investigates
   └─ Correction made if needed
```

---

## Quick Support Flowchart

```
PROBLEM?
  ↓
Step 1: Check basics
  ├─ Internet working? → Yes → Step 2
  └─ No → Fix connection → Retry

Step 2: Try the recommended solution
  ├─ Works? → ✅ Solved!
  └─ Doesn't work → Step 3

Step 3: Try alternative solution
  ├─ Works? → ✅ Solved!
  └─ Doesn't work → Step 4

Step 4: Contact Admin/Support
  ├─ Describe problem clearly
  ├─ Provide screenshots
  ├─ Provide timestamp
  ├─ Provide context (what were you doing?)
  └─ Wait for response
```

---

## When to Contact Support

📧 **Contact Admin When**:
- Issue not resolved by troubleshooting
- Unusual/unexpected behavior
- Data seems wrong/corrupted
- Permission issues
- Feature not working

📧 **Contact Owner When**:
- Budget/financial decisions needed
- Supplier changes
- Policy changes
- Major system changes

📞 **EMERGENCY Contact** (if system down):
- Try web dashboard if Telegram down
- Try Telegram if web down
- Call/message Admin directly

---

---

# 📞 SUPPORT & ADDITIONAL RESOURCES

## Where to Find Help

| Topic | Location |
|-------|----------|
| This Tips Document | Web → Settings → Help & Tips |
| Video Tutorials | Web → Settings → Video Guides |
| FAQ | Web → Settings → FAQ |
| Contact Support | Web → Settings → Contact |
| Report Bug | Web → Settings → Report Issue |
| Feature Request | Web → Settings → Suggest Feature |

---

## Quick Reference Card (Print This!)

```
┌─────────────────────────────────────────────────┐
│         QUICK REFERENCE CARD                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ FOR FASTEST INPUT:                              │
│ → /catat-nota (photo receipt)                  │
│   Takes 1-2 min, most accurate                 │
│                                                 │
│ IF NO RECEIPT:                                  │
│ → /belanja (manual input)                      │
│   Uses auto-fill, takes 1-2 min                │
│                                                 │
│ FOR DELIVERY:                                   │
│ → /serah (confirm portions)                    │
│   Takes 30 sec per school                      │
│                                                 │
│ FOR RECONCILIATION:                             │
│ → Web Dashboard → Pembukuan                    │
│   Daily 5 PM, takes 5-10 min                   │
│                                                 │
│ FOR REPORTS:                                    │
│ → Web Dashboard → Laporan                      │
│   Weekly/monthly analysis                      │
│                                                 │
│ FOR QUESTIONS:                                  │
│ → Web Settings → Help & Tips (you're here!)   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Document Info

**Created**: April 20, 2026  
**Version**: 1.0  
**Purpose**: Complete guide for Web Settings → Help & Tips  
**Audience**: All users (Owner, Admin, Kasir, Driver)  
**Format**: Markdown (renders in web UI)  

---

**TIPS & TRICKS COMPLETE! 🎉**

For more detailed information, see:
- COMPLETE_WORKFLOW_INTEGRATION.md
- USER_WORKFLOWS.md
- TELEGRAM_FEATURES_ANALYSIS.md
