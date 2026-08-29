"""
backend/routers/reports.py
Endpoints laporan/dashboard — Modul 11

GET /reports/daily        → ringkasan hari ini
GET /reports/monthly      → laporan bulan ini
GET /reports/stock        → status stok semua produk
GET /reports/receivables  → piutang ke pemerintah
GET /reports/payables     → hutang ke supplier
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.user import UserInDB

router = APIRouter(prefix="/reports", tags=["reports"])

BULAN = {
    1: "Januari", 2: "Februari", 3: "Maret",     4: "April",
    5: "Mei",     6: "Juni",     7: "Juli",        8: "Agustus",
    9: "September", 10: "Oktober", 11: "November", 12: "Desember",
}


def _d(v, default=Decimal("0")) -> Decimal:
    try:
        return Decimal(str(v or 0))
    except Exception:
        return default


# ─── GET /reports/daily ───────────────────────────────────────────────────────

@router.get("/daily", response_model=Dict[str, Any])
def get_daily_report(
    date_param: str = Query(default=None, alias="date"),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ringkasan hari ini: MBG, belanja, arus kas, stok alert."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    try:
        target = date.fromisoformat(date_param) if date_param else date.today()
    except ValueError:
        raise HTTPException(422, detail="Format date harus YYYY-MM-DD")

    date_str = target.isoformat()
    dow = target.weekday() + 1
    ws = target - timedelta(days=target.weekday())

    def fetch_alloc():
        return (
            supabase.table("mbg_budget_allocations")
            .select("total_portions, total_revenue, budget_bahan, budget_ops, budget_insentif")
            .eq("tenant_id", tid)
            .eq("date", date_str)
            .limit(1)
            .execute()
        )

    def fetch_del():
        return (
            supabase.table("mbg_deliveries")
            .select("id, school_id, portions_sent")
            .eq("tenant_id", tid)
            .eq("delivery_date", date_str)
            .execute()
        )

    def fetch_menu():
        return (
            supabase.table("mbg_weekly_menus")
            .select("menu_name")
            .eq("tenant_id", tid)
            .eq("week_start", ws.isoformat())
            .eq("day_of_week", dow)
            .limit(1)
            .execute()
        )

    def fetch_exp():
        return (
            supabase.table("transactions")
            .select("id, total, suppliers(name)")
            .eq("tenant_id", tid)
            .eq("date", date_str)
            .eq("type", "expense")
            .eq("status", "confirmed")
            .execute()
        )

    def fetch_cf():
        return (
            supabase.table("cashflow_log")
            .select("flow_type, amount")
            .eq("tenant_id", tid)
            .eq("date", date_str)
            .execute()
        )

    def fetch_prod():
        return (
            supabase.table("products")
            .select("name, stock_qty, stock_min, unit, conversion_factor, display_unit")
            .eq("tenant_id", tid)
            .eq("is_active", True)
            .execute()
        )

    with ThreadPoolExecutor(max_workers=6) as executor:
        fut_alloc = executor.submit(fetch_alloc)
        fut_del = executor.submit(fetch_del)
        fut_menu = executor.submit(fetch_menu)
        fut_exp = executor.submit(fetch_exp)
        fut_cf = executor.submit(fetch_cf)
        fut_prod = executor.submit(fetch_prod)

        alloc_resp = fut_alloc.result()
        del_resp = fut_del.result()
        menu_resp = fut_menu.result()
        exp_resp = fut_exp.result()
        cf_resp = fut_cf.result()
        prod_resp = fut_prod.result()

    alloc_rows = getattr(alloc_resp, "data", None) or []
    alloc = alloc_rows[0] if alloc_rows else None

    deliveries = getattr(del_resp, "data", None) or []

    menu_rows = getattr(menu_resp, "data", None) or []
    menu_name = (menu_rows[0] if menu_rows else {}).get("menu_name")

    has_delivery = bool(deliveries)
    mbg = {
        "total_portions": (alloc or {}).get("total_portions", 0),
        "total_schools": len(deliveries),
        "menu_name": menu_name,
        "revenue_gross": str(_d((alloc or {}).get("total_revenue"))),
        "budget_bahan": str(_d((alloc or {}).get("budget_bahan"))),
        "budget_ops": str(_d((alloc or {}).get("budget_ops"))),
        "budget_insentif": str(_d((alloc or {}).get("budget_insentif"))),
        "has_delivery": has_delivery,
    }

    # ─── Expenses: transaksi hari ini ────────────────────────────────
    exp_rows = getattr(exp_resp, "data", None) or []
    exp_total = sum(_d(r.get("total")) for r in exp_rows)

    # Group by supplier
    sup_map: Dict[str, dict] = {}
    for r in exp_rows:
        name = (r.get("suppliers") or {}).get("name") or "Tanpa Supplier"
        if name not in sup_map:
            sup_map[name] = {"supplier_name": name, "total": Decimal("0"), "count": 0}
        sup_map[name]["total"] += _d(r.get("total"))
        sup_map[name]["count"] += 1

    by_supplier = [
        {**v, "total": str(v["total"])}
        for v in sorted(sup_map.values(), key=lambda x: x["total"], reverse=True)
    ]

    expenses = {
        "total": str(exp_total),
        "count": len(exp_rows),
        "by_supplier": by_supplier,
    }

    # ─── Cashflow ─────────────────────────────────────────────────────
    cf_rows = getattr(cf_resp, "data", None) or []
    income  = sum(_d(r["amount"]) for r in cf_rows if r.get("flow_type") == "in")
    outcome = sum(_d(r["amount"]) for r in cf_rows if r.get("flow_type") == "out")

    cashflow = {
        "income": str(income),
        "outcome": str(outcome),
        "net": str(income - outcome),
    }

    # ─── Stock alerts ─────────────────────────────────────────────────
    prod_rows = getattr(prod_resp, "data", None) or []
    stock_alerts = []
    for p in prod_rows:
        stk = _d(p.get("stock_qty") or 0)
        stk_min = _d(p.get("stock_min") or 0)
        if stk < stk_min:
            factor = float(p.get("conversion_factor") or 1)
            unit_disp = p.get("display_unit") or p.get("unit") or ""
            
            stk_disp = float(stk / Decimal(str(factor))) if factor else float(stk)
            min_disp = float(stk_min / Decimal(str(factor))) if factor else float(stk_min)
            deficit_disp = float(max(min_disp - stk_disp, 0.0))
            
            stock_alerts.append({
                "product_name": p["name"],
                "stock_qty": stk_disp,
                "stock_min": min_disp,
                "unit": unit_disp,
                "deficit": deficit_disp,
            })

    return {
        "success": True,
        "data": {
            "date": date_str,
            "mbg": mbg,
            "expenses": expenses,
            "stock_alerts": stock_alerts,
            "cashflow": cashflow,
        },
    }


# ─── GET /reports/monthly ─────────────────────────────────────────────────────

@router.get("/monthly", response_model=Dict[str, Any])
def get_monthly_report(
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Laporan bulan: MBG, pengeluaran, profit estimate, stok, status Excel."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    today = date.today()
    y = year or today.year
    m = month or today.month

    # Rentang bulan
    first = date(y, m, 1)
    if m == 12:
        last = date(y + 1, 1, 1) - timedelta(days=1)
    else:
        last = date(y, m + 1, 1) - timedelta(days=1)

    first_iso = first.isoformat()
    last_iso = last.isoformat()
    period_label = f"{BULAN[m]} {y}"
    period_key = f"{y:04d}-{m:02d}"

    def fetch_settings():
        return (
            supabase.table("mbg_allocation_settings")
            .select("bahan_sd_smp, bahan_paud_tk, ops_per_porsi, insentif_harian")
            .eq("tenant_id", tid)
            .limit(1)
            .execute()
        )

    def fetch_deliveries():
        return (
            supabase.table("mbg_deliveries")
            .select("portions_sent, delivery_date, menu_name, schools(name, school_level)")
            .eq("tenant_id", tid)
            .gte("delivery_date", first_iso)
            .lte("delivery_date", last_iso)
            .execute()
        )

    def fetch_expenses():
        return (
            supabase.table("transactions")
            .select("id, total, suppliers(name)")
            .eq("tenant_id", tid)
            .eq("type", "expense")
            .eq("status", "confirmed")
            .gte("date", first_iso)
            .lte("date", last_iso)
            .execute()
        )

    def fetch_payables():
        return (
            supabase.table("payables")
            .select("amount")
            .eq("tenant_id", tid)
            .eq("status", "unpaid")
            .execute()
        )

    def fetch_ops():
        return (
            supabase.table("operational_costs")
            .select("amount")
            .eq("tenant_id", tid)
            .gte("cost_date", first_iso)
            .lte("cost_date", last_iso)
            .execute()
        )

    def fetch_payroll():
        return (
            supabase.table("payroll_periods")
            .select("id")
            .eq("tenant_id", tid)
            .eq("status", "confirmed")
            .gte("start_date", first_iso)
            .lte("start_date", last_iso)
            .execute()
        )

    def fetch_recv():
        return (
            supabase.table("receivables")
            .select("amount")
            .eq("tenant_id", tid)
            .gte("created_at", first_iso)
            .lte("created_at", last_iso)
            .execute()
        )

    def fetch_prod():
        return (
            supabase.table("products")
            .select("name, stock_qty, stock_min, unit")
            .eq("tenant_id", tid)
            .eq("is_active", True)
            .execute()
        )

    def fetch_excel():
        try:
            return (
                supabase.table("excel_files")
                .select("file_url")
                .eq("tenant_id", tid)
                .eq("period", period_key)
                .limit(1)
                .execute()
            )
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=9) as executor:
        fut_settings = executor.submit(fetch_settings)
        fut_del = executor.submit(fetch_deliveries)
        fut_exp = executor.submit(fetch_expenses)
        fut_payables = executor.submit(fetch_payables)
        fut_ops = executor.submit(fetch_ops)
        fut_payroll = executor.submit(fetch_payroll)
        fut_recv = executor.submit(fetch_recv)
        fut_prod = executor.submit(fetch_prod)
        fut_excel = executor.submit(fetch_excel)

        settings_resp = fut_settings.result()
        del_resp = fut_del.result()
        exp_resp = fut_exp.result()
        payable_resp = fut_payables.result()
        ops_resp = fut_ops.result()
        pay_resp = fut_payroll.result()
        recv_resp = fut_recv.result()
        prod_resp = fut_prod.result()
        excel_resp = fut_excel.result()

    settings_rows = getattr(settings_resp, "data", None) or []
    alloc_settings = settings_rows[0] if settings_rows else {}
    rate_bahan_sd = _d(alloc_settings.get("bahan_sd_smp") or 10000)
    rate_bahan_tk = _d(alloc_settings.get("bahan_paud_tk") or 8000)
    rate_ops = _d(alloc_settings.get("ops_per_porsi") or 3000)
    rate_insentif = _d(alloc_settings.get("insentif_harian") or 6000000)

    # ─── MBG deliveries bulanan ──────────────────────────────────────
    del_rows = getattr(del_resp, "data", None) or []
    total_portions = sum(r.get("portions_sent", 0) for r in del_rows)
    delivery_dates = {r.get("delivery_date") for r in del_rows if r.get("delivery_date")}
    total_delivery_days = len(delivery_dates)
    avg_ppd = round(total_portions / total_delivery_days, 1) if total_delivery_days else 0

    # ─── Revenue dihitung dari settings × porsi aktual ───────────────
    revenue_bahan = Decimal("0")
    
    # ─── Build summaries grouping by date ────────────────────────────
    from collections import defaultdict
    daily_groups = defaultdict(lambda: {"total_portions": 0, "menu_name": "", "deliveries": []})
    
    for d in del_rows:
        p = _d(d.get("portions_sent", 0))
        date_str_del = d.get("delivery_date", "")
        menu_name_del = d.get("menu_name", "Tanpa Jadwal")
        s_data = d.get("schools") or {}
        if isinstance(s_data, list):
            s_data = s_data[0] if s_data else {}
        sl = s_data.get("school_level", "sd_smp")
        s_name = s_data.get("name", "Unknown School")
        
        revenue_bahan += p * (rate_bahan_tk if sl == "paud_tk" else rate_bahan_sd)
        
        # Add to summary
        if date_str_del:
            daily_groups[date_str_del]["total_portions"] += int(p)
            daily_groups[date_str_del]["menu_name"] = menu_name_del
            daily_groups[date_str_del]["deliveries"].append({
                "school_name": s_name,
                "portions_sent": int(p),
                "status": d.get("status", "confirmed")
            })
            
    summaries = []
    for d_str in sorted(daily_groups.keys(), reverse=True):
        group = daily_groups[d_str]
        summaries.append({
            "date": d_str,
            "menu_name": group["menu_name"],
            "total_portions": group["total_portions"],
            "schools_count": len(group["deliveries"]),
            "deliveries": group["deliveries"]
        })

    revenue_ops = _d(total_portions) * rate_ops
    revenue_insentif = rate_insentif * total_delivery_days
    revenue_calculated = revenue_bahan + revenue_ops + revenue_insentif
    revenue_gross = revenue_calculated  # backward compat

    # ─── Expenses bulanan ─────────────────────────────────────────────
    exp_rows = getattr(exp_resp, "data", None) or []
    exp_total = sum(_d(r.get("total")) for r in exp_rows)

    # Top suppliers
    sup_map = {}
    for r in exp_rows:
        name = (r.get("suppliers") or {}).get("name") or "Tanpa Supplier"
        sup_map[name] = sup_map.get(name, Decimal("0")) + _d(r.get("total"))
    top_suppliers = [
        {"name": k, "total": str(v)}
        for k, v in sorted(sup_map.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    # Hutang outstanding bulan ini
    payable_rows = getattr(payable_resp, "data", None) or []
    hutang_outstanding = sum(_d(r.get("amount")) for r in payable_rows)

    # ─── Operational costs & Payroll ─────────────────────────────────
    total_ops = sum(_d(r.get("amount")) for r in (getattr(ops_resp, "data", None) or []))

    p_ids = [p["id"] for p in (getattr(pay_resp, "data", None) or [])]
    total_payroll = Decimal("0")
    if p_ids:
        item_resp = (
            supabase.table("payroll_items")
            .select("net_amount")
            .in_("period_id", p_ids)
            .execute()
        )
        total_payroll = sum(_d(i.get("net_amount")) for i in (getattr(item_resp, "data", None) or []))

    total_all_expenses = exp_total + total_ops + total_payroll

    # ─── Laba Estimasi: revenue - SEMUA biaya (bahan + ops + gaji) ────
    import calendar
    cal = calendar.Calendar()
    working_days = sum(
        1 for d in cal.itermonthdays2(y, m)
        if d[0] != 0 and d[1] != 6  # d[1]=6 is Sunday
    )
    insentif_bulanan = rate_insentif * working_days

    gross_profit = revenue_calculated - total_all_expenses

    # ─── Piutang (receivables) ────────────────────────────────────────
    recv_rows = getattr(recv_resp, "data", None) or []
    piutang_total = sum(_d(r.get("amount")) for r in recv_rows)

    # ─── Stock summary ────────────────────────────────────────────────
    prod_rows = getattr(prod_resp, "data", None) or []
    low_items = [
        {"name": p["name"], "stock_qty": float(p.get("stock_qty") or 0), "unit": p.get("unit", "")}
        for p in prod_rows
        if _d(p.get("stock_qty")) < _d(p.get("stock_min"))
    ]

    # ─── Excel status ─────────────────────────────────────────────────
    excel_rows = getattr(excel_resp, "data", None) or [] if excel_resp else []
    excel_status = "generated" if excel_rows else "not_generated"

    return {
        "success": True,
        "data": {
            "year": y,
            "month": m,
            "period_label": period_label,
            "mbg": {
                "total_portions": total_portions,
                "total_delivery_days": total_delivery_days,
                "revenue_gross": str(revenue_gross),
                "revenue_calculated": str(revenue_calculated),
                "avg_portions_per_day": avg_ppd,
            },
            "piutang_total": str(piutang_total),
            "expenses": {
                "total": str(exp_total),
                "count": len(exp_rows),
                "hutang_outstanding": str(hutang_outstanding),
                "top_suppliers": top_suppliers,
            },
            "profit_estimate": {
                "revenue": str(revenue_gross + insentif_bulanan),
                "expenses": str(total_all_expenses),
                "gross_profit": str(gross_profit),
                "detail": {
                    "insentif_bulanan": str(insentif_bulanan),
                    "hari_kerja": working_days,
                    "bahan_pangan": str(exp_total),
                    "operasional": str(total_ops),
                    "gaji": str(total_payroll),
                },
            },
            "stock_summary": {
                "low_stock_count": len(low_items),
                "items": low_items,
            },
            "excel_status": excel_status,
            "summaries": summaries,
        },
    }


# ─── GET /reports/stock ───────────────────────────────────────────────────────

@router.get("/stock", response_model=Dict[str, Any])
def get_stock_report(
    category: Optional[str] = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Status stok semua produk. Filter opsional by category."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    q = (
        supabase.table("products")
        .select("*")
        .eq("tenant_id", tid)
        .eq("is_active", True)
    )
    if category:
        q = q.eq("category", category)
    else:
        q = q.neq("category", "komponen").neq("category", "produk_jadi")

    resp = q.order("name").execute()
    rows = getattr(resp, "data", None) or []

    items = []
    low_count = 0
    for p in rows:
        stk = _d(p.get("stock_qty"))
        stk_min = _d(p.get("stock_min"))
        factor = float(p.get("conversion_factor") or 1)
        
        is_low = stk < stk_min
        if is_low:
            low_count += 1
            
        stk_display = float(stk / Decimal(str(factor))) if factor else float(stk)
        min_display = float(stk_min / Decimal(str(factor))) if factor else float(stk_min)

        # Support both column names: harga (after migration) or hpp (before migration)
        price_val = p.get("harga") if p.get("harga") is not None else p.get("hpp")

        items.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "category": p.get("category"),
            "unit": p.get("unit"),
            "stock_qty": float(stk),
            "stock_qty_display": stk_display,
            "stock_min": float(stk_min),
            "stock_min_display": min_display,
            "harga": str(_d(price_val)),
            "is_low_stock": is_low,
            "conversion_factor": factor,
        })

    return {
        "success": True,
        "data": {
            "total_items": len(items),
            "low_stock_count": low_count,
            "items": items,
        },
    }


# ─── GET /reports/receivables ─────────────────────────────────────────────────

@router.get(
    "/receivables",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def get_receivables_report(
    month: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Pencatatan Hak Piutang MBG (History)."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    q = (
        supabase.table("receivables")
        .select("id, debtor_name, amount, created_at, status")
        .eq("tenant_id", tid)
    )
    
    if month and year:
        first = date(year, month, 1)
        last = date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year + 1, 1, 1) - timedelta(days=1)
        # created_at is timestamp, so query for the day
        q = q.gte("created_at", first.isoformat()).lte("created_at", (last + timedelta(days=1)).isoformat())

    resp = q.order("created_at", desc=True).execute()
    rows = getattr(resp, "data", None) or []

    total_all = sum(_d(r.get("amount")) for r in rows)

    receivables = []
    for r in rows:
        receivables.append({
            "id": r.get("id"),
            "debtor_name": r.get("debtor_name"),
            "amount": str(_d(r.get("amount"))),
            "created_at": r.get("created_at", "")[:10],
            "status": r.get("status"),
        })

    return {
        "success": True,
        "data": {
            "total_all": str(total_all),
            "count": len(receivables),
            "receivables": receivables,
        },
    }



# ─── GET /reports/payables ────────────────────────────────────────────────────

@router.get(
    "/payables",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def get_payables_report(
    status: str = Query(default="unpaid"),
    month: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    supplier: Optional[str] = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Hutang ke supplier. Filter by status / month / year / supplier."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    today = date.today()

    q = (
        supabase.table("payables")
        .select("id, supplier_name, amount, due_date, status, created_at")
        .eq("tenant_id", tid)
    )
    if status != "all":
        q = q.eq("status", status)
    if supplier:
        q = q.ilike("supplier_name", f"%{supplier}%")
    if month and year:
        first = date(year, month, 1)
        last = date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year + 1, 1, 1) - timedelta(days=1)
        q = q.gte("created_at", first.isoformat()).lte("created_at", (last + timedelta(days=1)).isoformat())

    try:
        resp = q.order("due_date").execute()
    except Exception as e:
        import logging
        logging.error(f"Failed to fetch payables: {e}")
        resp = None
    
    rows = getattr(resp, "data", None) or []

    total_all     = sum(_d(r.get("amount")) for r in rows)
    total_paid    = sum(_d(r.get("amount")) for r in rows if r.get("status") == "paid")
    total_unpaid  = sum(_d(r.get("amount")) for r in rows if r.get("status") != "paid")
    total_overdue_sum = Decimal("0")
    for r in rows:
        if r.get("status") != "paid" and r.get("due_date"):
            try:
                if (today - date.fromisoformat(r["due_date"])).days > 0:
                    total_overdue_sum += _d(r.get("amount"))
            except Exception:
                pass

    payables = []
    for r in rows:
        due = r.get("due_date")
        days_overdue = 0
        if due and r.get("status") != "paid":
            try:
                diff = (today - date.fromisoformat(due)).days
                days_overdue = max(0, diff)
            except Exception:
                pass
        amount = _d(r.get("amount"))
        # Fields don't exist in DB schema
        pph22  = Decimal("0")
        ppn    = Decimal("0")
        payables.append({
            "id": r.get("id"),
            "supplier_name": r.get("supplier_name"),
            "amount": str(amount),
            "pph22_amount": str(pph22),
            "ppn_amount": str(ppn),
            "total_bayar": str(amount + ppn - pph22),
            "due_date": due,
            "created_at": r.get("created_at", "")[:10],
            "status": r.get("status"),
            "days_overdue": days_overdue,
        })

    return {
        "success": True,
        "data": {
            "total_outstanding": str(total_unpaid),
            "total_all": str(total_all),
            "total_paid": str(total_paid),
            "total_overdue": str(total_overdue_sum),
            "count": len(payables),
            "payables": payables,
        },
    }


# ─── GET /reports/excel/download ──────────────────────────────────────────────

@router.get(
    "/excel/download",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
async def download_excel(
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Cek status excel_files:
    - ready              → return file_url
    - pending_regenerate → generate sync → return file_url
    - not_generated      → generate sync → return file_url
    """
    from services.export_service import ExportService
    supabase = get_supabase()
    tid = current_user.tenant_id
    today = date.today()
    y = year or today.year
    m = month or today.month

    # Generate (sync — user menunggu)
    svc = ExportService()
    file_url = svc.regenerate_monthly_excel(tid, y, m, supabase)

    if not file_url:
        raise HTTPException(500, detail="Gagal generate Excel. Cek server logs.")

    from datetime import datetime, timezone
    return {
        "success": True,
        "data": {
            "file_url": f"{file_url}?t={int(datetime.now().timestamp())}",
            "status": "ready",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }


# ─── POST /reports/excel/regenerate ──────────────────────────────────────────

@router.post(
    "/excel/regenerate",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
async def regenerate_excel(
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: UserInDB = Depends(get_current_user),
):
    """Generate ulang Excel bulan ini secara sync (user nunggu)."""
    from datetime import datetime, timezone
    from services.export_service import ExportService
    supabase = get_supabase()
    tid = current_user.tenant_id
    today = date.today()
    y = year or today.year
    m = month or today.month

    svc = ExportService()
    file_url = svc.regenerate_monthly_excel(tid, y, m, supabase)

    if not file_url:
        raise HTTPException(500, detail="Gagal generate Excel. Cek server logs.")

    return {
        "success": True,
        "data": {
            "file_url": file_url,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }

