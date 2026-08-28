"""
Role matrix documentation — mapping endpoint ke role yang diizinkan.
Ini adalah dokumentasi saja (tidak dieksekusi di runtime).
Pemakaian role checking menggunakan require_role() dari core/dependencies.py

Contoh pemakaian di router:

─── Owner only ───
@router.delete("/{id}",
    dependencies=[Depends(require_role(["owner"]))])
def delete_transaction(id: str):
    pass


─── Owner + Admin + Kasir (yang bisa input) ───
@router.post("/from-photo",
    dependencies=[
        Depends(require_role(["owner","admin","kasir"]),
        Depends(photo_upload_limiter)
    ])
def upload_photo():
    pass


─── Semua role termasuk viewer (read-only) ───
@router.get("/",
    dependencies=[Depends(require_role(["owner","admin","kasir","viewer"]))])
def get_transactions():
    pass


─── Owner + Admin saja (tidak kasir) ───
@router.put("/{id}",
    dependencies=[Depends(require_role(["owner","admin"]))])
def update_product(id: str):
    pass
"""

ROLE_PERMISSIONS = {
    # ─── Transactions ───
    "POST /transactions": ["owner", "admin", "kasir"],
    "PUT /transactions/{id}": ["owner", "admin"],
    "DELETE /transactions/{id}": ["owner"],
    "GET /transactions": ["owner", "admin", "kasir", "viewer"],
    "GET /transactions/{id}": ["owner", "admin", "kasir", "viewer"],
    "POST /transactions/from-photo": ["owner", "admin", "kasir"],
    "POST /transactions/from-photo-batch": ["owner", "admin", "kasir"],
    "GET /transactions/confirm-photo/{batch_id}": ["owner", "admin", "kasir"],
    
    # ─── Products ───
    "POST /products": ["owner", "admin"],
    "PUT /products/{id}": ["owner", "admin"],
    "DELETE /products/{id}": ["owner"],
    "GET /products": ["owner", "admin", "kasir", "viewer"],
    "POST /products/{id}/adjust-stock": ["owner", "admin"],
    
    # ─── Recipes / BOM ───
    "POST /recipes": ["owner", "admin"],
    "PUT /recipes/{id}": ["owner", "admin"],
    "DELETE /recipes/{id}": ["owner", "admin"],
    "GET /recipes": ["owner", "admin", "kasir", "viewer"],
    
    # ─── Periods (closing) ───
    "POST /periods": ["owner"],
    "PUT /periods/{id}": ["owner"],
    "POST /periods/{id}/lock": ["owner"],
    "DELETE /periods/{id}": ["owner"],
    "GET /periods": ["owner", "admin", "viewer"],
    
    # ─── Reports & Export ───
    "GET /reports/daily": ["owner", "admin", "viewer"],
    "GET /reports/weekly": ["owner", "admin", "viewer"],
    "GET /reports/period/{period_id}": ["owner", "admin", "viewer"],
    "POST /exports/excel": ["owner", "admin"],
    "GET /excel/download/{year}/{month}": ["owner", "admin", "viewer"],
    "POST /excel/regenerate/{year}/{month}": ["owner"],
    
    # ─── MBG Khusus ───
    "POST /mbg/schools": ["owner", "admin"],
    "PUT /mbg/schools/{id}": ["owner", "admin"],
    "DELETE /mbg/schools/{id}": ["owner"],
    "POST /mbg/weekly-menus": ["owner", "admin", "kasir"],
    "PUT /mbg/weekly-menus/{id}": ["owner", "admin", "kasir"],
    "GET /mbg/weekly-menus": ["owner", "admin", "kasir", "viewer"],
    "POST /mbg/deliveries": ["owner", "admin", "kasir"],
    "PUT /mbg/deliveries/{id}": ["owner", "admin"],
    "GET /mbg/deliveries": ["owner", "admin", "kasir", "viewer"],
    "POST /mbg/allocation-settings": ["owner"],
    "PUT /mbg/allocation-settings": ["owner"],
    "GET /mbg/allocation-settings": ["owner", "admin", "viewer"],
    
    # ─── Suppliers ───
    "POST /suppliers": ["owner", "admin"],
    "PUT /suppliers/{id}": ["owner", "admin"],
    "DELETE /suppliers/{id}": ["owner"],
    "GET /suppliers": ["owner", "admin", "kasir", "viewer"],
    
    # ─── Audit & Settings ───
    "GET /audit-log": ["owner"],
    "GET /settings": ["owner", "admin"],
    "PUT /settings": ["owner"],
}
