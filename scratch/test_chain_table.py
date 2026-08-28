import os
import sys

sys.path.append(os.path.join(os.getcwd(), "backend"))
from core.database import get_supabase

supabase = get_supabase()

try:
    res = supabase.table("ingredient_unit_chains").select("id").limit(1).execute()
    print("Table ingredient_unit_chains EXISTS! Data:", res.data)
except Exception as e:
    print("Table ingredient_unit_chains does NOT exist or error:", e)
