#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup

url = 'https://www.andrafarm.com/_andra.php?_i=daftar-tkpi'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
resp = requests.get(url, headers=headers, timeout=10)

soup = BeautifulSoup(resp.content, 'html.parser')

# Check table structure
tables = soup.find_all('table')
print(f'Total tables: {len(tables)}')

if len(tables) > 0:
    table = tables[0]
    rows = table.find_all('tr')
    print(f'Rows in table 0: {len(rows)}')
    
    if len(rows) > 0:
        cols = rows[0].find_all('td')
        print(f'First row: {len(cols)} cols, text: {rows[0].get_text()[:80]}')
    
    if len(rows) > 1:
        cols = rows[1].find_all('td')
        print(f'Second row: {len(cols)} cols, text: {rows[1].get_text()[:80]}')

# Look for any tables that have rows
print('\nTable analysis:')
for i, t in enumerate(tables[:5]):
    rows = t.find_all('tr')
    if rows:
        cols_count = len(rows[0].find_all(['td', 'th']))
        print(f'  Table {i}: {len(rows)} rows, {cols_count} cols')
