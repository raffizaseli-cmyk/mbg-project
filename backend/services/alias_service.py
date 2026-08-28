"""
backend/services/alias_service.py
Resolusi alias nama item nota → produk DB — Modul 7

Langkah 1: Cek tabel product_aliases (DB lookup exact/ILIKE)
Langkah 2: (opsional) AI matching — NONAKTIF di jalur OCR agar cepat
Belajar alias: saat konfirmasi nota (nama final + ocr_nama_asli)
"""

import json
import logging
import re
from typing import Any, List, Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


class AliasService:
    """
    Sync service — dipanggil dari RQ worker / confirm transaction.
    """

    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_text_model
        self.api_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

    def resolve(
        self,
        nama_item: str,
        tenant_id: str,
        supabase,
        *,
        use_ai: bool = False,
        products_cache: Optional[List[dict]] = None,
    ) -> dict:
        """
        Return dict:
          {product_id, product_name, confidence, source, needs_confirmation}
        use_ai=False: hanya DB (cepat) — dipakai saat OCR.
        """
        nama_item = (nama_item or "").strip()
        if not nama_item:
            return self._unresolved("Unknown")

        products = (
            products_cache
            if products_cache is not None
            else self._get_products(tenant_id, supabase)
        )

        # ─── Langkah 0: Cek product utama (exact / case-insensitive) ───
        for p in products:
            if p["name"].lower() == nama_item.lower():
                return {
                    "product_id": p["id"],
                    "product_name": p["name"],
                    "confidence": 1.0,
                    "source": "exact_match",
                    "needs_confirmation": False,
                }

        # ─── Langkah 1: Cek product_aliases (DB) ───
        alias_resp = (
            supabase.table("product_aliases")
            .select("product_id, products!product_id(name)")
            .eq("tenant_id", tenant_id)
            .ilike("alias_name", nama_item)
            .limit(1)
            .execute()
        )
        aliases = getattr(alias_resp, "data", None) or []
        if aliases:
            row = aliases[0]
            prod_name = (row.get("products") or {}).get("name", nama_item)
            return {
                "product_id": row["product_id"],
                "product_name": prod_name,
                "confidence": 1.0,
                "source": "alias_db",
                "needs_confirmation": False,
            }

        # ─── Langkah 2: AI matching (hanya jika use_ai=True) ───
        if use_ai and products:
            return self._resolve_with_ai(nama_item, tenant_id, supabase, products)

        return self._unresolved(nama_item)

    def match_product_by_name(
        self, name: str, tenant_id: str, supabase
    ) -> Optional[dict]:
        """Exact match nama produk aktif — tanpa AI."""
        name = (name or "").strip()
        if not name:
            return None
        resp = (
            supabase.table("products")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .ilike("name", name)
            .limit(2)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        if len(rows) == 1:
            return rows[0]
        for r in rows:
            if r.get("name", "").lower() == name.lower():
                return r
        return None

    def learn_aliases(
        self,
        tenant_id: str,
        product_id: Optional[str],
        names: List[str],
        supabase,
        source: str = "confirm",
    ) -> None:
        """
        Simpan nama → product_id ke product_aliases setelah user konfirmasi.
        Tanpa panggilan AI.
        """
        if not product_id:
            return

        prod_resp = (
            supabase.table("products")
            .select("name")
            .eq("id", product_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        prod_rows = getattr(prod_resp, "data", None) or []
        canonical = (prod_rows[0].get("name") or "").strip().lower() if prod_rows else ""

        seen = set()
        for raw in names:
            alias = (raw or "").strip()
            if not alias:
                continue
            key = alias.lower()
            if key in seen or key == canonical:
                continue
            seen.add(key)
            try:
                supabase.table("product_aliases").upsert(
                    {
                        "tenant_id": tenant_id,
                        "product_id": product_id,
                        "alias_name": alias,
                        "source": source,
                        "confidence": 1.0,
                    },
                    on_conflict="tenant_id,alias_name",
                ).execute()
            except Exception as e:
                logger.warning(f"learn_aliases gagal '{alias}': {e}")

    def _resolve_with_ai(
        self, nama_item: str, tenant_id: str, supabase, products: List[dict]
    ) -> dict:
        product_list = "\n".join([f"- id:{p['id']} name:{p['name']}" for p in products])
        prompt = (
            f"Dari daftar produk ini:\n{product_list}\n\n"
            f"Nama item '{nama_item}' paling cocok ke produk mana?\n"
            "Return JSON SAJA:\n"
            '{"product_id": "uuid atau null", '
            '"product_name": "nama atau null", '
            '"confidence": 0.0}\n'
            "Jika tidak ada yang cocok: confidence = 0"
        )

        result = self._ask_gemini(prompt)
        if not result:
            return self._unresolved(nama_item)

        confidence = float(result.get("confidence", 0))
        product_id = result.get("product_id")
        product_name = result.get("product_name")

        if confidence >= 0.8 and product_id:
            try:
                supabase.table("product_aliases").upsert(
                    {
                        "tenant_id": tenant_id,
                        "product_id": product_id,
                        "alias_name": nama_item,
                        "source": "ai",
                        "confidence": confidence,
                    },
                    on_conflict="tenant_id,alias_name",
                ).execute()
            except Exception as e:
                logger.warning(f"Alias save failed: {e}")

            return {
                "product_id": product_id,
                "product_name": product_name,
                "confidence": confidence,
                "source": "ai_auto",
                "needs_confirmation": False,
            }

        suggestions = []
        if product_id and confidence > 0:
            suggestions = [
                {"product_id": product_id, "name": product_name, "confidence": confidence}
            ]

        return {
            "product_id": None,
            "product_name": None,
            "confidence": confidence,
            "source": "ai_low_confidence",
            "needs_confirmation": True,
            "suggestions": suggestions,
        }

    def _get_products(self, tenant_id: str, supabase) -> list:
        resp = (
            supabase.table("products")
            .select("id, name, category")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .limit(200)
            .execute()
        )
        return getattr(resp, "data", None) or []

    def _ask_gemini(self, prompt: str) -> Optional[dict]:
        if not self.api_key:
            return None
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 256},
        }
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(self.api_url, json=payload)
                resp.raise_for_status()
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                text = re.sub(r"```json\s*|```\s*", "", text).strip()
                return json.loads(text)
        except Exception as e:
            logger.warning(f"Gemini alias error: {e}")
            return None

    @staticmethod
    def _unresolved(nama_item: str) -> dict:
        return {
            "product_id": None,
            "product_name": nama_item,
            "confidence": 0.0,
            "source": "unresolved",
            "needs_confirmation": True,
            "suggestions": [],
        }


alias_service = AliasService()
