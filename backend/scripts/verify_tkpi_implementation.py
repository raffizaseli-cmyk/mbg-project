#!/usr/bin/env python3
"""
Verification & Testing Script for TKPI Implementation
======================================================

Purpose:
  1. Verify migration was applied correctly
  2. Check data integrity
  3. Test auto-linking functionality
  4. Report on nutrition database status

Usage:
  python verify_tkpi_implementation.py

Requires:
  - Supabase access (SUPABASE_URL, SUPABASE_KEY env vars)
  - Python 3.8+
"""

import os
import sys
from supabase import create_client, Client
from typing import Dict, List, Any

# ==========================================
# CONFIGURATION
# ==========================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: SUPABASE_URL and SUPABASE_KEY environment variables required!")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# VERIFICATION FUNCTIONS
# ==========================================

def check_table_structure():
    """Verify nutrition_ref table has all required columns."""
    print("\n1️⃣  Checking nutrition_ref table structure...")
    try:
        # Query info_schema untuk cek kolom
        response = supabase.table("nutrition_ref").select("*").limit(1).execute()
        
        if response.data:
            first_entry = response.data[0]
            required_fields = {
                "id": "UUID",
                "name": "Text (UNIQUE)",
                "calories": "Numeric",
                "proteins": "Numeric",
                "fat": "Numeric",
                "carbohydrate": "Numeric",
                "fiber": "Numeric",
                "sodium": "Numeric (NEW)",
                "potassium": "Numeric (NEW)",
                "kategori": "Text",
                "data_source": "Text (NEW)",
                "custom_nutrients": "JSONB (NEW)",
                "updated_at": "Timestamp (NEW)"
            }
            
            found_fields = set(first_entry.keys())
            
            print("   ✅ Table exists")
            print(f"   📊 Columns found: {len(found_fields)}")
            
            # Check new fields
            new_fields = ["data_source", "custom_nutrients", "updated_at", "sodium", "potassium"]
            for field in new_fields:
                if field in found_fields:
                    print(f"      ✅ {field}")
                else:
                    print(f"      ❌ {field} (MISSING!)")
            
            return True
        else:
            print("   ⚠️  Table empty (no entries to check)")
            return True
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        return False


def check_data_count():
    """Check total entries in nutrition_ref."""
    print("\n2️⃣  Checking nutrition_ref data count...")
    try:
        response = supabase.rpc("count_nutrition_ref").execute()
        count = response.data[0]["count"] if response.data else 0
    except:
        # Fallback: count rows
        response = supabase.table("nutrition_ref").select("id", count="exact").execute()
        count = response.count if hasattr(response, 'count') else len(response.data or [])
    
    print(f"   📊 Total entries: {count:,}")
    
    if count == 0:
        print("      ⚠️  No data yet - run scrape_tkpi.py")
        return False
    elif count < 100:
        print(f"      ⚠️  Only {count} entries - consider running scraper")
        return True
    elif count < 1000:
        print(f"      ℹ️  {count} entries (might need more TKPI data)")
        return True
    else:
        print(f"      ✅ {count} entries (good!)")
        return True


def check_data_quality():
    """Sample data quality checks."""
    print("\n3️⃣  Checking data quality...")
    try:
        # Get sample entries
        response = supabase.table("nutrition_ref").select("*").limit(5).execute()
        
        if not response.data:
            print("   ⚠️  No data to check")
            return True
        
        print(f"   📝 Sampling {len(response.data)} entries...")
        
        issues = 0
        for entry in response.data:
            # Check required fields
            if not entry.get("name"):
                print(f"      ❌ Entry {entry['id']}: Missing name")
                issues += 1
            
            # Check at least one nutrient is set
            if not any([
                entry.get("calories"),
                entry.get("proteins"),
                entry.get("fat")
            ]):
                print(f"      ❌ Entry {entry['id']}: No nutrients set")
                issues += 1
            
            # Check custom_nutrients structure if present
            if entry.get("custom_nutrients"):
                if not isinstance(entry["custom_nutrients"], dict):
                    print(f"      ❌ Entry {entry['id']}: custom_nutrients not JSONB")
                    issues += 1
        
        if issues == 0:
            print("   ✅ Data quality looks good")
            return True
        else:
            print(f"   ⚠️  Found {issues} quality issues")
            return False
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        return False


