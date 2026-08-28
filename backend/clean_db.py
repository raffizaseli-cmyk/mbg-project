import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# Delete all non-SAMPLE items
print('Deleting non-SAMPLE items...')
response = sb.table('nutrition_ref').delete().neq('data_source', 'SAMPLE').execute()
print(f'  Deleted rows: {len(response.data) if response.data else "unknown"}')

# Verify SAMPLE still there
resp = sb.table('nutrition_ref').select('id', count='exact').execute()
print(f'  Remaining items: {resp.count} (should be 25)')
