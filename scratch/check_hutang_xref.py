import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("backend/.env")
url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(url, key)

print("=" * 80)
print("CROSS-REFERENCE: Hutang Transactions vs Payables")
print("=" * 80)

trx_resp = supabase.table("transactions").select(
    "id, ref_number, nama_toko, total, payment_method, payment_status, status, date, tenant_id"
).eq("status", "confirmed").eq("payment_method", "hutang").execute()
hutang_trx = trx_resp.data or []

pay_resp = supabase.table("payables").select("id, transaction_id, amount, status").execute()
payables = pay_resp.data or []
payable_trx_ids = {p["transaction_id"] for p in payables if p.get("transaction_id")}

missing = []
matched = []
for trx in hutang_trx:
    tid = trx["id"]
    if tid in payable_trx_ids:
        matched.append(trx)
    else:
        missing.append(trx)

print(f"Total hutang transactions: {len(hutang_trx)}")
print(f"  [OK] Has payable record: {len(matched)}")
print(f"  [X]  MISSING payable:    {len(missing)}")

if missing:
    print("-" * 80)
    print("TRANSAKSI HUTANG YANG TIDAK PUNYA PAYABLE:")
    print("-" * 80)
    for i, trx in enumerate(missing, 1):
        print(f"  {i}. Trx ID        : {trx['id']}")
        print(f"     Tanggal       : {trx.get('date')}")
        print(f"     Toko          : {trx.get('nama_toko') or '(kosong)'}")
        print(f"     Total         : {trx.get('total')}")
        print(f"     payment_status: {trx.get('payment_status')}")
        print(f"     Tenant ID     : {trx.get('tenant_id')}")

# Also check why the user said:
# "2.hutang di web tidak tercatat dari nota web mapping (maksudnya setelah konfirmasi nota dari seluruh sistem itu tidak tercatat ke web hutang)"
# Let's inspect where in the web app "hutang" is viewed!
print("\n" + "=" * 80)
print("PAYABLES BY TENANT:")
print("=" * 80)
p_all = supabase.table("payables").select("id, tenant_id, supplier_name, amount, status, created_at, transaction_id").execute()
for p in (p_all.data or []):
    print(f"  Tenant: {p['tenant_id']} | Toko: {p.get('supplier_name')} | Rp {p.get('amount')} | Status: {p.get('status')} | Trx: {p.get('transaction_id')}")
