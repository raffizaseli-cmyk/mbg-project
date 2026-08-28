# 🤖 Strategi Otomasi Input Manual - Roadmap Implementasi

**Status**: Saat ini 60% input manual → Target 30% input manual (50% pengurangan)

## 📊 Analisis Input Manual vs Otomatis

### Saat Ini:
| Fitur | Input Manual | Otomatis | Effort |
|-------|-------------|----------|--------|
| Foto Nota | ✅ Upload foto | ✅ OCR via Gemini | 40% |
| Belanja Manual | ✅ Ketik items | ❌ Tidak ada saran | 30% |
| Menu Minggu | ✅ Ketik per hari | ❌ Tidak ada template | 20% |
| Serah Harian | ✅ Input portions | ❌ Tidak prediktif | 15% |
| Master Data | ✅ Manual entry web | ❌ Tidak bulk import | 10% |
| **TOTAL** | **60%** | **40%** | |

---

## 🎯 FASE 1: SMART AUTO-COMPLETION (2 minggu untuk koding)
**Implikasi**: Kurangi typo 80% + input time 40%

### 1.1 Supplier & Produk Auto-Complete
**File**: `bot/handlers/belanja_handler.py` + `backend/routers/suppliers.py`

**Masalah Saat Ini**:
- User mengetik nama supplier & item setiap kali → typo, duplikat
- Tidak ada suggestion dari history
- Format parsing fragile (bisa salah parsing)

**Solusi**:
```python
# Tambahan di bot/handlers/belanja_handler.py

async def get_supplier_suggestions(
    context: ContextTypes.DEFAULT_TYPE,
    partial_name: str,
    limit: int = 5
) -> List[str]:
    """
    GET /suppliers/search?q=partial_name&limit=5
    Return: ["Toko A", "Toko B", ...]
    """
    token = get_token(context)
    api = get_api_client()
    
    resp = api.get(
        "/suppliers/search",
        params={"q": partial_name.lower(), "limit": limit},
        headers={"Authorization": f"Bearer {token}"}
    )
    if resp.status_code == 200:
        return resp.json()["data"]  # Format: [{"nama": "...", "id": "..."}, ...]
    return []

async def get_product_suggestions(
    context: ContextTypes.DEFAULT_TYPE,
    partial_name: str,
    limit: int = 5
) -> List[str]:
    """
    GET /products/search?q=partial_name&limit=5
    Return: [{"nama": "Beras Merah", "satuan": "kg", "last_price": 12000}, ...]
    """
    token = get_token(context)
    api = get_api_client()
    
    resp = api.get(
        "/products/search",
        params={"q": partial_name.lower(), "limit": limit, "with_prices": True},
        headers={"Authorization": f"Bearer {token}"}
    )
    if resp.status_code == 200:
        return resp.json()["data"]
    return []

# Ubah state INPUT_SUPPLIER menjadi interactive:
async def input_supplier(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    
    if text.lower() == "/skip":
        context.user_data["manual_supplier"] = None
        return await proceed_to_items(update, context)
    
    # 🆕 Dapatkan suggestion
    suggestions = await get_supplier_suggestions(context, text)
    
    if suggestions:
        # Tampilkan InlineKeyboard dengan suggestions
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton(s["nama"], callback_data=f"supplier:{s['id']}")] 
            for s in suggestions
        ] + [
            [InlineKeyboardButton(f"✏️ {text} (ketik manual)", callback_data="supplier:manual")]
        ])
        
        await update.message.reply_text(
            "Supplier yang ditemukan:\n(tekan tombol atau /skip)",
            reply_markup=kb
        )
        context.user_data["manual_supplier_partial"] = text
        return INPUT_SUPPLIER
    else:
        # Terima input manual
        context.user_data["manual_supplier"] = text
        return await proceed_to_items(update, context)
```

**Backend Endpoint** (`backend/routers/suppliers.py`):
```python
# 🆕 Tambahan endpoint untuk search
@router.get("/search", response_model=List[SupplierSearchResult])
async def search_suppliers(
    q: str = Query(..., min_length=2),
    limit: int = Query(5, le=10),
    current_user: UserInDB = Depends(get_current_user),
) -> List[SupplierSearchResult]:
    """
    PG Full-text search pada suppliers table dengan tenant_id filter
    """
    sb = get_supabase()
    
    # Escape untuk FTS:
    q_safe = q.replace("'", "''")
    
    resp = sb.rpc(
        "search_suppliers_fts",
        {
            "p_search": q_safe,
            "p_tenant_id": current_user.tenant_id,
            "p_limit": limit,
        }
    ).execute()
    
    return resp.data  # Format: [{"id": "...", "nama": "...", "last_transaction": "..."}]
```

