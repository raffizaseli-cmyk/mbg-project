#!/usr/bin/env python3
"""
Quick Health Check untuk TKPI Implementation
=============================================

Purpose:
  Cepat cek apakah migration sudah berhasil di Supabase
  atau belum, sebelum run scraping script

Usage:
  python check_tkpi_readiness.py

Output:
  - Tabel migration status
  - Column check
  - Quick recommendations
"""

import os
import sys
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL atau SUPABASE_KEY tidak ditemukan di env variables")
    print("   Set dulu: $env:SUPABASE_URL = '...'; $env:SUPABASE_KEY = '...'")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("\n" + "="*60)
print("🏥 TKPI READINESS CHECK")
print("="*60 + "\n")

# Check 1: Table exists
print("1️⃣  Checking if nutrition_ref table exists...")
try:
    response = supabase.table("nutrition_ref").select("*").limit(1).execute()
    print("   ✅ Table exists\n")
    
    # Get first entry to check columns
    if response.data:
        entry = response.data[0]
        
        # Required columns
        required = ["id", "name", "calories", "proteins", "fat", "carbohydrate", "fiber"]
        optional = ["sodium", "potassium", "data_source", "custom_nutrients", "updated_at"]
        
        print("2️⃣  Checking required columns...")
        all_required_present = True
        for col in required:
            if col in entry:
                print(f"   ✅ {col}")
            else:
                print(f"   ❌ {col} MISSING")
                all_required_present = False
        
        print("\n3️⃣  Checking NEW columns (from migration)...")
        migration_status = []
        for col in optional:
            if col in entry:
                print(f"   ✅ {col}")
                migration_status.append(True)
            else:
                print(f"   ❌ {col} (not migrated yet)")
                migration_status.append(False)
        
        print("\n4️⃣  Summary...")
        if all_required_present:
            print("   ✅ Required columns OK")
        else:
            print("   ❌ Missing required columns!")
            sys.exit(1)
        
        if all(migration_status):
            print("   ✅ Migration columns present")
            print("\n" + "="*60)
            print("✨ READY! Migration was successful.")
            print("="*60)
            print("\nNext: Run scraping script")
            print("  python scrape_tkpi.py")
        else:
            print("   ❌ Migration NOT applied yet!")
            print("\n" + "="*60)
            print("⚠️  MIGRATION NEEDED")
            print("="*60)
            print("\nSteps:")
            print("  1. Go to: https://app.supabase.com → SQL Editor")
            print("  2. Copy-paste from: backend/scripts/migration_nutrition_ref_v2.sql")
            print("  3. Click 'Run'")
            print("  4. Re-run this script to verify")
            sys.exit(1)
    else:
        print("   ⚠️  Table exists but is empty")
        print("   (That's OK - will be populated by scraper)")
except Exception as e:
    print(f"   ❌ ERROR: {e}")
    print("\n   Check:")
    print("   - SUPABASE_URL is correct")
    print("   - SUPABASE_KEY is valid Service Role Key (not anon key)")
    print("   - nutrition_ref table exists in database")
    sys.exit(1)

print("\n✅ Health check complete!\n")
