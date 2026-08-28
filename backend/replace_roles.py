import os

routers_dir = r'c:\folder fix\backend\routers'

akuntan_files = ['transactions.py', 'reports.py', 'payables.py', 'budget.py', 'products.py', 'employees.py', 'price_tracking.py', 'insights.py']
gizi_files = ['compliance.py', 'legal.py', 'recipes.py', 'nutrition.py']
both_files = ['mbg.py', 'schedules.py']

for root, _, files in os.walk(routers_dir):
    for f in files:
        if not f.endswith('.py'): continue
        path = os.path.join(root, f)
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        orig_content = content
        if f in akuntan_files:
            content = content.replace('"kasir"', '"akuntan"')
            content = content.replace("'kasir'", "'akuntan'")
            if f == 'employees.py':
                content = content.replace('["owner", "admin"]', '["owner", "admin", "akuntan"]')
                content = content.replace("['owner', 'admin']", "['owner', 'admin', 'akuntan']")
        elif f in gizi_files:
            content = content.replace('"kasir"', '"gizi"')
            content = content.replace("'kasir'", "'gizi'")
            if f in ['recipes.py', 'nutrition.py']:
                content = content.replace('["owner", "admin"]', '["owner", "admin", "gizi"]')
                content = content.replace("['owner', 'admin']", "['owner', 'admin', 'gizi']")
        elif f in both_files:
            content = content.replace('"kasir"', '"akuntan", "gizi"')
            content = content.replace("'kasir'", "'akuntan', 'gizi'")
            
        # specifically fix driver depart arrive in mbg.py if it was affected
        
        if orig_content != content:
            with open(path, 'w', encoding='utf-8') as file:
                file.write(content)
            print(f'Updated {f}')
