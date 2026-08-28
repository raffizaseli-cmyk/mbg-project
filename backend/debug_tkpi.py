import requests
from bs4 import BeautifulSoup

url = 'https://www.andrafarm.com/_andra.php?_i=daftar-tkpi&page=1'
print(f"Fetching {url}...")

resp = requests.get(url, timeout=10)
print(f"Status: {resp.status_code}, Content length: {len(resp.content)}")

soup = BeautifulSoup(resp.content, 'html.parser')

# Find all tables
tables = soup.find_all('table')
print(f'Found {len(tables)} tables')

# Check first table
if tables:
    rows = tables[0].find_all('tr')
    print(f'First table has {len(rows)} rows')
    
    # Show headers
    headers = rows[0].find_all(['th', 'td'])
    print(f'\nHeaders ({len(headers)} cols):')
    for i, h in enumerate(headers[:10]):
        print(f"  Col {i}: {h.text.strip()[:30]}")
    
    # Show first 3 data rows
    print(f'\nFirst 3 data rows:')
    for row_idx in range(1, min(4, len(rows))):
        cols = rows[row_idx].find_all(['th', 'td'])
        print(f"  Row {row_idx}: {len(cols)} cols")
        if len(cols) > 2:
            print(f"    Col 2 (Name): {cols[2].text.strip()[:30]}")
        if len(cols) > 4:
            print(f"    Col 4 (Cals): {cols[4].text.strip()[:20]}")
