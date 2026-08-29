import os
from supabase import Client, create_client
from core.config import settings

def get_supabase() -> Client:
    """
    Return a Supabase client instance.
    Picks the best available Supabase API key (service_role JWT or anon JWT).
    Automatically trims whitespaces and surrounding quotes.
    """
    url = (settings.supabase_url or os.getenv("SUPABASE_URL", "")).strip().strip("'\"")
    
    srv_key = (
        settings.supabase_service_key
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_KEY")
        or ""
    ).strip().strip("'\"")
    
    anon_key = (
        settings.supabase_anon_key
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip().strip("'\"")

    # If srv_key is a management token (sb_secret_...) and not a PostgREST JWT, fallback to anon_key if available
    if srv_key.startswith("sb_secret_") and anon_key.startswith("eyJ"):
        key = anon_key
    elif srv_key:
        key = srv_key
    else:
        key = anon_key

    return create_client(url, key)



















