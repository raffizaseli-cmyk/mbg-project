import os
import sys

sys.path.append(os.path.join(os.getcwd(), "backend"))
from services.unit_chain_service import UnitChainService, CycleDetectedError

print("=== 1. TEST LINEAR CHAIN (Telur: 4 Karung = 10 Dus = 9 Pcs = 25 Gram) ===")
chains_1 = [
    {"from_qty": 4, "from_unit": "karung", "to_qty": 10, "to_unit": "dus"},
    {"from_qty": 1, "from_unit": "dus", "to_qty": 9, "to_unit": "pcs"},
    {"from_qty": 1, "from_unit": "pcs", "to_qty": 25, "to_unit": "gram"},
]
res_1 = UnitChainService.resolve_all_units(chains_1)
print("Is Valid:", res_1["is_valid"])
for r in res_1["resolved_units"]:
    print(f"  * {r['unit']}: {r['weight_gram']}g | Path: {r['path']} | Status: {r['status']}")

assert res_1["is_valid"] is True
karung_w = next(r["weight_gram"] for r in res_1["resolved_units"] if r["unit"] == "karung")
dus_w = next(r["weight_gram"] for r in res_1["resolved_units"] if r["unit"] == "dus")
pcs_w = next(r["weight_gram"] for r in res_1["resolved_units"] if r["unit"] == "pcs")
assert karung_w == 562.5, f"Expected 562.5, got {karung_w}"
assert dus_w == 225.0, f"Expected 225.0, got {dus_w}"
assert pcs_w == 25.0, f"Expected 25.0, got {pcs_w}"
print("OK Test 1 Passed! (Karung = 562.5g, Dus = 225g, Pcs = 25g)\n")


print("=== 2. TEST CYCLE DETECTION (A -> B -> A) ===")
chains_cycle = [
    {"from_qty": 1, "from_unit": "dus", "to_qty": 10, "to_unit": "pcs"},
    {"from_qty": 1, "from_unit": "pcs", "to_qty": 0.1, "to_unit": "dus"},
]
res_cycle = UnitChainService.resolve_all_units(chains_cycle)
print("Has Cycle:", res_cycle["has_cycle"])
print("Errors:", res_cycle["errors"])
assert res_cycle["has_cycle"] is True
print("OK Test 2 Passed! Cycle detected correctly.\n")


print("=== 3. TEST DEAD-END CHAIN (Karung -> Dus, without anchor) ===")
chains_dead = [
    {"from_qty": 1, "from_unit": "karung", "to_qty": 10, "to_unit": "dus"},
]
res_dead = UnitChainService.resolve_all_units(chains_dead)
print("Is Valid:", res_dead["is_valid"])
for r in res_dead["resolved_units"]:
    print(f"  * {r['unit']}: {r['weight_gram']}g | Status: {r['status']}")
assert all(r["is_connected"] is False for r in res_dead["resolved_units"])
print("OK Test 3 Passed! Dead-end flagged correctly.\n")


print("=== 4. TEST METRIC ANCHOR (1 Dus = 20 Pack, 1 Pack = 500 g) ===")
chains_metric = [
    {"from_qty": 1, "from_unit": "dus", "to_qty": 20, "to_unit": "pack"},
    {"from_qty": 1, "from_unit": "pack", "to_qty": 500, "to_unit": "gram"},
]
res_metric = UnitChainService.resolve_all_units(chains_metric)
for r in res_metric["resolved_units"]:
    print(f"  * {r['unit']}: {r['weight_gram']}g | Path: {r['path']}")
dus_m = next(r["weight_gram"] for r in res_metric["resolved_units"] if r["unit"] == "dus")
assert dus_m == 10000.0, f"Expected 10000.0, got {dus_m}"
print("OK Test 4 Passed! Metric anchor resolved to 10.000g.\n")

print("ALL 4 UNIT CHAIN ENGINE TESTS PASSED PERFECTLY!")
