# ⚡ QUICK WINS - Implementasi 2-3 Minggu (50% Pengurangan Effort)

> **Strategi**: Fokus pada automation yang memberikan ROI tertinggi dengan coding effort minimal

---

## 🥇 QUICK WIN #1: Smart Supplier Auto-Complete (2 hari)
**Current Manual Input**: 30 detik per supplier  
**After**: 5 detik (6x lebih cepat)  
**Implementation**: ADD endpoint + UI tweak

### Yang Harus Dikerjakan:

**1. Backend Endpoint** (`backend/routers/suppliers.py`):
```python
@router.get("/search", response_model=List[Dict])
async def search_suppliers(
    q: str = Query(..., min_length=2),
    current_user: UserInDB = Depends(get_current_user),
):
    """Search suppliers by name (ILIKE)"""
    sb = get_supabase()
    
    resp = sb.table('suppliers').select('id, nama').ilike(
        'nama', f'%{q}%'
    ).eq('tenant_id', current_user.tenant_id).limit(5).execute()
    
    return [{"id": s['id'], "nama": s['nama']} for s in resp.data]
```

**2. Bot Handler** (`bot/handlers/belanja_handler.py`):
- Ganti `input_supplier` state dari text input → interactive buttons
- Ketika user ketik supplier name, call `/suppliers/search?q={name}`
- Tampilkan buttons dengan suggestions dari history
- User klik buton → confirm supplier, lanjut ke items

**3. Testing**: Verifikasi typo/duplikat berkurang

### Effort: 2 jam coding + testing  
### Files: 2 files modify

---

## 🥈 QUICK WIN #2: Auto-Fill Last Purchased Items (1 hari)
**Current**: Input items dari 0 setiap transaksi  
**After**: Pre-filled 80% dari last transaction ke supplier yang sama  
**Implementation**: Simple query + context manager

### Yang Harus Dikerjakan:

**1. Backend Query** (`backend/routers/transactions.py`):
```python
@router.get("/last-supplier-items/{supplier_id}")
async def get_last_supplier_items(
    supplier_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Get items dari last transaction to this supplier"""
    sb = get_supabase()
    
    resp = sb.table('transaction_items').select(
        '*, transactions(supplier_id, created_at)'
    ).eq('transactions.supplier_id', supplier_id).eq(
        'transactions.tenant_id', current_user.tenant_id
    ).order('transactions.created_at', desc=True).limit(1).execute()
    
    if not resp.data:
        return []
    
    last_transaction = resp.data[0]
    return [
        {
            "product_id": item['product_id'],
            "product_name": item.get('product', {}).get('nama'),
            "qty": item['qty'],
            "satuan": item['satuan'],
            "harga_terakhir": item['harga_satuan']
        }
        for item in last_transaction['transaction_items']
    ]
```

**2. Bot Handler Update** (`bot/handlers/belanja_handler.py`):
```python
async def input_items(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    supplier_id = context.user_data.get("manual_supplier_id")
    
    # Get last items dari supplier ini
    api = get_api_client()
    resp = api.get(
        f"/transactions/last-supplier-items/{supplier_id}",
        headers={"Authorization": f"Bearer {get_token(context)}"}
    )
    
    last_items = resp.json()['data'] if resp.status_code == 200 else []
    
    if last_items:
        # Tampilkan: "Apakah Anda mau pakai items terakhir kali?"
        context.user_data["last_items"] = last_items
        
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Pakai Items Terakhir", callback_data="use_last_items")],
            [InlineKeyboardButton("✏️ Input Manual", callback_data="input_items_manual")],
        ])
        
        items_text = "\n".join([f"• {item['product_name']} {item['qty']} {item['satuan']} @ Rp{item['harga_terakhir']:,}" 
                               for item in last_items])
        
        await update.message.reply_text(
            f"Items terakhir ke {supplier_id}:\n{items_text}\n\nGunakan ulang?",
            reply_markup=kb
        )
        return CONFIRM_ITEMS
    else:
        # Manual input
        await update.message.reply_text("Ketik items (format: Nama Qty Satuan Harga per baris):")
        return INPUT_ITEMS
```

