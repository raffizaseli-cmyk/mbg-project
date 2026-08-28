from typing import Any, Dict, List, Set, Tuple


def normalize_food_name(name: str) -> str:
    return (name or "").strip().lower()


def needs_refresh(item: Dict[str, Any]) -> bool:
    custom_nutrients = item.get("custom_nutrients") or {}
    if isinstance(custom_nutrients, dict):
        return not bool(custom_nutrients)
    return False


def filter_new_foods(items: List[Dict[str, Any]], existing_names: Set[str]) -> Tuple[List[Dict[str, Any]], int]:
    new_items: List[Dict[str, Any]] = []
    skipped = 0
    seen_in_batch: Set[str] = set()

    for item in items:
        normalized_name = normalize_food_name(item.get("name", ""))
        if not normalized_name:
            skipped += 1
            continue

        should_refresh = normalized_name in existing_names and needs_refresh(item)
        if should_refresh:
            new_items.append(item)
            seen_in_batch.add(normalized_name)
            continue

        if normalized_name in existing_names or normalized_name in seen_in_batch:
            skipped += 1
            continue

        seen_in_batch.add(normalized_name)
        new_items.append(item)

    return new_items, skipped
