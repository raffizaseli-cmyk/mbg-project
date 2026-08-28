import asyncio
import json
from core.database import get_supabase

def _recipe_to_grams(r: dict, prod: dict) -> float:
    qty = float(r.get('qty_needed', 0))
    recipe_unit = (r.get('unit') or '').lower().strip()
    if recipe_unit in ('gram', 'g', 'gr'): return qty
    if recipe_unit == 'kg': return qty * 1000
    if recipe_unit in ('liter', 'l'): return qty * 1000
    if recipe_unit in ('ml', 'mililiter'): return qty
    prod_conv = float(prod.get('conversion_factor') or 1.0)
    prod_unit = (prod.get('unit') or '').lower().strip()
    if recipe_unit == prod_unit: return qty * prod_conv
    if recipe_unit in ('pcs', 'buah', 'butir', 'siung', 'lembar', 'ikat', 'biji', 'ekor', 'batang'):
        return qty * prod_conv
    return qty

async def main():
    supabase = get_supabase()
    res = supabase.table('products').select('id, name').eq('category', 'produk_jadi').execute()
    
    nut_ref_res = supabase.table('nutrition_ref').select('*').execute()
    nut_map = {str(n['id']): n for n in nut_ref_res.data}
    
    for m in res.data:
        menu_id = m['id']
        r_res = supabase.table('recipes').select('*, products!recipes_ingredient_id_fkey(*)').eq('menu_id', menu_id).execute()
        recipes = r_res.data
        
        total_cal = 0
        ingredients = []
        for r in recipes:
            if r.get('usage_type', 'per_porsi') != 'per_porsi':
                continue
            prod = r.get('products')
            if not prod: continue
            
            weight = _recipe_to_grams(r, prod)
            nut_id = prod.get('nutrition_ref_id')
            if not nut_id: continue
            nref = nut_map.get(str(nut_id))
            if not nref: continue
            
            cal = float(nref.get('calories', 0)) * (weight / 100.0)
            total_cal += cal
            if cal > 10000:
                ingredients.append({'name': prod['name'], 'cal': cal, 'weight': weight, 'r': r})
                
        if total_cal > 5000:
            print(f"Menu: {m['name']} ({menu_id}) -> Total Cal: {total_cal}")
            for i in ingredients:
                print(f"  - {i['name']}: {i['cal']} kcal (weight: {i['weight']}g)")
                print(f"    Recipe: qty={i['r']['qty_needed']}, unit={i['r']['unit']}, usage={i['r']['usage_type']}")

asyncio.run(main())
