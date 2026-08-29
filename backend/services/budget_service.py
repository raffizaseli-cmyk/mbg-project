"""
backend/services/budget_service.py
Kalkulasi anggaran bulanan MBG: pagu, pencairan, realisasi, sisa, breakdown 80:15:5.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from core.database import get_supabase

logger = logging.getLogger(__name__)


def _d(v, default=Decimal("0")) -> Decimal:
    try:
        return Decimal(str(v or 0))
    except Exception:
        return default


class BudgetService:

    def get_monthly_summary(
        self, tenant_id: str, year: int, month: int
    ) -> Dict[str, Any]:
        from concurrent.futures import ThreadPoolExecutor
        supabase = get_supabase()

        first = date(year, month, 1)
        if month == 12:
            last = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last = date(year, month + 1, 1) - timedelta(days=1)

        first_iso = first.isoformat()
        last_iso = last.isoformat()

        def fetch_pagu():
            return (
                supabase.table("budget_allocations")
                .select("pagu_amount, notes")
                .eq("tenant_id", tenant_id)
                .eq("year", year)
                .eq("month", month)
                .limit(1)
                .execute()
            )

        def fetch_disb():
            return (
                supabase.table("fund_disbursements")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("year", year)
                .eq("month", month)
                .order("disbursement_date")
                .execute()
            )

        def fetch_trx():
            return (
                supabase.table("transactions")
                .select("total, juknis_category")
                .eq("tenant_id", tenant_id)
                .eq("status", "confirmed")
                .eq("type", "expense")
                .gte("date", first_iso)
                .lte("date", last_iso)
                .execute()
            )

        def fetch_ops():
            return (
                supabase.table("operational_costs")
                .select("amount")
                .eq("tenant_id", tenant_id)
                .gte("cost_date", first_iso)
                .lte("cost_date", last_iso)
                .execute()
            )

        def fetch_pay():
            return (
                supabase.table("payroll_periods")
                .select("id")
                .eq("tenant_id", tenant_id)
                .neq("status", "draft")
                .gte("start_date", first_iso)
                .lte("start_date", last_iso)
                .execute()
            )

        def fetch_alloc():
            return (
                supabase.table("mbg_allocation_settings")
                .select("*")
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            )

        def fetch_ba():
            return (
                supabase.table("mbg_budget_allocations")
                .select("total_portions, budget_bahan, budget_ops, budget_insentif")
                .eq("tenant_id", tenant_id)
                .gte("date", first_iso)
                .lte("date", last_iso)
                .execute()
            )

        def fetch_kas():
            return (
                supabase.table("kas_accounts")
                .select("id, name, type, current_balance, is_active")
                .eq("tenant_id", tenant_id)
                .eq("is_active", True)
                .order("name")
                .execute()
            )

        def fetch_fr():
            return (
                supabase.table("fund_returns")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("year", year)
                .eq("month", month)
                .limit(1)
                .execute()
            )

        with ThreadPoolExecutor(max_workers=9) as executor:
            fut_pagu = executor.submit(fetch_pagu)
            fut_disb = executor.submit(fetch_disb)
            fut_trx = executor.submit(fetch_trx)
            fut_ops = executor.submit(fetch_ops)
            fut_pay = executor.submit(fetch_pay)
            fut_alloc = executor.submit(fetch_alloc)
            fut_ba = executor.submit(fetch_ba)
            fut_kas = executor.submit(fetch_kas)
            fut_fr = executor.submit(fetch_fr)

            pagu_resp = fut_pagu.result()
            disb_resp = fut_disb.result()
            trx_resp = fut_trx.result()
            ops_resp = fut_ops.result()
            pay_resp = fut_pay.result()
            alloc_resp = fut_alloc.result()
            ba_resp = fut_ba.result()
            kas_resp = fut_kas.result()
            fr_resp = fut_fr.result()

        pagu_rows = getattr(pagu_resp, "data", None) or []
        pagu_amount = _d(pagu_rows[0]["pagu_amount"]) if pagu_rows else Decimal("0")

        disbursements = getattr(disb_resp, "data", None) or []
        total_disbursed = sum(_d(d.get("amount")) for d in disbursements)

        trx_rows = getattr(trx_resp, "data", None) or []
        realisasi: Dict[str, Decimal] = {}
        for t in trx_rows:
            cat = t.get("juknis_category") or "lainnya"
            realisasi[cat] = realisasi.get(cat, Decimal("0")) + _d(t.get("total"))

        for o in (getattr(ops_resp, "data", None) or []):
            realisasi["operasional"] = realisasi.get("operasional", Decimal("0")) + _d(o.get("amount"))

        p_ids = [p["id"] for p in (getattr(pay_resp, "data", None) or [])]
        if p_ids:
            item_resp = (
                supabase.table("payroll_items")
                .select("net_amount")
                .in_("period_id", p_ids)
                .execute()
            )
            for i in (getattr(item_resp, "data", None) or []):
                realisasi["insentif"] = realisasi.get("insentif", Decimal("0")) + _d(i.get("net_amount"))

        total_spent = sum(realisasi.values())
        sisa = total_disbursed - total_spent

        alloc_rows = getattr(alloc_resp, "data", None) or [{}]
        alloc = alloc_rows[0] if alloc_rows else {}
        price_pp = _d(alloc.get("price_per_portion", 15000))
        rate_bahan_sd = _d(alloc.get("bahan_sd_smp", 10000))
        rate_bahan_tk = _d(alloc.get("bahan_paud_tk", 8000))
        rate_ops_pp = _d(alloc.get("ops_per_porsi", 3000))
        insentif_harian = _d(alloc.get("insentif_harian", 6000000))
        hari_kerja = int(alloc.get("hari_kerja_bulan") or 26)

        ba_rows = getattr(ba_resp, "data", None) or []
        total_porsi = sum(r.get("total_portions", 0) for r in ba_rows)
        
        # Targets dari SETTINGS (Model Sewa Dapur)
        target_bahan = sum(_d(r.get("budget_bahan")) for r in ba_rows)  # Daily allocations
        sewa_dapur = insentif_harian * hari_kerja   # Profit pemilik (bukan pengeluaran)
        target_ops = _d(total_porsi) * rate_ops_pp  # Rp 3k/porsi = ops + gaji

        # Fallback target jika alokasi harian (mbg_budget_allocations) belum dibuat
        base_budget = pagu_amount if pagu_amount > Decimal("0") else total_disbursed
        if target_bahan == Decimal("0") and base_budget > Decimal("0"):
            target_bahan = base_budget * Decimal("0.80")  # 80% alokasi bahan baku standart MBG
        if target_ops == Decimal("0") and base_budget > Decimal("0"):
            target_ops = base_budget * Decimal("0.20")    # 20% operasional

        # Realisasi bahan: ONLY bahan_pangan
        real_bahan = Decimal("0")
        for t in trx_rows:
            cat = str(t.get("juknis_category") or "").lower()
            if cat == "bahan_pangan":
                real_bahan += _d(t.get("total"))
        realisasi["bahan_pangan"] = real_bahan
        
        # Realisasi operasional: ops costs + gaji + nota non-bahan
        real_ops_base = realisasi.get("operasional", Decimal("0"))
        real_gaji = realisasi.get("insentif", Decimal("0"))
        # Sum transactions that are strictly NOT bahan_pangan and NOT operasional, because operasional was already in real_ops_base.
        ops_from_trx = sum(_d(t.get("total")) for t in trx_rows 
                          if str(t.get("juknis_category") or "").lower() not in ["bahan_pangan", "operasional"])
        realisasi["operasional"] = real_ops_base + real_gaji + ops_from_trx

        def _breakdown(cat_key: str, target: Decimal, label: str):
            real = realisasi.get(cat_key, Decimal("0"))
            pct = float(real / target * 100) if target > 0 else 0
            return {
                "realisasi": str(real),
                "target": str(target),
                "label": label,
                "pct": round(pct, 1),
                "over_budget": (target > 0) and (real > target),
            }

        # ── Kas balances ──
        kas_balances = self.get_kas_balances(tenant_id)

        # ── Fund return ──
        fr_resp = (
            supabase.table("fund_returns")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("year", year)
            .eq("month", month)
            .limit(1)
            .execute()
        )
        fr_rows = getattr(fr_resp, "data", None) or []
        fund_return = fr_rows[0] if fr_rows else None

        return {
            "year": year,
            "month": month,
            "pagu_amount": str(pagu_amount),
            "total_disbursed": str(total_disbursed),
            "total_spent": str(total_spent),
            "sisa_anggaran": str(sisa),
            "pct_terpakai": round(
                float(total_spent / total_disbursed * 100) if total_disbursed > 0 else 0, 1
            ),
            "total_porsi": total_porsi,
            "avg_harga_porsi": str(
                round(total_spent / total_porsi, 2) if total_porsi > 0 else 0
            ),
            "kas_balances": kas_balances,
            "sewa_dapur": str(sewa_dapur),
            "juknis_breakdown": {
                "bahan_pangan": _breakdown("bahan_pangan", target_bahan, "Bahan Pangan"),
                "operasional": _breakdown("operasional", target_ops, "Operasional + Gaji (Rp 3k/porsi)"),
                "sewa_dapur": {
                    "amount": str(sewa_dapur),
                    "label": "Sewa Dapur",
                    "note": "Keuntungan pemilik",
                },
            },
            "disbursements": [
                {
                    "id": d["id"],
                    "date": d.get("disbursement_date"),
                    "amount": str(_d(d.get("amount"))),
                    "reference_number": d.get("reference_number"),
                    "notes": d.get("notes"),
                }
                for d in disbursements
            ],
            "fund_return": fund_return,
        }

    def get_kas_balances(self, tenant_id: str) -> List[Dict[str, Any]]:
        supabase = get_supabase()
        resp = (
            supabase.table("kas_accounts")
            .select("id, name, type, current_balance, is_active")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .order("name")
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "balance": str(_d(r.get("current_balance"))),
            }
            for r in rows
        ]


budget_service = BudgetService()
