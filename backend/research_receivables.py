import os
import sys
from datetime import date, timedelta
from decimal import Decimal
from supabase import create_client
from dotenv import load_dotenv

# config.py ada di backend/core/ → naik 1 level ke backend/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

def cleanup():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing Supabase URL or Key!")
        return
        
    supabase = create_client(url, key)

    print("--- Researching Receivables for March 2026 ---")
    
    # 1. Get deliveries for March
    first = "2026-03-01"
    last = "2026-03-31"
    
    # Fetch mbg_deliveries with school info
    del_resp = supabase.table("mbg_deliveries").select("*, schools(name, school_level)").gte("delivery_date", first).lte("delivery_date", last).execute()
    deliveries = del_resp.data or []
    
    print(f"Found {len(deliveries)} total delivery records.")
    
    # Group deliveries by day to summarize
    by_date = {}
    for d in deliveries:
        dt = d["delivery_date"]
        by_date.setdefault(dt, []).append(d)
        
    # 2. Get receivables for March 
    # created_at must be formatted to match deliveries if they differ
    recv_resp = supabase.table("receivables").select("*").eq("debtor_name", "Pemerintah - MBG").gte("created_at", first).execute()
    receivables = recv_resp.data or []
    
    print(f"Found {len(receivables)} MBG receivables records in DB.")
    
    for r in sorted(receivables, key=lambda x: x["created_at"]):
        r_at = r["created_at"]
        r_date = r_at[:10]
        amt = float(r["amount"])
        
        # Calculate what it SHOULD BE
        day_dels = by_date.get(r_date, [])
        if not day_dels:
            print(f"Date: {r_date} ({r_at}) | Current: {amt:,.0f} | No deliveries found!")
            continue
            
        p_sd = sum(d["portions_sent"] for d in day_dels if (d.get("schools") or {}).get("school_level") == "sd_smp")
        p_tk = sum(d["portions_sent"] for d in day_dels if (d.get("schools") or {}).get("school_level") == "paud_tk")
        
        # New model: Bahan Only (10k / 8k)
        should_be = (p_sd * 10000) + (p_tk * 8000)
        
        if abs(amt - should_be) > 1:
            print(f"Date: {r_date} | CURRENT: {amt:,.0f} | SHOULD BE: {should_be:,.0f} (Mismatch! SD:{p_sd}, TK:{p_tk})")
        else:
            print(f"Date: {r_date} | Correct: {amt:,.0f}")

if __name__ == "__main__":
    cleanup()