**Database** (Supabase RLS + FTS):
```sql
-- Fungsi PostgreSQL untuk search
CREATE OR REPLACE FUNCTION search_suppliers_fts(
  p_search TEXT,
  p_tenant_id UUID,
  p_limit INT DEFAULT 5
) RETURNS TABLE (id UUID, nama TEXT, last_transaction TIMESTAMP) AS $$
  SELECT 
    id, 
    nama, 
    MAX(created_at) as last_transaction
  FROM suppliers
  WHERE tenant_id = p_tenant_id
    AND (nama ILIKE '%' || p_search || '%'
         OR to_tsvector('indonesian', nama) @@ plainto_tsquery('indonesian', p_search))
  GROUP BY id, nama
  ORDER BY last_transaction DESC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE;

-- Trigger untuk update stok_ledger searchable index
CREATE TRIGGER update_product_fts_index
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION tsvector_update_trigger('search_text', 'pg_catalog.english', nama, alias);
```

**Impact**:
- ⚡ Supplier entry: 30 sec → 5 sec
- ✅ 80% kurangi typo
- 📈 Lebih konsisten data

---

### 1.2 Smart Item Parser dengan Alias Matching
**File**: `backend/services/alias_service.py` (sudah ada, enhance)

**Masalah**: 
- Parse `"Beras 10 kg 12000"` bisa salah jika format tidak tepat
- OCR output `"Beras Putih Premium"` vs manual `"Beras"`" → duplikat item
- Unit konversi tidak konsisten (kg vs gram)

**Solusi**:
```python
# backend/services/alias_service.py - ENHANCE

class AliasService:
    def __init__(self, sb: Client):
        self.sb = sb
        self.cache = {}  # {tenant_id: {alias: canonical_id, ...}}
    
    def match_item(
        self,
        tenant_id: str,
        input_name: str,
        strict: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Match input name terhadap product master dengan fuzzy matching.
        
        Returns: {
            "product_id": "...",
            "nama_product": "Beras Merah",
            "satuan": "kg",
            "confidence": 0.95,
            "is_exact": True
        }
        """
        from difflib import get_close_matches
        
        input_name_lower = input_name.lower().strip()
        
        # 1️⃣ Exact match dari alias table
        resp = self.sb.table('product_aliases').select('product_id, products(*)').eq(
            'alias_lower', input_name_lower
        ).eq('tenant_id', tenant_id).single().execute()
        
        if resp.data:
            return {
                "product_id": resp.data['product_id'],
                "nama_product": resp.data['products']['nama'],
                "satuan": resp.data['products']['satuan_jual'],
                "confidence": 1.0,
                "is_exact": True
            }
        
        # 2️⃣ Ambil semua product names dari cache atau DB
        if tenant_id not in self.cache:
            prod_resp = self.sb.table('products').select('id, nama, satuan_jual').eq(
                'tenant_id', tenant_id
            ).eq('is_active', True).execute()
            
            self.cache[tenant_id] = {
                p['nama'].lower(): p for p in prod_resp.data
            }
        
        product_names = list(self.cache[tenant_id].keys())
        
        # 3️⃣ Fuzzy match dengan cutoff 0.6
        matches = get_close_matches(
            input_name_lower,
            product_names,
            n=1,
            cutoff=0.6
        )
        
        if matches:
            matched_prod = self.cache[tenant_id][matches[0]]
            confidence = self._calculate_similarity(input_name_lower, matches[0])
            return {
                "product_id": matched_prod['id'],
                "nama_product": matched_prod['nama'],
                "satuan": matched_prod['satuan_jual'],
                "confidence": confidence,
                "is_exact": False
            }
        
        return None
    
    def _calculate_similarity(self, s1: str, s2: str) -> float:
        """Levenshtein similarity 0-1"""
        from difflib import SequenceMatcher
        return SequenceMatcher(None, s1, s2).ratio()

# Gunakan di belanja_handler.py:
async def input_items(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    lines = update.message.text.strip().split('\n')
    items = []
    
    api = get_api_client()
    token = get_token(context)
    alias_svc = AliasService(get_supabase())  # Atau ambil dari cache
    
    for line in lines:
        if line.strip() == '/selesai':
            break
        
        parsed = _parse_item_line(line)
        if not parsed:
            await update.message.reply_text(f"❌ Format salah: {line}")
            continue
        
        # Smart match item name
        match = alias_svc.match_item(
            tenant_id=get_tenant_id(context),
            input_name=parsed['nama_item']
        )
        
        if match and match['confidence'] > 0.7:
            parsed['product_id'] = match['product_id']
            parsed['nama_item_matched'] = match['nama_product']
            parsed['confidence'] = match['confidence']
            items.append(parsed)
        elif match and match['confidence'] > 0.5:
            # Tanya user confirm
            await update.message.reply_text(
                f"Apakah \"{parsed['nama_item']}\" = \"{match['nama_product']}\"?\n"
                f"Confidence: {match['confidence']:.0%}",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("✅ Ya", callback_data=f"item_match:{...}"),
                    InlineKeyboardButton("❌ Tidak", callback_data=f"item_skip:{...}"),
                ]])
            )
        else:
            # Item baru → tanya user buat atau skip
            await update.message.reply_text(
                f"Item \"{parsed['nama_item']}\" tidak ada di master.\n"
                f"Buat baru atau skip?",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("➕ Buat Baru", callback_data=f"item_new:{...}"),
                    InlineKeyboardButton("⏭️ Skip", callback_data=f"item_skip:{...}"),
                ]])
            )
    
    context.user_data["manual_items"] = items
    # ... lanjut ke konfirmasi
```

