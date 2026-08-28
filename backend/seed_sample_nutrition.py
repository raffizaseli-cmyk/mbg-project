#!/usr/bin/env python3
"""
Quick test: Insert sample nutrition data to verify database and UI work
"""
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Sample nutrition data (common foods)
sample_foods = [
    {"name": "Nasi Putih", "kategori": "biji-bijian", "calories": 130, "proteins": 2.7, "fat": 0.3, "carbohydrate": 28, "data_source": "SAMPLE"},
    {"name": "Telur Ayam", "kategori": "telur", "calories": 155, "proteins": 13.3, "fat": 11, "carbohydrate": 1.1, "data_source": "SAMPLE"},
    {"name": "Ayam Tanpa Kulit", "kategori": "daging-unggas", "calories": 165, "proteins": 31, "fat": 3.6, "carbohydrate": 0, "data_source": "SAMPLE"},
    {"name": "Ikan Bandeng", "kategori": "ikan", "calories": 100, "proteins": 20, "fat": 1.3, "carbohydrate": 0, "data_source": "SAMPLE"},
    {"name": "Tahu", "kategori": "kacang-kacangan", "calories": 76, "proteins": 8, "fat": 4.7, "carbohydrate": 1.9, "data_source": "SAMPLE"},
    {"name": "Tempe", "kategori": "kacang-kacangan", "calories": 195, "proteins": 19.3, "fat": 8.8, "carbohydrate": 7.7, "data_source": "SAMPLE"},
    {"name": "Sayur Bayam", "kategori": "sayuran", "calories": 23, "proteins": 2.4, "fat": 0.4, "carbohydrate": 3.7, "data_source": "SAMPLE"},
    {"name": "Wortel", "kategori": "sayuran", "calories": 41, "proteins": 0.9, "fat": 0.2, "carbohydrate": 10, "data_source": "SAMPLE"},
    {"name": "Pisang", "kategori": "buah", "calories": 89, "proteins": 1.1, "fat": 0.3, "carbohydrate": 23, "data_source": "SAMPLE"},
    {"name": "Apel", "kategori": "buah", "calories": 52, "proteins": 0.3, "fat": 0.2, "carbohydrate": 14, "data_source": "SAMPLE"},
]

print(f"Inserting {len(sample_foods)} sample foods...")

try:
    response = supabase.table("nutrition_ref").upsert(sample_foods).execute()
    print(f"✅ Success! Inserted {len(response.data)} rows")
    
    # Verify
    resp = supabase.table("nutrition_ref").select("id", count="exact").execute()
    print(f"Total rows in database: {resp.count}")
    
except Exception as e:
    print(f"❌ Error: {str(e)[:200]}")
    exit(1)
