import os
import sys
import requests
from datetime import date, timedelta
from decimal import Decimal
from supabase import create_client
from dotenv import load_dotenv

# Path base directory c:\folder fix\
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(BASE_DIR) == 'backend':
    ENV_PATH = os.path.join(BASE_DIR, ".env")
else:
    ENV_PATH = os.path.join(BASE_DIR, "backend", ".env")

load_dotenv(ENV_PATH)

def patch_receivables(simulate=True):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env")
        return

    # Using requests directly for PATCH to bypass PGRST204 schema cache issues
    supabase = create_client(url, key)
    
    print(f"--- Receivables Patch (March 2026) | Mode: {'SIMULATION' if simulate else 'LIVE UPDATE'} ---")
    
    # 1. Fetch March deliveries
    start_date = "2026-03-01"
    end_date = "2026-03-31"
    
    del_resp = supabase.table("mbg_deliveries").select("*, schools(name, school_level)").gte("delivery_date", start_date).lte("delivery_date", end_date).execute()
    deliveries = del_resp.data or []
    by_date = {}
    for d in deliveries:
        dt = d["delivery_date"]
        by_date.setdefault(dt, []).append(d)
        
    # 2. Fetch MBG Receivables
    recv_resp = supabase.table("receivables").select("*").eq("debtor_name", "Pemerintah - MBG").gte("created_at", start_date).execute()
    receivables = recv_resp.data or []
    
    print(f"Found {len(receivables)} MBG records to analyze.\n")
    print(f"{'Date':<12} | {'Old Amount':<15} | {'New (Bahan Only)':<15} | {'Diff':<15}")
    print("-" * 65)
    
    total_old = 0
    total_new = 0
    
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    for r in sorted(receivables, key=lambda x: x["created_at"]):
        r_id = r["id"]
        r_date = r["created_at"][:10]
        old_amt = float(r["amount"])
        
        day_dels = by_date.get(r_date, [])
        if not day_dels:
            print(f"{r_date:<12} | {old_amt:>15,.0f} | {'No Deliv Found':<15} | {'--':<15}")
            continue
            
        p_sd = sum(d["portions_sent"] for d in day_dels if (d.get("schools") or {}).get("school_level") == "sd_smp")
        p_tk = sum(d["portions_sent"] for d in day_dels if (d.get("schools") or {}).get("school_level") == "paud_tk")
        
        new_amt = (p_sd * 10000) + (p_tk * 8000)
        total_old += old_amt
        total_new += new_amt
        
        diff = new_amt - old_amt
        print(f"{r_date:<12} | {old_amt:>15,.0f} | {new_amt:>15,.0f} | {diff:>+15,.0f}")
        
        if not simulate:
            payload = {
                "amount": float(new_amt),
                "component_bahan": float(new_amt),
                "component_ops": 0.0,
                "component_insentif": 0.0,
                "status": "recorded"
            }
            # cURL equivalent PATCH
            patch_url = f"{url}/rest/v1/receivables?id=eq.{r_id}"
            resp = requests.patch(patch_url, headers=headers, json=payload)
            if resp.status_code not in (200, 201, 204):
                print(f"   ⚠️ Error patching {r_id}: {resp.status_code} {resp.text}")
                
            # Budget Allocations Update
            alloc_url = f"{url}/rest/v1/mbg_budget_allocations?date=eq.{r_date}"
            resp = requests.patch(alloc_url, headers=headers, json={"budget_bahan": float(new_amt)})
            if resp.status_code not in (200, 201, 204):
                print(f"   ⚠️ Error patching allocation {r_date}: {resp.status_code} {resp.text}")

    print("-" * 65)
    print(f"{'TOTAL':<12} | {total_old:>15,.0f} | {total_new:>15,.0f} | {total_new - total_old:>+15,.0f}")
    
    if simulate:
        print("\n✅ Simulation complete. No changes made to Database.")
    else:
        print("\n✅ LIVE UPDATE Complete.")

if __name__ == "__main__":
    is_live = "--live" in sys.argv
    patch_receivables(simulate=not is_live)