**Impact**:
- ✅ Item parsing accuracy: 70% → 95%
- 🧠 OCR + manual input unified
- 📉 Duplikat item berkurang 60%

---

## 🎯 FASE 2: RECURRING TRANSACTIONS & SMART SUGGESTIONS (2 minggu)
**Implikasi**: Otomasi 40% dari belanja rutin

### 2.1 Detect Recurring Suppliers & Suggest
**File**: `backend/services/` + `bot/handlers/belanja_handler.py`

**Masalah**:
- Supplier yang sama (mis: Toko Maju) datang setiap minggu
- User harus ketik ulang setiap kali
- Tidak ada pattern recognition

**Solusi**:
```python
# backend/services/recurring_service.py (🆕)

class RecurringService:
    def __init__(self, sb: Client):
        self.sb = sb
    
    def analyze_patterns(
        self,
        tenant_id: str,
        days_back: int = 90,
        min_occurrences: int = 3
    ) -> List[RecurringPattern]:
        """
        Analisis transaksi 90 hari terakhir, cari pattern.
        
        Returns: [
            {
                "pattern_id": "...",
                "supplier_id": "...",
                "supplier_name": "Toko Maju",
                "frequency": "weekly",  # weekly, biweekly, monthly
                "typical_day": "Jumat",  # Day dengan transaksi paling sering
                "typical_items": [      # Items yang selalu dibeli
                    {"product_id": "...", "qty": 10, "satuan": "kg", "frequency": "2/3"}
                ],
                "typical_total": 150000,
                "confidence": 0.85
            }
        ]
        """
        from datetime import datetime, timedelta
        import statistics
        
        # Ambil transaksi 90 hari terakhir
        cutoff = datetime.now() - timedelta(days=days_back)
        
        resp = self.sb.table('transactions').select(
            '*, supplier_id, transaction_items(*)'
        ).eq('tenant_id', tenant_id).gte('created_at', cutoff.isoformat()).execute()
        
        transactions = resp.data
        
        # Group by supplier
        by_supplier = {}
        for trx in transactions:
            supp_id = trx.get('supplier_id')
            if not supp_id:
                continue
            
            if supp_id not in by_supplier:
                by_supplier[supp_id] = []
            by_supplier[supp_id].append(trx)
        
        patterns = []
        
        for supp_id, supp_transactions in by_supplier.items():
            if len(supp_transactions) < min_occurrences:
                continue
            
            # Hitung interval antar transaksi
            dates = sorted([datetime.fromisoformat(t['created_at']).date() 
                           for t in supp_transactions])
            intervals = [
                (dates[i+1] - dates[i]).days 
                for i in range(len(dates) - 1)
            ]
            
            avg_interval = statistics.mean(intervals)
            std_interval = statistics.stdev(intervals) if len(intervals) > 1 else 0
            
            # Tentukan frequency
            if avg_interval < 8:
                frequency = "weekly"
            elif avg_interval < 18:
                frequency = "biweekly"
            else:
                frequency = "monthly"
            
            # Kumpulkan items yang paling sering
            item_counts = {}
            for trx in supp_transactions:
                for item in trx.get('transaction_items', []):
                    prod_id = item['product_id']
                    if prod_id not in item_counts:
                        item_counts[prod_id] = {'qty': [], 'satuan': None, 'count': 0}
                    
                    item_counts[prod_id]['qty'].append(item['qty'])
                    item_counts[prod_id]['satuan'] = item['satuan']
                    item_counts[prod_id]['count'] += 1
            
            typical_items = [
                {
                    "product_id": prod_id,
                    "qty": statistics.mean(data['qty']),
                    "satuan": data['satuan'],
                    "frequency": f"{data['count']}/{len(supp_transactions)}"
                }
                for prod_id, data in item_counts.items()
                if data['count'] >= len(supp_transactions) * 0.5  # Minimal 50% dari transaksi
            ]
            
            # Confidence = consistency dari interval + items
            interval_consistency = 1 - min(std_interval / avg_interval, 1) if avg_interval > 0 else 0
            item_consistency = len(typical_items) / len(item_counts) if item_counts else 0
            confidence = (interval_consistency + item_consistency) / 2
            
            supp_name = next(
                (t.get('supplier', {}).get('nama') for t in supp_transactions if t.get('supplier')),
                'Unknown'
            )
            
            if confidence > 0.5:  # Hanya pattern yang cukup confident
                patterns.append({
                    "pattern_id": f"{supp_id}_{frequency}",
                    "supplier_id": supp_id,
                    "supplier_name": supp_name,
                    "frequency": frequency,
                    "typical_day": dates[-1].strftime("%A"),  # Last transaction day
                    "typical_items": typical_items,
                    "typical_total": statistics.mean([t['total'] for t in supp_transactions]),
                    "confidence": confidence
                })
        
        return patterns

    def suggest_today(self, tenant_id: str) -> List[Dict]:
        """
        Cek hari ini, apakah ada supplier yang biasanya transaksi?
        
        Contoh output:
        [
            {
                "supplier_name": "Toko Maju",
                "confidence": 0.85,
                "suggested_items": [...]
            }
        ]
        """
        from datetime import datetime
        
        patterns = self.analyze_patterns(tenant_id)
        today_name = datetime.now().strftime("%A")
        
        suggestions = [
            p for p in patterns 
            if p['typical_day'] == today_name or p['frequency'] == 'daily'
        ]
        
        return sorted(suggestions, key=lambda x: x['confidence'], reverse=True)
```

