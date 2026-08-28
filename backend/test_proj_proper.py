import asyncio
from core.database import get_supabase
from routers.products import get_stock_projection
from models.user import UserInDB

user=UserInDB(id="dummy", tenant_id="d6014971-0d73-41a0-9319-dcf48e13a2d0", role="admin")
try:
    res=get_stock_projection(days=7, current_user=user)
    print("Success:", res.get("success"))
except Exception as e:
    import traceback
    traceback.print_exc()
