import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('backend/.env')
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

tenant_id = 'd6014971-0d73-41a0-9319-dcf48e13a2d0'
menu_name = 'mbg dua'

prod_resp = (
    supabase.table("products")
    .select("id, name, unit")
    .eq("tenant_id", tenant_id)
    .eq("category", "produk_jadi")
    .eq("is_active", True)
    .ilike("name", f"%{menu_name}%")
    .execute()
)
products = getattr(prod_resp, "data", None) or []
print("Found products:", products)

if products:
    product = products[0]
    product_id = product["id"]
    print("Checking recipes for:", product_id)
    try:
        bom_resp = (
            supabase.table("recipes")
            .select("qty_needed, unit, products!ingredient_id(name)")
            .eq("tenant_id", tenant_id)
            .eq("menu_id", product_id)
            .execute()
        )
        bom_rows = getattr(bom_resp, "data", None) or []
        print("bom_rows:", bom_rows)
    except Exception as e:
        print("ERROR IN RECIPES QUERY:", e)