**Bot Integration** (`bot/handlers/belanja_handler.py`):
```python
async def belanja_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point /belanja - ENHANCED dengan suggested recurring"""
    
    if not _can_input(context):
        await update.effective_message.reply_text("❌ Hanya owner, admin, kasir...")
        return ConversationHandler.END
    
    # 🆕 Cek apakah ada recurring pattern untuk hari ini
    recurring_svc = RecurringService(get_supabase())
    suggestions = recurring_svc.suggest_today(get_tenant_id(context))
    
    if suggestions:
        # Tampahin suggested suppliers
        top_suggestion = suggestions[0]
        
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton(
                f"✅ {top_suggestion['supplier_name']} ({top_suggestion['confidence']:.0%})",
                callback_data=f"recurring_supplier:{top_suggestion['supplier_id']}"
            )],
            [InlineKeyboardButton(
                "➕ Input Baru",
                callback_data="belanja_input_new"
            )]
        ])
        
        await update.effective_message.reply_text(
            f"📋 Biasanya Anda belanja dari supplier ini hari {today_name}?\n"
            f"Atau input baru?",
            reply_markup=kb
        )
        
        context.user_data["recurring_suggestions"] = suggestions
        return CONFIRM_RECURRING
    else:
        # Proceed normal
        return await belanja_entry_normal(update, context)

# Handle saat user pilih recurring supplier
async def confirm_recurring(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    if query.data.startswith("recurring_supplier:"):
        supplier_id = query.data.split(":")[1]
        
        # Load suggested items dari pattern
        recurring_svc = RecurringService(get_supabase())
        patterns = recurring_svc.analyze_patterns(get_tenant_id(context))
        
        pattern = next((p for p in patterns if p['supplier_id'] == supplier_id), None)
        if not pattern:
            await query.edit_message_text("❌ Pattern not found")
            return ConversationHandler.END
        
        # Prepare items
        items = []
        for item in pattern['typical_items']:
            items.append({
                "product_id": item['product_id'],
                "qty": item['qty'],
                "satuan": item['satuan'],
                "harga_satuan": 0,  # Will update dari last transaction
                "quantity": item['qty']
            })
        
        context.user_data["manual_supplier"] = pattern['supplier_name']
        context.user_data["manual_items"] = items
        context.user_data["from_recurring"] = True
        
        # Tanya user: OK dengan suggested items atau edit?
        await query.edit_message_text(
            "✅ Suggested items:\n" + 
            "\n".join([f"• {i['product_id']} x {i['qty']} {i['satuan']}" 
                      for i in items]),
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("✅ Lanjut", callback_data="confirm_items"),
                InlineKeyboardButton("✏️ Edit", callback_data="edit_items"),
            ]])
        )
        
        return CONFIRM_BELANJA
```

**Impact**:
- ⚡ Recurring transaksi: 3 min → 30 sec
- 🎯 40% dari belanja routine jadi auto-filled
- 📊 Pattern recognition buat prediksi stok

---

### 2.2 Restock Suggestions Berdasarkan Consumption Rate
**File**: `backend/services/` + `bot/handlers/`

**Masalah**:
- Tidak ada prediksi kapan harus restock
- Manual cek stok terus
- Bisa kehabisan atau overstock

