import os
from dotenv import load_dotenv
import requests

load_dotenv('C:/folder fix/backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')

r = requests.get(f"{url}/rest/v1/stock_history?limit=1", headers={
    'apikey': key,
    'Authorization': f'Bearer {key}'
})

if r.status_code == 200:
    data = r.json()
    if data:
        print("Columns in stock_history:", list(data[0].keys()))
    else:
        print("Table is empty, can't infer directly.")
else:
    print(r.text)
