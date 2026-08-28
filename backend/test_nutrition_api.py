import requests
import json

url = 'https://mbg-catering-production-one.up.railway.app/nutrition/search'
params = {'q': 'nasi', 'limit': 5}

try:
    resp = requests.get(url, params=params, timeout=5)
    print(f'Status: {resp.status_code}')
    if resp.status_code == 200:
        data = resp.json()
        print(f'Results: {len(data)} items found')
        for item in data[:3]:
            print(f'  - {item.get("name", "unknown")}')
    else:
        print(f'Response: {resp.text[:200]}')
except Exception as e:
    print(f'Error: {str(e)}')