**Solusi**:
```python
# backend/services/inventory_service.py (🆕)

class InventoryService:
    def __init__(self, sb: Client):
        self.sb = sb
    
    def calculate_consumption_rate(
        self,
        tenant_id: str,
        product_id: str,
        days: int = 30
    ) -> Dict[str, float]:
        """
        Hitung konsumsi produk per hari dari transaction_items.
        
        Returns: {
            "avg_daily_consumption": 5.2,   # kg/hari
            "total_consumed": 156,          # kg dalam 30 hari
            "trend": "increasing",          # increasing, stable, decreasing
            "trend_pct": 1.15               # 15% naik dibanding periode sebelumnya
        }
        """
        from datetime import datetime, timedelta
        
        cutoff = datetime.now() - timedelta(days=days)
        
        # Sum qty dari transaction_items
        resp = self.sb.rpc(
            "calc_consumption_rate",
            {
                "p_tenant_id": tenant_id,
                "p_product_id": product_id,
                "p_days": days,
            }
        ).execute()
        
        if not resp.data:
            return {
                "avg_daily_consumption": 0,
                "total_consumed": 0,
                "trend": "no_data",
                "trend_pct": 0
            }
        
        result = resp.data[0]
        
        # Bandingkan dengan periode sebelumnya
        resp2 = self.sb.rpc(
            "calc_consumption_rate",
            {
                "p_tenant_id": tenant_id,
                "p_product_id": product_id,
                "p_days": days,
                "p_offset_days": days,  # Period sebelumnya
            }
        ).execute()
        
        prev_rate = resp2.data[0]['avg_daily_consumption'] if resp2.data else 0
        curr_rate = result['avg_daily_consumption']
        
        if prev_rate > 0:
            trend_pct = curr_rate / prev_rate
            trend = "increasing" if trend_pct > 1.1 else ("decreasing" if trend_pct < 0.9 else "stable")
        else:
            trend = "new_product"
            trend_pct = 0
        
        return {
            "avg_daily_consumption": curr_rate,
            "total_consumed": result['total_consumed'],
            "trend": trend,
            "trend_pct": trend_pct
        }
    
    def suggest_restock(
        self,
        tenant_id: str,
        product_id: str,
        current_stock: float,
        safety_days: int = 7  # Safety stock untuk 7 hari
    ) -> Optional[RestockSuggestion]:
        """
        Beri saran restock jika stok akan habis dalam X hari.
        
        Returns: {
            "should_restock": True,
            "reason": "stock_will_run_out",  # stock_will_run_out, below_minimum, trending_up
            "days_until_empty": 4,
            "urgency": "HIGH",
            "suggested_qty": 75,  # UOM: kg/liter/etc
            "estimated_cost": 900000,
            "from_supplier": {"id": "...", "nama": "Toko Maju", "last_price": 12000}
        }
        """
        # Hitung ready
        consumption = self.calculate_consumption_rate(tenant_id, product_id, days=30)
        
        daily_consumption = consumption['avg_daily_consumption']
        if daily_consumption == 0:
            return None  # No consumption data
        
        # Kapan akan habis?
        days_until_empty = current_stock / daily_consumption if daily_consumption > 0 else float('inf')
        
        # Ambil product info
        resp = self.sb.table('products').select('*').eq('id', product_id).single().execute()
        product = resp.data
        
        if not product:
            return None
        
        min_stock = product.get('stok_minimum', 10)
        
        should_restock = False
        reason = None
        urgency = "LOW"
        
        if days_until_empty < safety_days:
            should_restock = True
            reason = "stock_will_run_out"
            urgency = "HIGH" if days_until_empty < 3 else "MEDIUM"
        elif current_stock < min_stock:
            should_restock = True
            reason = "below_minimum"
            urgency = "MEDIUM"
        elif consumption['trend'] == "increasing" and consumption['trend_pct'] > 1.2:
            should_restock = True
            reason = "trending_up"
            urgency = "MEDIUM"
        
        if not should_restock:
            return None
        
        # Suggested quantity = 30 hari consumption
        suggested_qty = max(daily_consumption * 30, product.get('qty_beli_minimum', 10))
        
        # Dari supplier mana? Ambil last transaction
        item_resp = self.sb.table('transaction_items').select(
            'transactions(supplier_id, supplier:suppliers(nama))'
        ).eq('product_id', product_id).eq('transactions.tenant_id', tenant_id).order(
            'transactions.created_at', desc=True
        ).limit(1).execute()
        
        last_supplier = None
        if item_resp.data:
            last_supplier = item_resp.data[0]['transactions']['supplier']
        
        return {
            "should_restock": True,
            "reason": reason,
            "days_until_empty": round(days_until_empty, 1),
            "urgency": urgency,
            "suggested_qty": round(suggested_qty, 2),
            "estimated_cost": round(suggested_qty * product.get('harga_terakhir', 0)),
            "from_supplier": last_supplier,
            "product_name": product['nama'],
            "satuan": product['satuan_jual'],
        }
    
    def get_all_restock_suggestions(
        self,
        tenant_id: str
    ) -> List[RestockSuggestion]:
        """
        Get semua product yang perlu restock hari ini.
        Sorted by urgency.
        """
        # Ambil stok semua product
        resp = self.sb.table('products').select('id, nama, stok_quantity').eq(
            'tenant_id', tenant_id
        ).eq('is_active', True).execute()
        
        suggestions = []
        
        for product in resp.data:
            sugg = self.suggest_restock(
                tenant_id=tenant_id,
                product_id=product['id'],
                current_stock=product['stok_quantity'],
                safety_days=7
            )
            
            if sugg:
                suggestions.append(sugg)
        
        # Sort by urgency
        urgency_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        suggestions.sort(key=lambda x: (urgency_order.get(x['urgency'], 3), x['days_until_empty']))
        
        return suggestions
```

**Daily Restock Notification** (`bot/handlers/` atau cron):
```python
# bot/utils/scheduler.py atau backend worker

async def send_daily_restock_reminder(context: ContextTypes.DEFAULT_TYPE):
    """
    Jalankan setiap pagi jam 7.00 untuk setiap tenant.
    Kirim restock suggestions ke admin/owner Telegram.
    """
    from backend.services.inventory_service import InventoryService
    
    sb = get_supabase()
    inv_svc = InventoryService(sb)
    
    # Ambil semua tenants
    tenants_resp = sb.table('tenants').select('id, name').execute()
    
    for tenant in tenants_resp.data:
        suggestions = inv_svc.get_all_restock_suggestions(tenant['id'])
        
        if not suggestions:
            continue
        
        # Ambil owner/admin Telegram IDs
        users_resp = sb.table('users').select('telegram_id').eq(
            'tenant_id', tenant['id']
        ).in_('role', ['owner', 'admin']).execute()
        
        for suggestion in suggestions:
            message = f"""🔴 RESTOCK URGENT: {suggestion['product_name']}

Stok saat ini: {suggestion['suggested_qty']} {suggestion['satuan']}
Akan habis dalam: {suggestion['days_until_empty']} hari
Urgency: {suggestion['urgency']}

Suggested qty: {suggestion['suggested_qty']} {suggestion['satuan']}
Estimated cost: Rp {suggestion['estimated_cost']:,}

Supplier: {suggestion['from_supplier']['nama']}"""
            
            # Kirim ke telegram
            for user in users_resp.data:
                await context.bot.send_message(
                    chat_id=user['telegram_id'],
                    text=message,
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("📝 Input Belanja", callback_data="belanja_entry"),
                        InlineKeyboardButton("❌ Dismiss", callback_data="dismiss"),
                    ]])
                )
```

