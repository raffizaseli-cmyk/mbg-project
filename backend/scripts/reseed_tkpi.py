#!/usr/bin/env python3
"""
TKPI Data Reseed Script
======================
Clear existing nutrition_ref data dan jalankan scraper fresh.
"""

import os
import sys
import subprocess
from supabase import create_client, Client
from dotenv import load_dotenv

# Reconfigure stdout to avoid UnicodeEncodeError on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except:
    pass

# Load env configuration
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: SUPABASE_URL dan SUPABASE_KEY tidak ditemukan!")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 70)
print("🔄 TKPI DATA RESEED")
print("=" * 70)

# Step 1: Check current state
print("\n1️⃣  Checking current nutrition_ref state...")
try:
    r = supabase.table("nutrition_ref").select("id").execute()
    total = len(r.data) if r.data else 0
    print(f"   📊 Current rows: {total}")
except Exception as e:
    print(f"   ❌ Error checking table: {e}")
    sys.exit(1)

# Step 2: Clear existing data
print("\n2️⃣  Clearing existing data...")
try:
    supabase.table("nutrition_ref").delete().gt("id", 0).execute()
    print("   ✅ Table cleared")
except Exception as e:
    print(f"   ⚠️  Warning: {e}")

# Step 3: Run scraper
print("\n2️⃣  Running scraper...")
workspace_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sub_env = os.environ.copy()
sub_env["PYTHONPATH"] = workspace_root + os.pathsep + sub_env.get("PYTHONPATH", "")

result = subprocess.run(
    [sys.executable, "scripts/scrape_tkpi.py"],
    cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    env=sub_env
)

# Step 4: Final check
print("\n3️⃣  Final count...")
try:
    r = supabase.table("nutrition_ref").select("id").execute()
    total = len(r.data) if r.data else 0
    print(f"   📊 Final rows: {total}")
    print(f"   ✅ Reseed complete!")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("=" * 70)
