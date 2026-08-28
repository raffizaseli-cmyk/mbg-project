"""
backend/services/unit_chain_service.py
Hierarchical Unit Conversion Engine (Hybrid Graph + Pre-calculated Cache).

Menyelesaikan rantai konversi bertingkat (contoh: 4 karung = 10 dus, 1 dus = 9 pcs, 1 pcs = 25 gram)
menggunakan Graph Traversal (DFS) dengan Cycle Detection dan Auto-Cache ke ingredient_unit_weights.
"""

import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from utils.unit_converter import get_base_unit, is_standard_metric

logger = logging.getLogger(__name__)


class CycleDetectedError(Exception):
    """Exception raised when a circular conversion chain is detected."""
    pass


class UnitChainService:
    @staticmethod
    def normalize_unit(unit_str: str) -> str:
        """Standardize unit string."""
        return (unit_str or "").strip().lower()

    @classmethod
    def build_graph(cls, chains: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Build Directed Adjacency List from chains list.
        graph[from_unit] = {
            "to_unit": str,
            "multiplier": float,
            "from_qty": float,
            "to_qty": float,
            "id": Optional[str],
            "description": Optional[str]
        }
        """
        graph: Dict[str, Dict[str, Any]] = {}
        for c in chains:
            from_u = cls.normalize_unit(c.get("from_unit"))
            to_u = cls.normalize_unit(c.get("to_unit"))
            from_q = float(c.get("from_qty") or 1.0)
            to_q = float(c.get("to_qty") or 1.0)
            
            if from_q <= 0:
                from_q = 1.0
            if to_q <= 0:
                to_q = 1.0

            mult = float(c.get("multiplier") or (to_q / from_q))

            if from_u and to_u:
                graph[from_u] = {
                    "to_unit": to_u,
                    "multiplier": mult,
                    "from_qty": from_q,
                    "to_qty": to_q,
                    "id": c.get("id"),
                    "description": c.get("description"),
                }
        return graph

    @classmethod
    def resolve_chain_to_base(
        cls,
        start_unit: str,
        graph: Dict[str, Dict[str, Any]],
        visited: Optional[Set[str]] = None,
        depth: int = 0,
        max_depth: int = 20,
    ) -> Tuple[float, str, List[str], bool]:
        """
        DFS Traversal to resolve a unit to absolute base weight (gram / ml / pcs).
        Returns:
            (weight_in_base, base_unit, traversal_path, is_connected_to_base)
        """
        if visited is None:
            visited = set()

        curr_unit = cls.normalize_unit(start_unit)

        # 1. Absolute Base Units (Cannot have outgoing edges, always terminal)
        if curr_unit in ["gram", "g", "gr"]:
            return 1.0, "gram", [curr_unit], True
        if curr_unit in ["ml", "cc"]:
            return 1.0, "ml", [curr_unit], True

        # 2. Cycle Detection
        if curr_unit in visited:
            raise CycleDetectedError(
                f"Terdeteksi siklus konversi memutar pada satuan: '{curr_unit}'"
            )

        if depth > max_depth:
            raise CycleDetectedError("Kedalaman konversi melebihi batas maksimum (kemungkinan loop)")

        # 3. If unit has a defined chain edge in graph, follow the chain
        if curr_unit in graph:
            visited.add(curr_unit)
            edge = graph[curr_unit]
            next_u = edge["to_unit"]
            multiplier = edge["multiplier"]

            next_factor, base_u, path, is_connected = cls.resolve_chain_to_base(
                next_u, graph, visited.copy(), depth + 1, max_depth
            )

            full_path = [curr_unit] + path
            if is_connected and next_factor > 0:
                total_weight = multiplier * next_factor
                return total_weight, base_u, full_path, True
            return 0.0, "unresolved", full_path, False

        # 4. Terminal Fallbacks (when unit is NOT in graph)
        if is_standard_metric(curr_unit):
            base_u, factor = get_base_unit(curr_unit)
            return factor, base_u, [curr_unit], True

        if curr_unit in ["pcs", "pc", "buah", "butir", "biji"]:
            return 1.0, "pcs", [curr_unit], True

        # Dead-end unit
        return 0.0, "unresolved", [curr_unit], False

    @classmethod
    def resolve_all_units(
        cls, chains: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Resolves all units in the chain graph.
        Returns detailed summary with resolved weights, status flags, and cycle validation.
        """
        graph = cls.build_graph(chains)
        all_units = set(graph.keys())
        for edge in graph.values():
            all_units.add(edge["to_unit"])

        resolved_units: List[Dict[str, Any]] = []
        errors: List[str] = []
        has_cycle = False

        for unit in sorted(all_units):
            try:
                weight, base_u, path, is_connected = cls.resolve_chain_to_base(unit, graph)
                resolved_units.append({
                    "unit": unit,
                    "weight_gram": round(weight, 4) if base_u == "gram" else (round(weight, 4) if is_connected else 0.0),
                    "weight_in_base": round(weight, 4),
                    "base_unit": base_u,
                    "path": " -> ".join(path),
                    "is_connected": is_connected,
                    "status": "valid" if is_connected else "unresolved",
                })
            except CycleDetectedError as ce:
                has_cycle = True
                err_msg = str(ce)
                errors.append(err_msg)
                resolved_units.append({
                    "unit": unit,
                    "weight_gram": 0.0,
                    "weight_in_base": 0.0,
                    "base_unit": "error",
                    "path": unit,
                    "is_connected": False,
                    "status": "cycle_error",
                    "error": err_msg,
                })

        return {
            "is_valid": (not has_cycle) and len(errors) == 0,
            "has_cycle": has_cycle,
            "errors": errors,
            "resolved_units": resolved_units,
            "graph": graph,
        }

    @classmethod
    def sync_to_weights_cache(
        cls,
        ingredient_id: str,
        resolved_units: List[Dict[str, Any]],
        supabase: Any,
    ) -> List[Dict[str, Any]]:
        """
        Upserts all valid resolved units into ingredient_unit_weights table (O(1) cache).
        """
        synced: List[Dict[str, Any]] = []
        for ru in resolved_units:
            if ru.get("is_connected") and ru.get("weight_gram", 0) > 0:
                unit_name = ru["unit"]
                weight_val = ru["weight_gram"]
                desc = f"Rantai: {ru.get('path', '')}"

                payload = {
                    "ingredient_id": ingredient_id,
                    "unit": unit_name,
                    "weight_gram": weight_val,
                    "source": "chain_resolved",
                    "description": desc,
                }
                try:
                    res = (
                        supabase.table("ingredient_unit_weights")
                        .upsert(payload, on_conflict="ingredient_id, unit")
                        .execute()
                    )
                    if getattr(res, "data", None):
                        synced.append(res.data[0])
                except Exception as e:
                    logger.warning(
                        f"Gagal upsert cache ingredient_unit_weights untuk '{unit_name}': {e}"
                    )
        return synced


unit_chain_service = UnitChainService()