**Impact**:
- 📉 Stok management: reduce 50% manual checking
- ⚠️ Out-of-stock incidents: kurang 80%
- 🎯 Overstock issues: kurang 60%

---

## 🎯 FASE 3: MENU AUTOMATION & SCHEDULING (1.5 minggu)
**Implikasi**: Menu planning 20 min → 3 min

### 3.1 Menu Templates & Quick Suggest
**File**: `bot/handlers/menu_handler.py` + `backend/routers/menu_templates.py`

**Masalah**:
- Setiap minggu input menu dari 0
- Tidak ada template
- Pengulangan menu susah ditrack

**Solusi**:
```python
# backend/routers/menu_templates.py (🆕)

@router.get("/templates", response_model=List[MenuTemplateResponse])
async def list_menu_templates(
    current_user: UserInDB = Depends(get_current_user),
) -> List[MenuTemplateResponse]:
    """
    List menu templates untuk tenant yang logged in.
    Termasuk basic templates (M/S/R × 5 menu defaults).
    """
    sb = get_supabase()
    
    resp = sb.table('menu_templates').select('*').eq(
        'tenant_id', current_user.tenant_id
    ).order('created_at', desc=True).execute()
    
    return resp.data

@router.post("/templates/apply/{template_id}", response_model=Dict[str, Any])
async def apply_template(
    template_id: str,
    week_start: str,  # YYYY-MM-DD
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Apply template ke minggu spesifik.
    Copy semua schedule items dari template.
    """
    sb = get_supabase()
    
    # Get template
    tmpl_resp = sb.table('menu_templates').select('template_items').eq(
        'id', template_id
    ).single().execute()
    
    template = tmpl_resp.data
    
    # Create weekly schedule dari template
    for item in template['template_items']:
        # Insert ke master_schedules / schedule_items dengan week_start
        ...
    
    return {"status": "applied", "week_start": week_start}

# Bot handler untuk menu dengan template
async def menu_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry /menu - tampilkan templates first"""
    
    token = get_token(context)
    api = get_api_client()
    
    # Ambil templates
    resp = api.get("/menus/templates", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        await update.effective_message.reply_text("❌ Error fetching templates")
        return ConversationHandler.END
    
    templates = resp.json()["data"]
    
    if templates:
        # Tampilkan templates
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton(t['name'], callback_data=f"menu_template:{t['id']}")] 
            for t in templates
        ] + [
            [InlineKeyboardButton("➕ Buat Manual", callback_data="menu_manual")]
        ])
        
        await update.effective_message.reply_text(
            "📅 MENU MINGGU\n\n"
            "Gunakan template atau buat manual?",
            reply_markup=kb
        )
        
        return CHOOSE_TEMPLATE
    else:
        # Langsung ke input manual
        return await show_week_grid(update, context)

async def apply_template_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    template_id = query.data.split(":")[1]
    
    api = get_api_client()
    token = get_token(context)
    
    # Apply template
    resp = api.post(
        f"/menus/templates/apply/{template_id}",
        json={"week_start": str(date.today())},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code == 200:
        await query.edit_message_text(
            "✅ Template diterapkan!\n"
            "Edit ulang kalau perlu atau /seselesai"
        )
        return ConversationHandler.END
    else:
        await query.edit_message_text("❌ Error applying template")
        return ConversationHandler.END
```

**Impact**:
- ⚡ Menu planning: 20 min → 3 min
- 📋 Reduce repetitive entry 70%
- 🎯 Menu consistency improve

---

## 🎯 FASE 4: BULK DATA IMPORT & MASTER DATA (1 minggu)
**Implikasi**: Master data setup: 2 jam → 10 min

### 4.1 CSV Bulk Import untuk Master Data
**File**: `backend/routers/imports.py` (already exists, enhance)

**Masalah**:
- Master data (supplier, product, schools) entry manual satu2
- Setup tenant baru = 1-2 jam entry
- Error banyak karena manual

