import requests
from bs4 import BeautifulSoup
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except:
    pass

TKPI_URL = "https://www.andrafarm.com/_andra.php?_i=daftar-tkpi"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
)

try:
    print(f"Fetching {TKPI_URL}...")
    resp = requests.get(TKPI_URL, headers={"User-Agent": USER_AGENT}, timeout=15)
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    links = soup.find_all('a')
    print(f"Total links: {len(links)}")
    
    # Filter links that are paginations
    for link in links:
        href = link.get('href', '')
        text = link.text.strip()
        if 'mulai=' in href or 'page=' in href or 'halaman=' in href or 'perhal=' in href:
            # check if it has page text
            if text.isdigit() or 'halaman' in text.lower() or 'next' in text.lower():
                print(f"Pagination Link: Text='{text}', Href='{href}'")
                
except Exception as e:
    print(f"Error: {e}")
