from backend.scripts.tkpi_ingestion_utils import filter_new_foods, normalize_food_name


def test_filter_new_foods_skips_existing_names_case_insensitively():
    existing_names = {"nasi putih", "ayam goreng"}
    items = [
        {"name": "Nasi Putih", "calories": 130, "custom_nutrients": {"air_g": 70}},
        {"name": "Ayam Goreng", "calories": 240, "custom_nutrients": {"air_g": 60}},
        {"name": "Sayur Bayam", "calories": 30, "custom_nutrients": {"air_g": 90}},
    ]

    new_items, skipped = filter_new_foods(items, existing_names)

    assert [item["name"] for item in new_items] == ["Sayur Bayam"]
    assert skipped == 2


def test_normalize_food_name_trims_and_lowercases():
    assert normalize_food_name("  Nasi Putih  ") == "nasi putih"


def test_filter_new_foods_keeps_items_that_need_refresh_when_custom_nutrients_empty():
    existing_names = {"nasi putih"}
    items = [
        {"name": "Nasi Putih", "calories": 130, "custom_nutrients": {}},
        {"name": "Sayur Bayam", "calories": 30, "custom_nutrients": {"air_g": 90}},
    ]

    new_items, skipped = filter_new_foods(items, existing_names)

    assert [item["name"] for item in new_items] == ["Nasi Putih", "Sayur Bayam"]
    assert skipped == 0
