"""
backend/services/recipe_service.py
Kalkulasi dan pemotongan stok BOM (Bill of Material) untuk produksi MBG — Modul 10

calculate() → cek apakah stok cukup untuk produksi N porsi (expand komponen)
deduct_stock() → potong stok secara atomik via increment_stock RPC (expand komponen)

Supports:
  - usage_type 'per_porsi': qty_needed × total_porsi
  - usage_type 'per_hari': daily_qty (flat, tidak kali porsi)
  - Unit conversion: semua qty dalam base unit (gram/ml/pcs)
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from utils.unit_converter import to_display, format_display

logger = logging.getLogger(__name__)


class RecipeService:
    """Service untuk BOM calculation dan stock deduction."""

    def _flatten_recipes(
        self,
        recipes: List[dict],
        qty: int,
        supabase,
    ) -> Dict[str, Decimal]:
        """
        Flatten recipe list into {ingredient_id: total_qty_base}.
        Expands components, deduplicates ingredients by summing quantities.
        Handles usage_type: per_porsi vs per_hari.
        Uses batch querying to eliminate N+1 database roundtrips.
        """
        flat: Dict[str, Decimal] = {}

        # ─── 1. Batch fetch all component items in 1 query ────────────────
        comp_ids = list({r["component_id"] for r in recipes if r.get("component_id")})
        comp_items_map: Dict[str, List[dict]] = {}
        if comp_ids:
            try:
                comp_items_resp = (
                    supabase.table("recipe_component_items")
                    .select("component_id, ingredient_id, qty_needed, usage_type, daily_qty")
                    .in_("component_id", comp_ids)
                    .execute()
                )
                for item in (getattr(comp_items_resp, "data", None) or []):
                    cid = item.get("component_id")
                    if cid:
                        comp_items_map.setdefault(cid, []).append(item)
            except Exception as e:
                logger.error(f"Error batch fetching recipe component items: {e}")

        # ─── 2. Calculate flattened ingredients in memory ─────────────────
        for r in recipes:
            usage_type = r.get("usage_type", "per_porsi")

            if r.get("component_id"):
                cid = r["component_id"]
                comp_items = comp_items_map.get(cid, [])
                recipe_qty = Decimal(str(r.get("qty_needed", 1)))

                for item in comp_items:
                    ing_id = item["ingredient_id"]
                    item_usage = item.get("usage_type", "per_porsi")

                    if item_usage == "per_hari":
                        needed = Decimal(str(item.get("daily_qty", 0)))
                    else:
                        needed = Decimal(str(item["qty_needed"])) * recipe_qty * Decimal(str(qty))

                    flat[ing_id] = flat.get(ing_id, Decimal("0")) + needed
            else:
                ing_id = r.get("ingredient_id") or r.get("product_id")
                if not ing_id:
                    continue

                if usage_type == "per_hari":
                    needed = Decimal(str(r.get("daily_qty", 0)))
                else:
                    qty_per_portion = Decimal(str(r.get("qty_needed") or r.get("qty", 0)))
                    needed = qty_per_portion * Decimal(str(qty))

                flat[ing_id] = flat.get(ing_id, Decimal("0")) + needed

        return flat

    def calculate(
        self,
        menu_id: str,
        qty: int,
        tenant_id: str,
        supabase,
    ) -> Dict[str, Any]:
        """
        Cek apakah stok bahan cukup untuk produksi qty porsi dari menu_id.
        Expands components → flattens → deduplicates → checks stock.
        All quantities in BASE UNIT (gram/ml/pcs).
        Optimized with batch database queries.
        """
        # Query recipes (BOM) untuk menu ini
        recipes_resp = (
            supabase.table("recipes")
            .select("*")
            .eq("menu_id", menu_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        recipes: List[dict] = getattr(recipes_resp, "data", None) or []

        if not recipes:
            return {
                "can_produce": True,
                "max_possible": qty,
                "has_bom": False,
                "ingredients": [],
            }

        # Flatten (expand components + direct ingredients) in batch
        flat = self._flatten_recipes(recipes, qty, supabase)

        if not flat:
            return {
                "can_produce": True,
                "max_possible": qty,
                "has_bom": False,
                "ingredients": [],
            }

        # ─── BATCH FETCH ALL PRODUCTS ─────────────────────────────────────
        ing_ids = list(flat.keys())
        products_map: Dict[str, dict] = {}
        if ing_ids:
            try:
                prod_resp = (
                    supabase.table("products")
                    .select("id, name, stock_qty, unit, base_unit, display_unit, conversion_factor, nutrition_ref_id")
                    .in_("id", ing_ids)
                    .execute()
                )
                for p in (getattr(prod_resp, "data", None) or []):
                    products_map[p["id"]] = p
            except Exception as e:
                logger.error(f"Error batch fetching products in calculate: {e}")

        # ─── BATCH FETCH NUTRITION REFS & UNIT WEIGHTS ────────────────────
        nut_ids = [p["nutrition_ref_id"] for p in products_map.values() if p.get("nutrition_ref_id")]
        nut_map: Dict[int, dict] = {}
        unit_weights_by_nut: Dict[int, float] = {}

        if nut_ids:
            try:
                nut_resp = (
                    supabase.table("nutrition_ref")
                    .select("id, calories, proteins, fat, carbohydrate, fiber")
                    .in_("id", nut_ids)
                    .execute()
                )
                for n in (getattr(nut_resp, "data", None) or []):
                    nut_map[n["id"]] = n
            except Exception as e:
                logger.error(f"Error batch fetching nutrition refs: {e}")

            try:
                m_resp = (
                    supabase.table("master_ingredients")
                    .select("id, nutrition_ref_id")
                    .in_("nutrition_ref_id", nut_ids)
                    .execute()
                )
                master_rows = getattr(m_resp, "data", None) or []
                master_ids = [m["id"] for m in master_rows]
                m_to_nut = {m["id"]: m["nutrition_ref_id"] for m in master_rows}

                if master_ids:
                    w_resp = (
                        supabase.table("ingredient_unit_weights")
                        .select("ingredient_id, weight_gram")
                        .in_("ingredient_id", master_ids)
                        .execute()
                    )
                    for w in (getattr(w_resp, "data", None) or []):
                        wg = float(w.get("weight_gram") or 0)
                        if wg > 0:
                            nid = m_to_nut.get(w["ingredient_id"])
                            if nid:
                                unit_weights_by_nut[nid] = wg
            except Exception as e:
                logger.warning(f"Error fetching unit weights in batch: {e}")

        ingredients = []
        can_produce = True
        max_possible = qty

        total_calories = 0.0
        total_proteins = 0.0
        total_fat = 0.0
        total_carbohydrates = 0.0
        incomplete_nutrition_data = False

        for ing_id, total_needed in flat.items():
            product = products_map.get(ing_id, {})
            available = Decimal(str(product.get("stock_qty", 0)))
            sufficient = available >= total_needed
            shortage = max(Decimal("0"), total_needed - available)

            factor = float(product.get("conversion_factor") or 1)
            disp_unit = product.get("display_unit") or product.get("unit", "kg")

            if not sufficient:
                can_produce = False
                qty_per_portion = total_needed / Decimal(str(qty)) if qty > 0 else Decimal("0")
                if qty_per_portion > 0:
                    possible_from_this = int(available / qty_per_portion)
                    max_possible = min(max_possible, possible_from_this)

            # Kalkulasi Gizi per porsi untuk bahan ini (in memory)
            nut_id = product.get("nutrition_ref_id")
            base_unit_str = (product.get("base_unit") or "gram").lower()
            qty_per_portion_val = float(total_needed / Decimal(str(qty))) if qty > 0 else 0.0
            
            weight_in_gram = qty_per_portion_val
            if base_unit_str not in ("gram", "ml", "g", "gr"):
                if factor > 1.0:
                    weight_in_gram = qty_per_portion_val * factor
                elif nut_id and nut_id in unit_weights_by_nut:
                    weight_in_gram = qty_per_portion_val * unit_weights_by_nut[nut_id]
                
            if nut_id and weight_in_gram > 0 and nut_id in nut_map:
                nref = nut_map[nut_id]
                multiplier = weight_in_gram / 100.0
                total_calories += float(nref.get("calories", 0)) * multiplier
                total_proteins += float(nref.get("proteins", 0)) * multiplier
                total_fat += float(nref.get("fat", 0)) * multiplier
                total_carbohydrates += float(nref.get("carbohydrate", 0)) * multiplier
            else:
                # Bahan ini tidak memiliki relasi nutrisi atau weight 0
                if weight_in_gram > 0 or not nut_id:
                    incomplete_nutrition_data = True

            ingredients.append({
                "ingredient_id": ing_id,
                "name": product.get("name", "?"),
                "unit": disp_unit,
                "base_unit": product.get("base_unit", "gram"),
                "display_unit": disp_unit,
                "conversion_factor": factor,
                "qty_needed_per_portion": float(total_needed / Decimal(str(qty))) if qty > 0 else 0,
                "total_needed": float(total_needed),
                "total_needed_display": round(float(total_needed) / factor, 3) if factor else float(total_needed),
                "available": float(available),
                "available_display": round(float(available) / factor, 3) if factor else float(available),
                "sufficient": sufficient,
                "shortage": float(shortage),
                "shortage_display": format_display(float(shortage), disp_unit, factor) if shortage > 0 else "0",
            })

        return {
            "can_produce": can_produce,
            "max_possible": max_possible if can_produce else max_possible,
            "has_bom": True,
            "ingredients": ingredients,
            "nutrition_per_portion": {
                "calories": round(total_calories, 1),
                "proteins": round(total_proteins, 1),
                "fat": round(total_fat, 1),
                "carbohydrates": round(total_carbohydrates, 1),
                "incomplete_nutrition_data": incomplete_nutrition_data
            }
        }

    def deduct_stock(
        self,
        menu_id: str,
        qty: int,
        tenant_id: str,
        supabase,
        delivery_date: date,
    ) -> List[dict]:
        """
        Potong stok atomik via RPC increment_stock (delta negatif).
        All deltas in BASE UNIT (gram/ml/pcs).
        """
        recipes_resp = (
            supabase.table("recipes")
            .select("*")
            .eq("menu_id", menu_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        recipes: List[dict] = getattr(recipes_resp, "data", None) or []

        # Flatten with qty=qty (total needed, not per-portion)
        flat = self._flatten_recipes(recipes, qty, supabase)

        histories = []
        for product_id, total_needed in flat.items():
            delta = float(-total_needed)

            try:
                # Delta negatif = kurangi stok (in base unit)
                supabase.rpc("increment_stock", {
                    "p_product_id": product_id,
                    "p_delta": delta,
                    "p_tenant_id": tenant_id,
                }).execute()

                # Baca saldo terbaru
                bal_resp = (
                    supabase.table("products")
                    .select("stock_qty")
                    .eq("id", product_id)
                    .single()
                    .execute()
                )
                balance = float((getattr(bal_resp, "data", None) or {}).get("stock_qty", 0))

                hist = supabase.table("stock_history").insert({
                    "tenant_id": tenant_id,
                    "product_id": product_id,
                    "change_qty": str(delta),
                    "balance_after": str(balance),
                    "reason": "production",
                    "notes": f"MBG {delivery_date}: {qty} porsi",
                }).execute()

                histories.append((getattr(hist, "data", None) or [{}])[0])
            except Exception as e:
                logger.error(f"deduct_stock gagal untuk product {product_id}: {e}")
                raise  # re-raise agar caller bisa rollback

        return histories


recipe_service = RecipeService()