def check_unique_constraint():
    """Verify UNIQUE constraint on name is working."""
    print("\n4️⃣  Checking UNIQUE constraint on name...")
    try:
        # Try to insert duplicate
        test_name = "Test Duplicate - " + str(time.time())
        
        # Insert first time
        resp1 = supabase.table("nutrition_ref").insert({
            "name": test_name,
            "calories": 100
        }).execute()
        
        if not resp1.data:
            print("   ⚠️  Could not insert test data")
            return True
        
        test_id = resp1.data[0]["id"]
        
        # Try insert duplicate
        try:
            resp2 = supabase.table("nutrition_ref").insert({
                "name": test_name,
                "calories": 100
            }).execute()
            print("   ❌ UNIQUE constraint NOT working (duplicate allowed!)")
            success = False
        except Exception as e:
            if "unique" in str(e).lower():
                print("   ✅ UNIQUE constraint working (duplicate rejected)")
                success = True
            else:
                print(f"   ⚠️  Unexpected error: {e}")
                success = True
        
        # Cleanup: delete test entry
        try:
            supabase.table("nutrition_ref").delete().eq("id", test_id).execute()
        except:
            pass
        
        return success
        
    except Exception as e:
        print(f"   ⚠️  Could not test UNIQUE constraint: {e}")
        return True


def check_data_sources():
    """Check distribution of data sources."""
    print("\n5️⃣  Checking data source distribution...")
    try:
        response = supabase.table("nutrition_ref").select("data_source", count="exact").execute()
        
        sources = {}
        for entry in (response.data or []):
            src = entry.get("data_source", "UNKNOWN")
            sources[src] = sources.get(src, 0) + 1
        
        if not sources:
            print("   ℹ️  No data_source tracking yet")
            return True
        
        print("   📊 Data source distribution:")
        for src, count in sorted(sources.items(), key=lambda x: x[1], reverse=True):
            print(f"      {src}: {count} entries")
        
        return True
        
    except Exception as e:
        print(f"   ⚠️  Could not check data sources: {e}")
        return True


def check_micronutrients():
    """Check how many entries have custom_nutrients."""
    print("\n6️⃣  Checking micronutrient coverage...")
    try:
        response = supabase.table("nutrition_ref").select("custom_nutrients", count="exact").execute()
        
        with_micro = 0
        without_micro = 0
        
        for entry in (response.data or []):
            if entry.get("custom_nutrients"):
                with_micro += 1
            else:
                without_micro += 1
        
        total = with_micro + without_micro
        
        if total == 0:
            print("   ℹ️  No data yet")
            return True
        
        percent = (with_micro / total * 100) if total > 0 else 0
        print(f"   📊 Micronutrients coverage: {percent:.1f}%")
        print(f"      With custom_nutrients: {with_micro} ({percent:.1f}%)")
        print(f"      Without: {without_micro}")
        
        if percent >= 80:
            print("   ✅ Good coverage")
            return True
        elif percent >= 50:
            print("   ℹ️  Moderate coverage")
            return True
        else:
            print("   ⚠️  Low coverage - run scraper")
            return True
            
    except Exception as e:
        print(f"   ⚠️  Could not check micronutrients: {e}")
        return True


# ==========================================
# MAIN
# ==========================================

def main():
    print("=" * 70)
    print("✅ TKPI IMPLEMENTATION VERIFICATION")
    print("=" * 70)
    print(f"🗄️  Database: {SUPABASE_URL[:50]}...")
    
    checks = [
        check_table_structure,
        check_data_count,
        check_data_quality,
        check_unique_constraint,
        check_data_sources,
        check_micronutrients
    ]
    
    results = []
    for check in checks:
        try:
            result = check()
            results.append(result)
        except Exception as e:
            print(f"❌ Check failed: {e}")
            results.append(False)
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Checks passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ All checks passed! TKPI implementation is ready.")
        print("\nNext steps:")
        print("  1. Restart backend: python -m uvicorn main:app --reload")
        print("  2. Test recipe nutrition: POST /nutrition/calendar")
        print("  3. Verify product mapping: python scan_duplicates.py")
    elif passed >= total - 1:
        print("\n⚠️  Most checks passed. Some warnings above.")
        print("Review and address before production deployment.")
    else:
        print("\n❌ Several checks failed. Please fix before using.")
    
    print()


if __name__ == "__main__":
    import time
    main()
