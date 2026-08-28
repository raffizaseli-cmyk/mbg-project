from supabase import Client, create_client

from core.config import settings

def get_supabase() -> Client:
    """
    Return a new Supabase client instance using the service role key.
    Avoids using a singleton to prevent HTTP/2 RemoteProtocolError (stale connection).
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key,
    )



















