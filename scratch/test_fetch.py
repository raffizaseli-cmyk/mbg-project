import requests
from bs4 import BeautifulSoup
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except:
    pass

page_num = 5
no1 = (page_num - 2) * 40 + 1
no2 = (page_num - 1) * 40
page_url = f"https://www.andrafarm.com/_andra.php?_i=daftar-tkpi&perhal=40&no1={no1}&no2={no2}&kk={page_num}"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
)

try:
    print(f"Fetching page {page_num} URL: {page_url}...")
    resp = requests.get(page_url, headers={"User-Agent": USER_AGENT}, timeout=15)
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    rows = soup.find_all('tr')
    
    candidate_rows = []
    for idx, row in enumerate(rows):
        cols = row.find_all(['td', 'th'])
        if len(cols) >= 28 and cols[0].text.strip().isdigit():
            candidate_rows.append((idx, len(cols), [c.text.strip() for c in cols]))
            
    print(f"Number of food rows: {len(candidate_rows)}")
    for i, (idx, num_cols, col_texts) in enumerate(candidate_rows[:5]):
        print(f"  - No: {col_texts[0]}, Code: {col_texts[1]}, Name: {col_texts[2].encode('ascii', 'replace').decode('ascii')}")
            
except Exception as e:
    print(f"Error: {e}")