**Solusi**:
```python
# backend/routers/imports.py - ENHANCE

@router.post("/import/suppliers/csv", response_model=ImportResult)
async def import_suppliers_csv(
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(require_role(["owner", "admin"])),
) -> ImportResult:
    """
    Upload CSV suppliers dengan format:
    nama, alamat, no_telp, pic, email, is_active
    
    Returns: {count_inserted: 50, count_errors: 2, errors: [{row: 5, error: "..."}]}
    """
    import csv
    import io
    
    sb = get_supabase()
    content = await file.read()
    
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    rows = list(reader)
    
    inserted = 0
    errors = []
    
    for idx, row in enumerate(rows, start=2):  # Start dari row 2 (skip header)
        try:
            data = {
                "tenant_id": current_user.tenant_id,
                "nama": row['nama'].strip(),
                "alamat": row.get('alamat', '').strip(),
                "no_telp": row.get('no_telp', '').strip(),
                "pic": row.get('pic', '').strip(),
                "email": row.get('email', '').strip(),
                "is_active": row.get('is_active', 'true').lower() == 'true',
                "created_by": current_user.id,
            }
            
            # Validate
            if not data['nama']:
                raise ValueError("nama required")
            
            # Insert
            sb.table('suppliers').insert(data).execute()
            inserted += 1
            
        except Exception as e:
            errors.append({
                "row": idx,
                "error": str(e)
            })
    
    return {
        "count_inserted": inserted,
        "count_errors": len(errors),
        "errors": errors
    }

# Similar untuk products, schools, etc.

@router.post("/import/products/csv", response_model=ImportResult)
async def import_products_csv(
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(require_role(["owner"])),
) -> ImportResult:
    """
    CSV format: nama, satuan_jual, kategori, stok_minimum, stok_quantity, harga_dasar
    """
    # Similar implementation
    pass

@router.post("/import/schools/csv", response_model=ImportResult)  
async def import_schools_csv(
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(require_role(["owner"])),
) -> ImportResult:
    """
    CSV format: nama, alamat, npsn, kepala_sekolah, no_telp, is_active, siswa_count
    """
    # Similar implementation
    pass
```

