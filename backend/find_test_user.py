import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# Try to find existing profiles or users
try:
    # Query profiles table
    resp = sb.table('profiles').select('id, email, full_name').limit(10).execute()
    print("Existing profiles:")
    for profile in resp.data[:5]:
        email = profile.get('email', 'N/A')
        name = profile.get('full_name', 'N/A')
        print(f"  Email: {email}, Name: {name}")
    
    if len(resp.data) == 0:
        print("  (No profiles found)")
except Exception as e:
    print(f"Cannot query profiles: {str(e)[:150]}")
