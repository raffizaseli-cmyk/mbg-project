#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup

url = 'https://www.andrafarm.com/_andra.php?_i=daftar-tkpi'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

resp = requests.get(url, headers=headers)
soup = BeautifulSoup(resp.content, 'html.parser')

# Check for scripts with data
scripts = soup.find_all('script')
print(f'Script tags: {len(scripts)}\n')

for i, s in enumerate(scripts):
    text = s.string
    if text and 'data' in text.lower() and len(text) > 50:
        print(f'Script {i} (data-related):')
        preview = text[:200].replace('\n', ' ')
        print(f'  {preview}...\n')
        if i > 3:
            break

# Check for specific table ids/classes
print('\nTables:')
for table in soup.find_all('table')[:5]:
    class_attr = table.get('class', [])
    id_attr = table.get('id', '')
    rows = len(table.find_all('tr'))
    print(f'  Class: {class_attr}, ID: {id_attr}, Rows: {rows}')

# Look for meta tags with data
print('\nMeta tags with data:')
for meta in soup.find_all('meta')[:5]:
    name = meta.get('name', '')
    content = meta.get('content', '')
    if ('data' in name.lower() or 'data' in content.lower()):
        print(f'  {name}: {content[:60]}')