### Effort: 1.5 jam  
### Files: 2 files

---

## 🥉 QUICK WIN #3: Daily Restock Alert (1 hari)
**Current**: Manual check stok setiap hari  
**After**: Otomatis alert pagi hari if stok mau habis  
**Implementation**: Simple cron job

### Yang Harus Dikerjakan:

**1. Backend Service** (`backend/services/stok_alert_service.py`):
```python
def check_low_stock(tenant_id: str) -> List[str]:
    """Cek produk yang stok < minimum"""
    sb = get_supabase()
    
    resp = sb.table('products').select('*').eq(
        'tenant_id', tenant_id
    ).lt('stok_quantity', 'stok_minimum').execute()
    
    return [
        f"⚠️ {p['nama']}: {p['stok_quantity']} {p['satuan_jual']} (min: {p['stok_minimum']})"
        for p in resp.data
    ]
```

**2. Telegram Bot Scheduler** (`bot/` atau `backend/workers/`):
```python
# Jalankan setiap jam 7 pagi
async def daily_stok_alert(context: ContextTypes.DEFAULT_TYPE):
    from backend.services.stok_alert_service import check_low_stock
    
    sb = get_supabase()
    
    # Ambil semua tenants
    tenants_resp = sb.table('tenants').select('id').execute()
    
    for tenant in tenants_resp.data:
        low_stock = check_low_stock(tenant['id'])
        
        if low_stock:
            # Ambil owner/admin telegram IDs
            users = sb.table('users').select('telegram_id').eq(
                'tenant_id', tenant['id']
            ).in_('role', ['owner', 'admin']).execute()
            
            message = "🔴 STOK RENDAH:\n\n" + "\n".join(low_stock)
            
            for user in users.data:
                await context.bot.send_message(
                    chat_id=user['telegram_id'],
                    text=message
                )

# Setup scheduler (di main.py bot)
from telegram.ext import Application

app = Application.builder().token(TOKEN).build()
app.job_queue.run_daily(daily_stok_alert, time=datetime.time(hour=7, minute=0))
```

### Effort: 1 jam  
### Files: 1 file + update main.py

---

## 💎 QUICK WIN #4: Pre-fill Menu dari Minggu Lalu (1 hari)
**Current**: Input menu dari 0 setiap minggu  
**After**: Auto-copy menu minggu lalu, tinggal edit kalau ada yang berbeda  
**Implementation**: Simple copy query + handler

### Yang Harus Dikerjakan:

**1. Bot Handler Update** (`bot/handlers/menu_handler.py`):
```python
async def menu_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry /menu - suggest copy dari last week"""
    
    api = get_api_client()
    token = get_token(context)
    
    # Get last week menu
    last_week_date = (date.today() - timedelta(days=7)).isoformat()
    
    resp = api.get(
        f"/menus/week?date={last_week_date}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code == 200 and resp.json().get('data'):
        last_week_menu = resp.json()['data']
        
        # Tampilkan: copy atau buat baru?
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("📋 Copy Minggu Lalu", callback_data="menu_copy_last_week")],
            [InlineKeyboardButton("✏️ Input Manual", callback_data="menu_manual")],
        ])
        
        menu_text = "Menu minggu lalu:\n" + "\n".join([
            f"{day}: {menu.get('menu_name', '-')}"
            for day, menu in last_week_menu.items()
        ])
        
        await update.effective_message.reply_text(
            f"{menu_text}\n\nGunakan ulang minggu ini?",
            reply_markup=kb
        )
        
        context.user_data["last_week_menu"] = last_week_menu
        return CONFIRM_MENU_COPY
    else:
        return await show_week_grid(update, context)

async def confirm_menu_copy(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    api = get_api_client()
    token = get_token(context)
    
    # Copy last week menu ke minggu ini
    last_week_menu = context.user_data.get("last_week_menu", {})
    
    for day, menu_data in last_week_menu.items():
        # POST /menus/week dengan copy data
        resp = api.post(
            "/menus/day",
            json={
                "date": (date.today() + timedelta(days=(list(last_week_menu.keys()).index(day)))).isoformat(),
                "menu_name": menu_data['menu_name'],
                "bom_id": menu_data.get('bom_id'),
            },
            headers={"Authorization": f"Bearer {token}"}
        )
    
    await query.edit_message_text("✅ Menu minggu lalu di-copy!")
    return ConversationHandler.END
```