**Web Dashboard** (`web/app/(dashboard)/admin/import/page.tsx`):
```typescript
'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState('suppliers');
  const [result, setResult] = useState<any>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/import/${importType}/csv`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    setResult(data);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📥 Bulk Import</h1>

      <form onSubmit={handleImport} className="space-y-4">
        <div>
          <label className="block mb-2">Import Type</label>
          <select
            value={importType}
            onChange={(e) => setImportType(e.target.value)}
            className="border p-2 w-full"
          >
            <option value="suppliers">Suppliers</option>
            <option value="products">Products</option>
            <option value="schools">Schools</option>
          </select>
        </div>

        <div>
          <label className="block mb-2">CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border p-2 w-full"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Import
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h2 className="font-bold">Result</h2>
          <p>✅ Inserted: {result.count_inserted}</p>
          <p>❌ Errors: {result.count_errors}</p>
          {result.errors.map((err: any, i: number) => (
            <p key={i} className="text-red-600">Row {err.row}: {err.error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Impact**:
- ✅ Setup tenant: 2 jam → 10 min
- 💪 Reduce typo 95%
- 📊 Better data quality

---

## 🎯 FASE 5: SMART DELIVERY PREDICTIONS (2 minggu)
**Implikasi**: Automasi portion input prediction

### 5.1 Predictive Portions Dari School Enrolment
**File**: `bot/handlers/serah_handler.py` + backend service

**Masalah**:
- User input portions per sekolah setiap hari
- Tidak predictive
- Sering massal = tedious

**Solusi**:
```python
# backend/services/portions_service.py (🆕)

class PortionsService:
    def __init__(self, sb: Client):
        self.sb = sb
    
    def predict_portions(
        self,
        tenant_id: str,
        date: str,  # YYYY-MM-DD
        menu_id: Optional[str] = None,
    ) -> Dict[str, float]:
        """
        Predict portions untuk semua sekolah.
        Berdasarkan: school enrollment + historical consumption + menu type.
        
        Returns: {
            "school_1_id": {"beras": 50, "lauk": 40, ...},
            "school_2_id": {"beras": 60, "lauk": 50, ...},
        }
        """
        from datetime import datetime, date as date_type
        
        target_date = datetime.fromisoformat(date).date()
        
        # 1. Ambil schedule untuk hari ini
        schedule_resp = self.sb.table('master_schedules').select(
            '*, master_schedule_schools(*, schools(*))'
        ).eq('tenant_id', tenant_id).gte(
            'week_start', (target_date - timedelta(days=7)).isoformat()
        ).lte(
            'week_start', target_date.isoformat()
        ).order('week_start', desc=True).limit(1).execute()
        
        if not schedule_resp.data:
            return {}
        
        schedule = schedule_resp.data[0]
        
        # 2. Ambil attendance percentage berdasarkan historical data
        attendance_resp = self.sb.rpc(
            "get_school_attendance_pct",
            {
                "p_tenant_id": tenant_id,
                "p_days_back": 30
            }
        ).execute()
        
        attendance_by_school = {
            a['school_id']: a['avg_attendance_pct']
            for a in attendance_resp.data or []
        }
        
        # 3. Ambil menu info untuk hitung per-item portions
        menu_resp = self.sb.table('weekly_menus').select(
            '*, weekly_menu_items(*, products(*))'
        ).eq('id', menu_id).single().execute() if menu_id else {}
        
        # 4. Hitung portions per sekolah
        predictions = {}
        
        for school_assoc in schedule.get('master_schedule_schools', []):
            school = school_assoc['schools']
            school_id = school['id']
            
            # Attendance percentage (default 95% jika tidak ada data)
            attendance_pct = attendance_by_school.get(school_id, 0.95)
            
            # Siswa yang makan = enrollment × attendance_pct
            siswa_aktif = int(school['siswa_count'] * attendance_pct)
            
            # Per-item portions
            portions = {}
            
            if menu_resp and menu_resp.get('data'):
                menu_items = menu_resp['data'].get('weekly_menu_items', [])
                for menu_item in menu_items:
                    product = menu_item['products']
                    
                    # Hitung besar portion = formula dari recipe
                    # Contoh: Beras 75g per anak
                    portion_size = menu_item.get('portion_size', 75)  # grams
                    total_qty = (siswa_aktif * portion_size) / 1000  # convert to kg
                    
                    portions[product['nama']] = round(total_qty, 1)
            else:
                # Default portions jika tidak ada menu
                portions = {
                    "beras": siswa_aktif * 0.075,  # 75g per anak
                    "lauk": siswa_aktif * 0.100,   # 100g per anak
                }
            
            predictions[school_id] = portions
        
        return predictions

# Bot handler untuk serah dengan predictions
async def serah_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry /serah - tampilkan predicted portions"""
    
    api = get_api_client()
    token = get_token(context)
    tenure = get_tenant_id(context)
    
    # Get predictions
    resp = api.get(
        f"/portions/predict?date={date.today().isoformat()}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code == 200:
        predictions = resp.json()["data"]
        
        # Parse predictions sebagai default value
        context.user_data["predicted_portions"] = predictions
        
        # Tampilkan dengan confirm button
        text = "📦 PREDICTED PORTIONS:\n\n"
        for school_id, items in predictions.items():
            text += f"Sekolah: {school_id}\n"
            for item_name, qty in items.items():
                text += f"  • {item_name}: {qty} kg\n"
            text += "\n"
        
        await update.effective_message.reply_text(
            text + "OK dengan prediksi ini?",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("✅ Lanjut", callback_data="serah_confirm"),
                InlineKeyboardButton("✏️ Edit", callback_data="serah_edit"),
            ]])
        )
        
        return CONFIRM_SERAH
    else:
        # Fallback ke manual input
        await update.effective_message.reply_text("Input portions per sekolah:")
        return INPUT_PORTIONS
```

**Impact**:
- ⚡ Delivery input: 5 min → 30 sec
- 🎯 Automated 70% dari daily delivery
- 📊 More consistent portion allocation

---

## 📋 RINGKASAN IMPLEMENTASI (6 minggu total)

| Fase | Features | Effort | Impact Manual Input |
|------|----------|--------|-------------------|
| **P1** (2w) | Auto-complete supplier, Smart item parser, Recurring detection | 40h | 60% → 50% |
| **P2** (2w) | Restock suggestions, Consumption analysis | 35h | 50% → 40% |
| **P3** (1.5w) | Menu templates, Quick apply | 20h | 40% → 35% |
| **P4** (1w) | CSV bulk import | 15h | 35% → 32% |
| **P5** (2w) | Predictive portions | 30h | 32% → 25-30% |
| **TOTAL** | | **140 hours** | **60% → 25-30%** |

---

## 🔧 Technical Prerequisites

### Database Enhancements
```sql
-- 1. Full-text search untuk suppliers & products
CREATE INDEX idx_suppliers_fts ON suppliers USING GIN(to_tsvector('indonesian', nam));
CREATE INDEX idx_products_fts ON products USING GIN(to_tsvector('indonesian', nama));

-- 2. Consumption rate calculation function
CREATE OR REPLACE FUNCTION calc_consumption_rate(...)...

-- 3. Attendance percentage view
CREATE OR REPLACE VIEW school_attendance_avg AS
  SELECT school_id, AVG(attendance_pct) as avg_attendance_pct
  FROM daily_deliveries
  GROUP BY school_id;

-- 4. Add indexes untuk performance
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);
CREATE INDEX idx_transaction_items_date ON transaction_items(created_at);
```

### Backend Services Layer
- ✅ `AliasService` - fuzzy matching products
- ✅ `RecurringService` - pattern detection
- ✅ `InventoryService` - consumption & predictions
- ✅ `PortionsService` - portion calculations

### Bot Enhancements
- ✅ Interactive keyboards untuk suggestions
- ✅ Batch confirmation flows
- ✅ Background job untuk daily reminders

---

## 🎯 Success Metrics

**Baseline** (sekarang):
- 60% manual input
- Setup tenant: 2 jam
- Average transaction entry: 5 menit

**Target** (6 minggu):
- 25-30% manual input
- Setup tenant: 10 menit
- Average transaction entry: 2 menit
- Typo reduction: 80%
- Out-of-stock reduction: 50%

---

## 📝 Next Steps

1. **Review & Approve** PHASE 1 implementation plan
2. **Prioritize** which phase to start
3. **Setup database** enhancements
4. **Implement incrementally** dengan testing each phase
5. **Gather user feedback** setelah setiap phase

Ingin saya detail mana yang harus dikerjakan duluan?
