import os
import sys
from dotenv import load_dotenv

# Reconfigure stdout to avoid UnicodeEncodeError on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except:
    pass

# Load backend/.env
load_dotenv(os.path.join("backend", ".env"))

# Map SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY to SUPABASE_KEY if needed
if "SUPABASE_SERVICE_KEY" in os.environ and "SUPABASE_KEY" not in os.environ:
    os.environ["SUPABASE_KEY"] = os.environ["SUPABASE_SERVICE_KEY"]

print("Loaded env variables:")
print(f"  SUPABASE_URL: {os.environ.get('SUPABASE_URL')}")
print(f"  SUPABASE_KEY: {os.environ.get('SUPABASE_KEY')[:15]}...")

# Add workspace path to PYTHONPATH
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import and run scraper
from backend.scripts.scrape_tkpi import scrape_and_push_tkpi

scrape_and_push_tkpi()
