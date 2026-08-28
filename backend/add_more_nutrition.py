#!/usr/bin/env python3
"""
Add more diverse nutrition data to demonstrate system
"""
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# More diverse nutrition data
additional_foods = [
    {"name": "Daging Sapi", "kategori": "daging-sapi", "calories": 250, "proteins": 26, "fat": 15, "carbohydrate": 0, "data_source": "SAMPLE"},
    {"name": "Salmon", "kategori": "ikan", "calories": 208, "proteins": 20, "fat": 13, "carbohydrate": 0, "data_source": "SAMPLE"},
    {"name": "Brokoli", "kategori": "sayuran", "calories": 34, "proteins": 3.7, "fat": 0.4, "carbohydrate": 7, "data_source": "SAMPLE"},
    {"name": "Tomat", "kategori": "sayuran", "calories": 18, "proteins": 0.9, "fat": 0.2, "carbohydrate": 3.9, "data_source": "SAMPLE"},
    {"name": "Jeruk", "kategori": "buah", "calories": 47, "proteins": 0.7, "fat": 0.3, "carbohydrate": 12, "data_source": "SAMPLE"},
    {"name": "Mangga", "kategori": "buah", "calories": 60, "proteins": 0.8, "fat": 0.4, "carbohydrate": 15, "data_source": "SAMPLE"},
    {"name": "Susu Sapi", "kategori": "susu", "calories": 61, "proteins": 3.2, "fat": 3.3, "carbohydrate": 4.8, "data_source": "SAMPLE"},
    {"name": "Yogurt", "kategori": "susu", "calories": 59, "proteins": 10, "fat": 0.4, "carbohydrate": 3.6, "data_source": "SAMPLE"},
    {"name": "Minyak Goreng", "kategori": "minyak", "calories": 884, "proteins": 0, "fat": 100, "carbohydrate": 0, "data_source": "SAMPLE"},
    {"name": "Kacang Tanah", "kategori": "kacang-kacangan", "calories": 567, "proteins": 26, "fat": 49, "carbohydrate": 16, "data_source": "SAMPLE"},
    {"name": "Roti Gandum", "kategori": "biji-bijian", "calories": 265, "proteins": 9, "fat": 3.3, "carbohydrate": 49, "data_source": "SAMPLE"},
    {"name": "Madu", "kategori": "gula-sirup", "calories": 304, "proteins": 0.3, "fat": 0, "carbohydrate": 82, "data_source": "SAMPLE"},
    {"name": "Keju Cheddar", "kategori": "susu", "calories": 403, "proteins": 23, "fat": 33, "carbohydrate": 3.6, "data_source": "SAMPLE"},
    {"name": "Daging Ayam Giling", "kategori": "daging-unggas", "calories": 110, "proteins": 20, "fat": 3.1, "carbohydrate": 0, "data_source": "SAMPLE"},
    {"name": "Udang", "kategori": "ikan-laut", "calories": 99, "proteins": 24, "fat": 0.3, "carbohydrate": 0, "data_source": "SAMPLE"},
]

print(f"Adding {len(additional_foods)} more nutrition items...")

try:
    response = supabase.table("nutrition_ref").upsert(additional_foods).execute()
    print(f"✅ Added {len(response.data)} items")
    
    # Verify total
    resp = supabase.table("nutrition_ref").select("id", count="exact").execute()
    print(f"📊 Total nutrition items now: {resp.count}")
    
except Exception as e:
    print(f"❌ Error: {str(e)[:200]}")
    exit(1)
