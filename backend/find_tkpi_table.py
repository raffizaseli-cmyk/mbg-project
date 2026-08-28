#!/usr/bin/env python3
"""
Find the correct table with actual TKPI data
"""
import requests
from bs4 import BeautifulSoup

url = 'https://www.andrafarm.com/_andra.php?_i=daftar-tkpi'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
resp = requests.get(url, headers=headers, timeout=10)

soup = BeautifulSoup(resp.content, 'html.parser')
tables = soup.find_all('table')

# Test each table
for table_idx, table in enumerate(tables):
    rows = table.find_all('tr')
    if len(rows) < 2:
        continue
    
    # Get second row to check data
    second_row = rows[1]
    cols = second_row.find_all('td')
    
    if len(cols) >= 6:
        # Try to parse as numbers
        try:
            col_texts = [col.get_text(strip=True) for col in cols[:6]]
            print(f"Table {table_idx}: {len(rows)} rows")
            print(f"  Columns: {col_texts}")
            
            # Check if looks like nutrition data (has numbers)
            num_count = sum(1 for c in col_texts[2:5] if c.replace(',', '.').replace('-', '').replace(' ', '').lstrip('-').replace('.', '').isdigit())
            print(f"  Numeric columns: {num_count}/3")
            
            if num_count >= 2:
                print(f"  >>> LIKELY CANDIDATE!")
                # Print a few more rows
                for i in range(min(3, len(rows)-1)):
                    row_cols = rows[i].find_all('td')
                    if len(row_cols) >= 6:
                        sample = [c.get_text(strip=True)[:15] for c in row_cols[:6]]
                        print(f"      Row {i}: {sample}")
            print()
        except:
            pass
