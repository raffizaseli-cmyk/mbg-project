import os, sys, json
from dotenv import load_dotenv
load_dotenv('.env')

# Add backend to path for imports
sys.path.insert(0, os.getcwd())

from routers.schedules import _fetch_master_data
from core.database import get_supabase

def test():
    supabase = get_supabase()
    # Find the tenant with the schools
    res = supabase.table('schools').select('tenant_id, name').ilike('name', '%sd menur 1%').execute()
    if not res.data:
        print('No schools found matching the user list.')
        return

    tid = res.data[0]['tenant_id']
    print(f'Testing Tenant ID: {tid}')

    data = _fetch_master_data(tid)
    if data:
        print(f'Master Name: {data["name"]}')
        print(f'Total Portions: {data["total_portions"]}')
        print(f'Schools attached: {len(data["schools"])}')
        for s in data["schools"]:
            print(f'- {s["school_name"]}: {s["default_portions"]}')
    else:
        print('No master data found.')

if __name__ == '__main__':
    test()
