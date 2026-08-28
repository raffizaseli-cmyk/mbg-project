import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(os.path.join("backend", ".env"))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

if not url or not key:
    print("No SUPABASE_URL or SUPABASE_SERVICE_KEY")
    exit(1)

supabase: Client = create_client(url, key)

try:
    r = supabase.table("nutrition_ref").select("*").execute()
    data = r.data or []
    
    print(f"Total entries in DB: {len(data)}")
    
    sources = {}
    null_custom_count = 0
    non_null_custom_count = 0
    sample_custom_nutrients = []
    
    for item in data:
        src = item.get("data_source", "UNKNOWN")
        sources[src] = sources.get(src, 0) + 1
        
        custom = item.get("custom_nutrients")
        if custom:
            non_null_custom_count += 1
            if len(sample_custom_nutrients) < 3:
                sample_custom_nutrients.append((item.get("name"), custom))
        else:
            null_custom_count += 1
            
    print("\nData sources in DB:")
    for src, count in sources.items():
        print(f"  - {src}: {count}")
        
    print(f"\nCustom nutrients stats:")
    print(f"  - Non-null custom_nutrients: {non_null_custom_count}")
    print(f"  - Null/empty custom_nutrients: {null_custom_count}")
    
    print("\nSamples with custom_nutrients:")
    for name, cust in sample_custom_nutrients:
        print(f"  - {name}: {cust}")
        
except Exception as e:
    print(f"Error: {e}")
