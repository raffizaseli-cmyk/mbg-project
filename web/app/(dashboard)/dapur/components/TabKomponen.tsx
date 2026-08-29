"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";

interface Product {
  id: string; name: string; category: string; unit: string; display_unit?: string; conversion_factor?: number;
}

interface ComponentItem {
  id: string; component_id: string; ingredient_id: string;
  qty_needed: number; unit: string | null; product_name: string | null;
}

interface Component {
  id: string; tenant_id: string; name: string;
  description: string | null; is_active: boolean;
  items: ComponentItem[];
}

interface FormRowItem {
  ingredient_name: string;
  ingredient_id: string | null;
  qty_needed: number;
  unit: string;
  usage_type: 'per_porsi' | 'per_hari';
  unit_weight_gram?: number;
}

export function TabKomponen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ─── Component form (with inline ingredient rows) ───────────────── */
  const [showCompModal, setShowCompModal] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compForm, setCompForm] = useState({ name: "", description: "" });
  const [compFormItems, setCompFormItems] = useState<FormRowItem[]>([{ ingredient_name: "", ingredient_id: null, qty_needed: 0, unit: "", usage_type: "per_porsi", unit_weight_gram: undefined }]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, compRes] = await Promise.all([
        apiGet("/products"),
        apiGet("/recipes/components"),
      ]);
      setProducts(prodRes?.data?.items || prodRes?.data || []);
      setComponents(compRes?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getIngName = (ingId: string) => products.find(p => p.id === ingId)?.name || "?";

  const findProductByName = (name: string): Product | undefined => {
    return products.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
  };

  const getOrCreateIngredient = async (name: string, unit: string): Promise<string> => {
    const existing = findProductByName(name);
    if (existing) return existing.id;
    const payload = { name: name.trim(), category: "bahan_baku", display_unit: unit || "kg", unit: unit || "kg", harga: 0, sell_price: 0, stock_min: 0, stock_qty: 0 };
    const res = await apiPost("/products", payload);
    return res?.data?.id;
  };

  const openCompForm = (comp?: Component) => {
    if (comp) {
      setEditingCompId(comp.id);
      setCompForm({ name: comp.name, description: comp.description || "" });
      setCompFormItems(
        comp.items.length > 0
          ? comp.items.map(it => ({
            ingredient_id: it.ingredient_id,
            ingredient_name: it.product_name || getIngName(it.ingredient_id),
            qty_needed: it.qty_needed,
            unit: it.unit || "",
            usage_type: "per_porsi"
          }))
          : [{ ingredient_id: null, ingredient_name: "", qty_needed: 0, unit: "", usage_type: "per_porsi" }]
      );
    } else {
      setEditingCompId(null);
      setCompForm({ name: "", description: "" });
      setCompFormItems([{ ingredient_id: null, ingredient_name: "", qty_needed: 0, unit: "", usage_type: "per_porsi" }]);
    }
    setShowCompModal(true);
  };

  const updateCompRowName = (idx: number, val: string) => {
    setCompFormItems(prev => {
      const nw = [...prev];
      nw[idx].ingredient_name = val;
      const exist = findProductByName(val);
      if (exist) {
        nw[idx].ingredient_id = exist.id;
        nw[idx].unit = exist.display_unit || exist.unit;
        if (exist.conversion_factor && exist.conversion_factor > 1) {
          nw[idx].unit_weight_gram = exist.conversion_factor;
        }
      } else {
        nw[idx].ingredient_id = null;
        nw[idx].unit_weight_gram = undefined;
      }
      return nw;
    });
  };

  const compFormValid = compForm.name.trim().length > 0
    && compFormItems.length > 0
    && compFormItems.every(r => r.ingredient_name.trim() && r.qty_needed > 0);

  const saveComp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !compFormValid) return;
    setSaving(true);
    try {
      let compId = editingCompId;
      if (editingCompId) {
        await apiPut(`/recipes/components/${editingCompId}`, compForm);
        const existing = components.find(c => c.id === editingCompId);
        if (existing) {
          for (const item of existing.items) {
            await apiDelete(`/recipes/components/${editingCompId}/items/${item.id}`);
          }
        }
      } else {
        const res = await apiPost("/recipes/components", compForm);
        compId = res?.data?.id;
        if (!compId) throw new Error("Gagal membuat komponen");
      }

      for (const item of compFormItems) {
        if (item.ingredient_name.trim() && item.qty_needed > 0) {
          const actualIngId = await getOrCreateIngredient(item.ingredient_name, item.unit);
          await apiPost(`/recipes/components/${compId}/items`, {
            ingredient_id: actualIngId,
            qty_needed: item.qty_needed,
            unit: item.unit || undefined,
            usage_type: item.usage_type,
            unit_weight_gram: item.unit_weight_gram || undefined,
          });
        }
      }

      setShowCompModal(false);
      await fetchAll();
    } catch (err: any) { alert(err?.response?.data?.detail || "Gagal menyimpan komponen"); }
    finally { setSaving(false); }
  };

  const deleteComp = async (id: string) => {
    if (!confirm("Hapus komponen ini?")) return;
    try { await apiDelete(`/recipes/components/${id}`); fetchAll(); }
    catch (err: any) { alert(err?.response?.data?.detail || "Gagal menghapus komponen"); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-blue-600">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-white rounded-full animate-spin mb-4 shadow-md bg-blue-100" />
      <span className="font-medium animate-pulse text-sm tracking-wide">Memuat Data Komponen Resep...</span>
    </div>
  );

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <datalist id="bahan-list">
        {products.filter(p => ["bahan_baku", "kemasan"].includes(p.category)).map(b => (
          <option key={b.id} value={b.name} />
        ))}
      </datalist>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 border-l-4 border-purple-500 pl-3 leading-none py-0.5">🧩 Dapur Komponen Resep</h2>
          <p className="text-gray-500 text-sm mt-2 ml-4 max-w-xl">
            Buat racikan / bumbu khas di sini untuk dipakai ke banyak resep makanan. Jika Anda menaruh &quot;Bumbu Halus&quot; di menu Nasi Goreng, semua bahan di dalam bumbu ini akan ditarik secara otomatis.
          </p>
        </div>
        <button 
          onClick={() => openCompForm()} 
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20 rounded-xl hover:shadow-purple-600/40 hover:-translate-y-0.5 transition-all font-bold text-sm whitespace-nowrap"
        >
          + Resep Komponen Baru
        </button>
      </div>

      {components.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-gray-100 rounded-3xl shadow-sm text-gray-400">
          <span className="text-6xl mb-4 opacity-50 grayscale">🧩</span>
          <p className="font-semibold text-gray-600">Belum ada komponen resep dasar.</p>
          <p className="text-sm mt-1">Gunakan tombol [+ Baru] untuk membuat.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {components.map(comp => (
            <div key={comp.id} className="border border-gray-100/50 rounded-3xl p-6 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-gray-200 transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 pr-3">
                  <h3 className="font-bold text-gray-900 text-lg group-hover:text-purple-700 transition-colors">🧩 {comp.name}</h3>
                  {comp.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2 leading-relaxed">{comp.description}</p>}
                </div>
                <div className="flex gap-2 opacity-0 lg:opacity-100 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openCompForm(comp)} className="text-blue-600 hover:text-white px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-colors shadow-sm">Edit</button>
                  <button onClick={() => deleteComp(comp.id)} className="text-red-600 hover:text-white px-2.5 py-1.5 bg-red-50 hover:bg-red-600 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-colors shadow-sm">Del</button>
                </div>
              </div>

              <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 flex-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-100/30 to-transparent rounded-bl-full pointer-events-none" />
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-3 ml-1">Kandungan Racikan:</h4>
                <div className="space-y-2">
                  {comp.items.length === 0 ? (
                    <p className="text-gray-400 text-sm italic font-medium ml-1">Kosong. (Belum ada bahan diatur)</p>
                  ) : (
                    comp.items.map(item => (
                      <div key={item.id} className="text-sm bg-white/80 backdrop-blur border border-gray-100 px-3 py-2 rounded-xl text-gray-700 flex justify-between items-center shadow-sm">
                        <span className="font-medium truncate pr-3">{item.product_name || getIngName(item.ingredient_id)}</span>
                        <span className="text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
                          {item.qty_needed} <span className="font-medium opacity-80">{item.unit}</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Komponen ───────────────────────────────────────────── */}
      <Modal
        isOpen={showCompModal}
        onClose={() => setShowCompModal(false)}
        title={editingCompId ? "Edit Konfigurasi Komponen" : "Racik Komponen Baru"}
        maxWidthClassName="max-w-2xl"
        footer={
          <>
            <button type="button" onClick={() => setShowCompModal(false)} className="px-6 py-2.5 rounded-xl text-gray-700 font-bold hover:bg-gray-200 transition-colors tracking-wide">Batal</button>
            <button type="submit" form="comp-form" disabled={saving || !compFormValid} className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-md shadow-purple-600/30 hover:shadow-lg disabled:opacity-50 disabled:grayscale font-bold tracking-wide transition-all">
              {saving ? "Memproses..." : "Simpan Permanen"}
            </button>
          </>
        }
      >
        <form id="comp-form" onSubmit={saveComp} className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 pl-1">Nama Racikan Komponen</label>
              <input required autoFocus type="text" placeholder="Cth: Bumbu Halus, Bumbu Merah" value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium transition-all outline-none" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 pl-1">Deskripsi &amp; Panduan</label>
              <input type="text" placeholder="Keterangan cara pakai (Opsional)" value={compForm.description} onChange={e => setCompForm({ ...compForm, description: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium transition-all outline-none" />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex justify-between items-end mb-3 px-1">
              <label className="block text-sm font-bold text-gray-900">Bahan Baku Pembentuk Racikan:</label>
            </div>
            <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-4 shadow-inner">
              <div className="flex text-[11px] uppercase tracking-widest font-bold text-gray-400 mb-3 px-2">
                <div className="flex-1">Nama Bahan Asli</div>
                <div className="w-[100px]">Takar/Qty</div>
                <div className="w-20">Standar</div>
                <div className="w-8"></div>
              </div>
              <div className="space-y-3">
                {compFormItems.map((row, idx) => (
                  <div key={idx} className="flex flex-col">
                    <div className="flex gap-3 items-center bg-white p-2 border border-gray-100 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:border-purple-200 transition-colors group">
                      <div className="hidden sm:flex text-gray-300 w-4 justify-center pointer-events-none opacity-50 shrink-0">::</div>
                      <input required type="text" list="bahan-list" placeholder="Pilih / ketik bahan..."
                        value={row.ingredient_name} onChange={e => updateCompRowName(idx, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium outline-none" />
                      <input required type="number" step="0.001" min="0" placeholder="Qty" value={row.qty_needed || ""}
                        onChange={e => setCompFormItems(prev => prev.map((r, i) => i === idx ? { ...r, qty_needed: parseFloat(e.target.value) || 0 } : r))}
                        className="w-[100px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-mono outline-none" />
                      <input required type="text" placeholder="Satuan" value={row.unit}
                        onChange={e => setCompFormItems(prev => prev.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r))}
                        className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium text-center outline-none" />
                      <button type="button" onClick={() => setCompFormItems(prev => prev.filter((_, i) => i !== idx))}
                        disabled={compFormItems.length <= 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 shrink-0 outline-none transition-colors">✕</button>
                    </div>

                    {row.unit && !['kg', 'g', 'gram', 'gr', 'l', 'liter', 'ml', 'cc'].includes(row.unit.trim().toLowerCase()) && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2 bg-amber-50/60 px-2.5 py-2 rounded-xl text-xs">
                        <span className="text-amber-700 font-bold">⚖️ 1 {row.unit} =</span>
                        <input
                          type="number" step="0.1" min="0.1" placeholder="gram"
                          value={row.unit_weight_gram ?? (row.ingredient_id ? (products.find(p => p.id === row.ingredient_id)?.conversion_factor ?? "") : "")}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setCompFormItems(prev => prev.map((r, i) => i === idx ? { ...r, unit_weight_gram: val } : r));
                          }}
                          className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg font-bold text-blue-700 outline-none text-center focus:ring-2 focus:ring-amber-400 text-xs"
                        />
                        <span className="text-gray-500 font-semibold">gram</span>
                        {row.qty_needed > 0 && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            ≈ {((row.qty_needed) * (row.unit_weight_gram || (products.find(p => p.id === row.ingredient_id)?.conversion_factor || 1))).toLocaleString('id-ID')} gram
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setCompFormItems(prev => [...prev, { ingredient_name: "", ingredient_id: null, qty_needed: 0, unit: "", usage_type: "per_porsi", unit_weight_gram: undefined }])}
                className="w-full mt-4 py-3 border-2 border-dashed border-purple-200 rounded-xl text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-colors font-bold text-sm tracking-wide">
                + Tambah Baris Bahan
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 font-medium bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-100">
              💡 <b>Tips Otomasi:</b> Jika nama bahan diketik manual dan belum terdaftar di Sistem Master Data Stok, AI akan otomatis mendaftarkannya sebagai bahan baru.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
