import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def main():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE credentials")
        return

    supabase = create_client(url, key)

    # Ambil transaksi yang sudah confirmed tapi supplier_id masih kosong dan punya nama_toko
    print("Fetching confirmed transactions without supplier_id...")
    trxs_resp = (
        supabase.table("transactions")
        .select("id, tenant_id, nama_toko")
        .eq("status", "confirmed")
        .is_("supplier_id", "null")
        .neq("nama_toko", "")
        .execute()
    )
    
    trxs = getattr(trxs_resp, "data", [])
    if not trxs:
        print("Tidak ada transaksi yang perlu di-sync.")
        return

    print(f"Ditemukan {len(trxs)} transaksi yang butuh mapping supplier.")
    
    # Ambil existing suppliers (untuk cache)
    sup_resp = supabase.table("suppliers").select("id, tenant_id, name").execute()
    existing_sups = getattr(sup_resp, "data", [])
    
    # Cache mapping: (tenant_id, name.lower()) -> supplier_id
    sup_cache = {}
    for s in existing_sups:
        key = (s["tenant_id"], s["name"].lower())
        sup_cache[key] = s["id"]
        
    updated_count = 0
    created_count = 0

    for trx in trxs:
        tenant_id = trx["tenant_id"]
        nama_toko = trx["nama_toko"].strip()
        if not nama_toko:
            continue
            
        cache_key = (tenant_id, nama_toko.lower())
        supplier_id = sup_cache.get(cache_key)
        
        # Buat supplier baru bila belum ada
        if not supplier_id:
            print(f"Creating new supplier: {nama_toko}")
            new_sup = supabase.table("suppliers").insert({
                "tenant_id": tenant_id,
                "name": nama_toko,
                "is_active": True
            }).execute()
            if getattr(new_sup, "data", None):
                supplier_id = new_sup.data[0]["id"]
                sup_cache[cache_key] = supplier_id
                created_count += 1
            else:
                print(f"Failed to create supplier {nama_toko}")
                continue
                
        # Link transaksi ke supplier_id
        supabase.table("transactions").update({
            "supplier_id": supplier_id
        }).eq("id", trx["id"]).execute()
        updated_count += 1
        
    print(f"Selesai! {created_count} supplier baru dibuat, {updated_count} transaksi ter-update.")

if __name__ == "__main__":
    main()
