"""
backend/routers/price_tracking.py
Track kenaikan harga bahan baku + AI Insights (Modul 17)

GET /price-tracking/overview      → semua bahan, avg 30d vs 90d, trend
GET /price-tracking/ai-insights   → AI analysis via Gemini, cached Redis 24h
GET /price-tracking/{product_id}  → detail harga per bahan (chart + supplier)
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.config import settings
from core.database import get_supabase
from core.dependencies import get_current_user
from models.user import UserInDB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/price-tracking", tags=["price-tracking"])


def _d(v, default: Decimal = Decimal("0")) -> Decimal:
    try:
        return Decimal(str(v or 0))
    except Exception:
        return default


def _get_redis():
    try:
        import redis as redis_lib
        return redis_lib.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        return None


# ─── Helper: ambil transaction_items confirmed ────────────────────────────────

def _normalize_item_price(item: dict, prod_info: dict) -> float:
    """Hitung harga satuan ter-normalisasi (Unit Price Baku) per display unit."""
    try:
        subtotal = float(_d(item.get("subtotal")))
        qty = float(_d(item.get("qty"), 1.0))
        pkg_val = float(_d(item.get("packaging_value"), 1.0))
        conv_factor = float(prod_info.get("conversion_factor") or 1.0)
        
        # Total gramasi/ml/pcs
        total_base_qty = qty * pkg_val
        if total_base_qty <= 0:
            total_base_qty = 1.0
            
        unit_price_baku = subtotal / total_base_qty
        # Kembalikan harga per display unit (misal per kg atau per pcs)
        return unit_price_baku * conv_factor
    except Exception:
        return 0.0

def _fetch_items(supabase, tid: str, product_id: Optional[str], since_date: str) -> list:
    """Ambil transaction_items confirmed dalam periode tertentu."""
    # Karena Supabase Python SDK tidak support JOIN langsung,
    # kita ambil transactions confirmed dulu, lalu ambil itemnya.
    trx_resp = (
        supabase.table("transactions")
        .select("id, date, supplier_id, created_at")
        .eq("tenant_id", tid)
        .eq("status", "confirmed")
        .eq("type", "expense")
        .gte("date", since_date)
        .order("created_at")
        .execute()
    )
    trx_rows = getattr(trx_resp, "data", None) or []
    if not trx_rows:
        return []
 
    trx_ids = [t["id"] for t in trx_rows]
    trx_map = {t["id"]: t for t in trx_rows}
 
    # Ambil items (hanya yang sudah ter-mapping: product_id tidak kosong, needs_confirmation = False)
    items_q = (
        supabase.table("transaction_items")
        .select("id, transaction_id, product_id, product_name, qty, unit, price, subtotal, packaging_value, packaging_unit, needs_confirmation")
        .in_("transaction_id", trx_ids)
    )
    if product_id:
        items_q = items_q.eq("product_id", product_id)
 
    items_resp = items_q.execute()
    raw_items = getattr(items_resp, "data", None) or []
    
    # Filter items agar HANYA menggunakan data ter-mapping dan tervalidasi
    items = []
    for item in raw_items:
        pid = item.get("product_id")
        needs_conf = item.get("needs_confirmation")
        if pid and not needs_conf:
            items.append(item)
 
    # Enrich dengan date + supplier_id + created_at dari transaksi
    for item in items:
        trx = trx_map.get(item.get("transaction_id"), {})
        item["date"] = trx.get("date")
        item["supplier_id"] = trx.get("supplier_id")
        item["created_at"] = trx.get("created_at", "")
 
    # Sort items globally by created_at
    items.sort(key=lambda x: x.get("created_at", ""))
 
    return items


# ─── GET /price-tracking/overview ─────────────────────────────────────────────

@router.get("/overview", response_model=Dict[str, Any])
def get_price_overview(
    current_user: UserInDB = Depends(get_current_user),
):
    """Overview harga semua bahan: avg 30d vs 90d, trend, supplier termurah."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    today = date.today()
    d30_ago = (today - timedelta(days=30)).isoformat()
    d90_ago = (today - timedelta(days=90)).isoformat()

    # Ambil items 90 hari terakhir
    items_90 = _fetch_items(supabase, tid, None, d90_ago)
    if not items_90:
        return {"success": True, "data": {"items": [], "generated_at": datetime.now(timezone.utc).isoformat()}}

    # Ambil daftar supplier names
    sup_ids = list({i["supplier_id"] for i in items_90 if i.get("supplier_id")})
    supplier_names: Dict[str, str] = {}
    if sup_ids:
        sup_resp = supabase.table("suppliers").select("id, name").in_("id", sup_ids).execute()
        supplier_names = {s["id"]: s["name"] for s in (getattr(sup_resp, "data", None) or [])}

    # Group by product_id
    from collections import defaultdict
    prod_items_90: Dict[str, list] = defaultdict(list)
    prod_items_30: Dict[str, list] = defaultdict(list)

    for item in items_90:
        pid = item.get("product_id") or item.get("product_name", "")
        if not pid:
            continue
        prod_items_90[pid].append(item)
        if item.get("date", "") >= d30_ago:
            prod_items_30[pid].append(item)

    # Ambil product names
    all_prod_ids = list(prod_items_90.keys())
    # Filter only valid UUIDs to avoid Supabase APIError
    import uuid
    valid_uuids = []
    for pid in all_prod_ids:
        try:
            uuid.UUID(str(pid))
            valid_uuids.append(pid)
        except ValueError:
            pass
            
    prod_names: Dict[str, dict] = {}
    if valid_uuids:
        try:
            pr = supabase.table("products").select("id, name, unit, category, base_unit, conversion_factor").in_("id", valid_uuids).execute()
            prod_names = {p["id"]: p for p in (getattr(pr, "data", None) or [])}
        except Exception as e:
            logger.error(f"Failed to fetch products for price tracking: {e}")

    result = []
    for pid, items in prod_items_90.items():
        prod_info = prod_names.get(pid, {})
        # Filter bahan_baku only
        if prod_info.get("category") not in ("bahan_baku", "kemasan", None, ""):
            continue

        prices_90 = []
        for i in items:
            if i.get("date", "") < d30_ago:
                p_norm = _normalize_item_price(i, prod_info)
                if p_norm > 0:
                    prices_90.append(p_norm)

        prices_30 = []
        for i in prod_items_30.get(pid, []):
            p_norm = _normalize_item_price(i, prod_info)
            if p_norm > 0:
                prices_30.append(p_norm)

        if not prices_90 and not prices_30:
            continue

        avg_30 = sum(prices_30) / len(prices_30) if prices_30 else 0.0
        avg_90 = sum(prices_90) / len(prices_90) if prices_90 else avg_30
        
        if avg_30 == 0.0 and avg_90 == 0.0:
            continue
            
        if avg_30 == 0.0:
            avg_30 = avg_90
        if avg_90 == 0.0:
            avg_90 = avg_30

        change_pct = ((avg_30 - avg_90) / avg_90 * 100) if avg_90 > 0 else 0

        if change_pct > 3:
            trend = "naik"
        elif change_pct < -3:
            trend = "turun"
        else:
            trend = "stabil"

        # Supplier termurah bulan ini
        items_30 = prod_items_30.get(pid, [])
        cheapest_name = "—"
        cheapest_price = Decimal("0")
        if items_30:
            by_sup: Dict[str, list] = defaultdict(list)
            for i in items_30:
                sid = i.get("supplier_id") or ""
                p_norm = _normalize_item_price(i, prod_info)
                if p_norm > 0:
                    by_sup[sid].append(p_norm)
            sup_avg = {sid: sum(pr) / len(pr) for sid, pr in by_sup.items() if pr}
            if sup_avg:
                cheapest_sid = min(sup_avg, key=sup_avg.get)
                cheapest_name = supplier_names.get(cheapest_sid, cheapest_sid or "Tanpa Supplier")
                cheapest_price = Decimal(str(round(sup_avg[cheapest_sid], 2)))

        last_purchase = max((i.get("date") or "") for i in items)

        result.append({
            "product_id": pid,
            "product_name": prod_info.get("name") or next((i.get("product_name") for i in items if i.get("product_name")), pid),
            "unit": prod_info.get("unit", ""),
            "avg_price_30d": str(Decimal(str(round(avg_30, 2)))),
            "avg_price_90d": str(Decimal(str(round(avg_90, 2)))),
            "change_pct": round(change_pct, 2),
            "trend": trend,
            "cheapest_supplier": cheapest_name,
            "cheapest_price": str(cheapest_price),
            "last_purchase": last_purchase,
        })

    # Sort: urut abjad nama bahan
    result.sort(key=lambda x: x["product_name"].lower())

    return {
        "success": True,
        "data": {
            "items": result,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }


# ─── GET /price-tracking/ai-insights ──────────────────────────────────────────

@router.get("/ai-insights", response_model=Dict[str, Any])
def get_ai_insights(
    force_refresh: bool = Query(default=False),
    current_user: UserInDB = Depends(get_current_user),
):
    """AI insight dari Gemini, cached Redis 24 jam."""
    tid = current_user.tenant_id
    cache_key = f"ai_insight:{tid}"

    # Cek cache Redis
    redis_client = _get_redis()
    if redis_client and not force_refresh:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                data = json.loads(cached)
                data["from_cache"] = True
                return {"success": True, "data": data}
        except Exception as e:
            logger.warning("Redis read error: %s", e)

    PLACEHOLDER = {
        "summary": "Analisis tidak tersedia saat ini. Pastikan ada data transaksi terkonfirmasi.",
        "alerts": [],
        "opportunities": [],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "from_cache": False,
    }

    if not settings.gemini_api_key:
        return {"success": True, "data": PLACEHOLDER}

    # Ambil overview data untuk AI
    try:
        supabase = get_supabase()
        today = date.today()
        d90_ago = (today - timedelta(days=90)).isoformat()
        items_90 = _fetch_items(supabase, tid, None, d90_ago)
        if not items_90:
            return {"success": True, "data": PLACEHOLDER}

        # Ringkas data untuk Gemini (tidak kirim semua raw data)
        from collections import defaultdict
        prod_summary = defaultdict(lambda: {"prices": [], "name": ""})
        for item in items_90:
            pid = item.get("product_id") or item.get("product_name", "")
            price = float(_d(item.get("price")))
            if price > 0 and pid:
                prod_summary[pid]["prices"].append(price)
                if item.get("product_name"):
                    prod_summary[pid]["name"] = item["product_name"]

        data_for_ai = []
        for pid, info in prod_summary.items():
            prices = info["prices"]
            if len(prices) < 2:
                continue
            first_half = prices[:len(prices)//2]
            second_half = prices[len(prices)//2:]
            avg_first = sum(first_half) / len(first_half)
            avg_last = sum(second_half) / len(second_half)
            change = ((avg_last - avg_first) / avg_first * 100) if avg_first > 0 else 0
            data_for_ai.append({
                "bahan": info["name"] or pid,
                "avg_harga_lama": round(avg_first),
                "avg_harga_baru": round(avg_last),
                "perubahan_pct": round(change, 1),
                "jumlah_transaksi": len(prices),
            })

        if not data_for_ai:
            return {"success": True, "data": PLACEHOLDER}

        data_json = json.dumps(data_for_ai, ensure_ascii=False)

        # Call Gemini
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(settings.gemini_text_model)

            prompt = f"""Kamu adalah analis keuangan untuk usaha catering MBG.
Data harga bahan baku catering MBG periode 3 bulan terakhir:
{data_json}

Berikan analisis dalam format JSON berikut (HANYA JSON valid, tanpa teks lain):
{{
  "summary": "ringkasan 2-3 kalimat kondisi harga",
  "alerts": [
    {{
      "level": "high|medium|low",
      "bahan": "nama bahan",
      "pesan": "penjelasan singkat",
      "rekomendasi": "aksi yang disarankan"
    }}
  ],
  "opportunities": [
    {{
      "bahan": "nama bahan",
      "pesan": "peluang penghematan",
      "estimasi_hemat": "Rp X per bulan"
    }}
  ],
  "generated_at": "{datetime.now(timezone.utc).isoformat()}"
}}"""

            response = model.generate_content(prompt)
            raw = response.text.strip()
            # Strip markdown code blocks if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            if raw.endswith("```"):
                raw = raw[:-3]

            parsed = json.loads(raw.strip())
            parsed["from_cache"] = False

            # Cache di Redis 24 jam
            if redis_client:
                try:
                    redis_client.setex(cache_key, 86400, json.dumps(parsed, ensure_ascii=False))
                except Exception as e:
                    logger.warning("Redis write error: %s", e)

            return {"success": True, "data": parsed}

        except Exception as e:
            logger.error("Gemini AI insights error: %s", e)
            # Return cached if available
            if redis_client:
                try:
                    cached = redis_client.get(cache_key)
                    if cached:
                        data = json.loads(cached)
                        data["from_cache"] = True
                        return {"success": True, "data": data}
                except Exception:
                    pass
            return {"success": True, "data": PLACEHOLDER}

    except Exception as e:
        logger.error("ai-insights error: %s", e)
        return {"success": True, "data": PLACEHOLDER}


# ─── GET /price-tracking/{product_id} ─────────────────────────────────────────

@router.get("/{product_id}", response_model=Dict[str, Any])
def get_product_price_history(
    product_id: str,
    period: str = Query(default="1m"),  # "1m" | "3m" | "12m"
    current_user: UserInDB = Depends(get_current_user),
):
    """Detail harga per bahan: chart data + supplier comparison + stats."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    today = date.today()

    period_days = {"1m": 30, "3m": 90, "12m": 365}.get(period, 30)
    since = (today - timedelta(days=period_days)).isoformat()

    # Cek produk ada
    import uuid
    is_valid_uuid = False
    try:
        uuid.UUID(str(product_id))
        is_valid_uuid = True
    except ValueError:
        pass

    prod = None
    if is_valid_uuid:
        try:
            prod_resp = supabase.table("products").select("id, name, unit, base_unit, conversion_factor").eq("id", product_id).eq("tenant_id", tid).single().execute()
            prod = getattr(prod_resp, "data", None)
        except Exception:
            pass

    product_name = prod["name"] if prod else product_id
    product_unit = prod.get("unit", "") if prod else ""

    # UUID filtering is also needed for items query because product_id goes into items eq()
    items = _fetch_items(supabase, tid, product_id if is_valid_uuid else None, since)
    
    # Filter items manual if non-UUID was passed (which means product_id is actually product_name)
    if not is_valid_uuid:
        items = [i for i in items if i.get("product_name") == product_id]

    if not items:
        return {
            "success": True,
            "data": {
                "product_id": product_id,
                "product_name": product_name,
                "unit": product_unit,
                "period": period,
                "chart_data": [],
                "suppliers_comparison": [],
                "stats": {"min_price": "0", "max_price": "0", "avg_price": "0", "price_volatility": 0},
            },
        }

    # Supplier names
    sup_ids = list({i["supplier_id"] for i in items if i.get("supplier_id")})
    supplier_names: Dict[str, str] = {}
    if sup_ids:
        sup_resp = supabase.table("suppliers").select("id, name").in_("id", sup_ids).execute()
        supplier_names = {s["id"]: s["name"] for s in (getattr(sup_resp, "data", None) or [])}

    # Group by date
    from collections import defaultdict
    by_date: Dict[str, Dict[str, list]] = defaultdict(lambda: defaultdict(list))
    latest_daily_price: Dict[str, float] = {}
    
    for item in items:
        d = item.get("date", "")[:10]
        sid = item.get("supplier_id") or "unknown"
        price = _normalize_item_price(item, prod or {})
        qty = float(_d(item.get("qty")))
        if price > 0:
            by_date[d][sid].append({"price": price, "qty": qty, "transaction_id": item.get("transaction_id")})
            # Karena items sudah di-sort ASC, update terus berarti nilainya selalu yang terakhir (latest)
            latest_daily_price[d] = price

    chart_data = []
    for d in sorted(by_date.keys()):
        day_sup = by_date[d]
        final_price = latest_daily_price.get(d, 0)

        by_supplier = []
        for sid, plist in day_sup.items():
            latest = plist[-1]["price"]
            latest_trx = plist[-1].get("transaction_id")
            total_qty = sum(p["qty"] for p in plist)
            by_supplier.append({
                "supplier_name": supplier_names.get(sid, "Tanpa Supplier"),
                "price": round(latest, 2),
                "qty": round(total_qty, 3),
                "transaction_id": latest_trx,
            })

        chart_data.append({
            "date": d,
            "avg_price": round(final_price, 2),
            "by_supplier": by_supplier,
        })

    # Suppliers comparison
    by_sup_all: Dict[str, list] = defaultdict(list)
    for item in items:
        sid = item.get("supplier_id") or "unknown"
        price = _normalize_item_price(item, prod or {})
        if price > 0:
            by_sup_all[sid].append(price)

    suppliers_comparison = []
    for sid, prices in by_sup_all.items():
        suppliers_comparison.append({
            "supplier_name": supplier_names.get(sid, "Tanpa Supplier"),
            "avg_price": round(sum(prices) / len(prices), 2),
            "min_price": round(min(prices), 2),
            "max_price": round(max(prices), 2),
            "purchase_count": len(prices),
        })
    suppliers_comparison.sort(key=lambda x: x["avg_price"])

    # Stats
    all_prices = []
    for item in items:
        price = _normalize_item_price(item, prod or {})
        if price > 0:
            all_prices.append(price)
            
    if all_prices:
        avg_all = sum(all_prices) / len(all_prices)
        variance = sum((p - avg_all) ** 2 for p in all_prices) / len(all_prices)
        volatility = round((variance ** 0.5) / avg_all * 100, 2) if avg_all > 0 else 0
        stats = {
            "min_price": str(round(min(all_prices), 2)),
            "max_price": str(round(max(all_prices), 2)),
            "avg_price": str(round(avg_all, 2)),
            "price_volatility": volatility,
        }
    else:
        stats = {"min_price": "0", "max_price": "0", "avg_price": "0", "price_volatility": 0}

    return {
        "success": True,
        "data": {
            "product_id": product_id,
            "product_name": product_name,
            "unit": product_unit,
            "period": period,
            "chart_data": chart_data,
            "suppliers_comparison": suppliers_comparison,
            "stats": stats,
        },
    }
