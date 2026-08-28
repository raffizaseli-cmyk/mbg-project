import os, sys, json
from dotenv import load_dotenv
load_dotenv('.env')

from supabase import create_client
sb = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Get tenant_id from first user
res = sb.table('users').select('tenant_id').limit(1).execute()
if not res.data:
    print('No users found')
    sys.exit(0)
tid = res.data[0]['tenant_id']
print(f'Tenant ID: {tid}')

# Check master schedules
master_resp = sb.table('master_schedules').select('*').eq('tenant_id', tid).eq('is_active', True).execute()
master = master_resp.data
print(f'Active Masters: {len(master)}')
if master:
    mid = master[0]['id']
    print(f'Master ID: {mid}')
    # Check master schools
    mschools_resp = sb.table('master_schedule_schools').select('*, schools(*)').eq('master_id', mid).execute()
    mschools = mschools_resp.data
    print(f'Master Schools count: {len(mschools)}')
    total = 0
    for ms in mschools:
        s = ms.get('schools')
        if s:
            p = s.get('default_portions', 0)
            total += p
            print(f'- School: {s.get("name")}, Portions: {p}')
        else:
            print(f'- ms_entry: {ms.get("id")}, school_id: {ms.get("school_id")}, No school data joined')
    print(f'Calculated Total from Master Schools: {total}')

# Check all schools
all_schools_resp = sb.table('schools').select('name, default_portions, is_active').eq('tenant_id', tid).execute()
all_schools = all_schools_resp.data
print(f'\nAll Schools ({len(all_schools)}):')
for s in all_schools:
    print(f'- {s["name"]}: {s["default_portions"]} (active: {s["is_active"]})')