### Effort: 1.5 jam  
### Files: 1-2 files

---

## 🎯 IMPLEMENTASI URUTAN (3 Minggu)

### Minggu 1: Quick Wins #1 & #2
- **Monday-Tuesday**: Supplier auto-complete (endpoint + bot)
- **Wednesday-Thursday**: Last items pre-fill (query + handler)
- **Friday**: Testing & bugfix

**Impact**: Belanja entry time: 5 min → 2 menit (60% faster)

### Minggu 2: Quick Win #3 & #4
- **Monday**: Daily stok alert job
- **Tuesday-Wednesday**: Menu copy-from-last-week
- **Thursday**: Testing & refinement
- **Friday**: Deploy + monitor

**Impact**: Stok management manual work: 80% → 30%

### Minggu 3: Polish & Optimization
- **Monday-Wednesday**: Handle edge cases
- **Thursday**: Performance optimization
- **Friday**: User training + rollout

**Total Impact**: 60% manual → 35-40% manual ✅

---

## 📊 Comparison Matrix

| Task | Before | After | Time Save | Effort* |
|------|--------|-------|-----------|---------|
| 1. Supplier Entry | 30s (typing + confirm) | 5s (suggestion click) | 25s | 2h |
| 2. Items Entry | 3 min (typing all) | 30s (click confirm) | 2.5 min | 1.5h |
| 3. Daily Stok Check | 5 min (manual check) | 0 (auto alert) | 5 min | 1h |
| 4. Menu Weekly | 20 min (input 5 hari) | 3 min (copy + edit) | 17 min | 1.5h |
| **TOTAL** | **~28 min/day** | **~8.5 min/day** | **~70%** | **~6h** |

*Coding effort dalam hours

---

## 🔥 Why These Quick Wins?

1. **High ROI**: Kecil effort, besar impact
2. **No Database Migration**: Hanya query add, data schema tidak berubah
3. **Low Risk**: Mostly UI/UX improvements, backend logic simple
4. **User-Facing**: Immediate productivity boost
5. **Foundation**: Persiapan untuk Fase 2 (more complex automation)

---

## ⚙️ Technical Stack (No New Dependencies)

- ✅ FastAPI query optimization (simple `.select()`)
- ✅ PostgreSQL `.ilike()` for search
- ✅ Telegram keyboard InlineButton
- ✅ Python APScheduler (already in requirements)

**Zero breaking changes**, 100% backward compatible

---

## 📈 Success Metrics (After 3 Weeks)

| Metric | Before | After | Target Hit? |
|--------|--------|-------|------------|
| Manual input time/day | 28 min | 8.5 min | ✅ 70% reduction |
| Supplier typo/week | ~10 | ~2 | ✅ 80% reduction |
| Out-of-stock alerts/week | Manual check | Auto alert | ✅ 100% coverage |
| Menu consistency/week | 70% | 95% | ✅ Better quality |

---

## 🚀 Phase 2 (After Quick Wins)

Setelah quick wins jalan baik, bisa lanjut ke:
- Recurring pattern detection (smart suggest belanja)
- OCR improvement dengan alias matching
- Predictive portions based on consumption
- Bulk CSV import untuk master data

Lihat `AUTOMATION_STRATEGY.md` untuk detail Phase 2-5.
