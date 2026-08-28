#!/usr/bin/env python3
"""
TKPI scraper with better debugging - find actual data rows
"""
import requests
from bs4 import BeautifulSoup

url = 'https://www.andrafarm.com/_andra.php?_i=daftar-tkpi'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

resp = requests.get(url, headers=headers, timeout=15)
soup = BeautifulSoup(resp.content, 'html.parser')

# Look for ALL tr elements
all_rows = soup.find_all('tr')
print(f"Total TR elements: {len(all_rows)}\n")

# Analyze patterns
for i, row in enumerate(all_rows[:30]):  # First 30 rows
    cols = row.find_all(['td', 'th'])
    
    # Check if this looks like a food data row
    # Should have ~28 columns with numeric data
    if len(cols) >= 6:
        # Get first few columns
        sample = []
        nums_found = 0
        
        for j, col in enumerate(cols[:10]):
            text = col.get_text(strip=True)[:20]
            sample.append(text)
            
            # Check if looks numeric
            try:
                float(text.replace(',', '.'))
                nums_found += 1
            except:
                pass
        
        print(f"Row {i}: {len(cols)} cols | Nums in first 10: {nums_found}")
        if len(cols) >= 6:
            print(f"  [{cols[0].get_text(strip=True)[:10]}, {cols[1].get_text(strip=True)[:10]}, {cols[2].get_text(strip=True)[:20]}]")
        
        # If this looks promising, show more
        if nums_found >= 3 and len(cols) >= 20:
            print(f"  >>> POTENTIAL DATA ROW: {len(cols)} cols with {nums_found} numeric")
            if i > 0:
                break
