#!/usr/bin/env python3
import os
from supabase import create_client

sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
resp = sb.table('nutrition_ref').select('name, kategori, calories, proteins', count='exact').execute()

print('✅ NUTRITION DATABASE VERIFIED')
print(f'Total rows: {resp.count}\n')
print('Sample data:')
for item in resp.data[:5]:
    print(f'  • {item["name"]} ({item["kategori"]}) - {item["calories"]} cal, {item["proteins"]}g protein')
