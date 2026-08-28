"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiDelete, apiPut } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";

interface Product {
  id: string; name: string; category: string; unit: string; display_unit?: string; conversion_factor?: number;
}

interface Component {
  id: string; name: string;
}

interface Recipe {
  id: string; menu_id: string; ingredient_id: string | null;
  component_id: string | null; qty_needed: number; daily_qty?: number; usage_type?: string; unit: string;
}

interface SimIngredient {
  ingredient_id: string; name: string; unit: string; display_unit?: string;
  total_needed: number; total_needed_display?: number;
  available: number; available_display?: number;
  sufficient: boolean; shortage: number; shortage_display?: string;
}

interface NutritionSummary {
  menu_id: string;
  calories: number;
  proteins: number;
  fat: number;
  carbohydrates: number;
  fiber: number;
  total_ingredient_gram: number;
  sayur_percentage: number;
  is_balanced: boolean;
}

interface NutritionIngredient {
  product_id: string;
  product_name: string;
  weight_gram: number;
  calories: number;
  proteins: number;
  fat: number;
  carbohydrate: number;
  fiber: number;
  kategori: string;
  nutrition_ref_id: number | null;
  nutrition_ref_name: string;
  has_nutrition: boolean;
}

interface NutritionDetails {
  menu_id: string;
  ingredients: NutritionIngredient[];
  totals: { calories: number; proteins: number; fat: number; carbohydrate: number; fiber: number; total_gram: number };
  sayur_percentage: number;
  is_balanced: boolean;
}

interface FormRowItem {
  ingredient_name: string;
  ingredient_id: string | null;
  qty_needed: number;
  unit: string;
  usage_type: 'per_porsi' | 'per_hari';
  unit_weight_gram?: number;
}

export function TabMenuBOM() {
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Product[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ─── Menu BOM ───────────────────────────────────────────────────── */
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [menuRecipes, setMenuRecipes] = useState<Record<string, Recipe[]>>({});
  const [bomPreview, setBomPreview] = useState<Record<string, SimIngredient[]>>({});
  const [nutrition, setNutrition] = useState<Record<string, NutritionSummary>>({});
  const [nutritionDetails, setNutritionDetails] = useState<Record<string, NutritionDetails>>({});

  /* ─── Menu form (Integrated) ─────────────────────────────────────── */
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuForm, setMenuForm] = useState({ name: "", unit: "porsi" });
  const [menuFormComps, setMenuFormComps] = useState<{ component_id: string }[]>([]);
  const [menuFormDirects, setMenuFormDirects] = useState<FormRowItem[]>([]);

  /* ─── Nutrition Edit ──────────────────────────────────────────────── */
  const [editingNutProd, setEditingNutProd] = useState<Product | null>(null);
  const [nutForm, setNutForm] = useState({ conversion_factor: 100, calories: 0, proteins: 0, fat: 0, carbohydrate: 0, fiber: 0, kategori: "lainnya" });
  const [syncingFiber, setSyncingFiber] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, compRes] = await Promise.all([
        apiGet("/products"),
        apiGet("/recipes/components"),
      ]);
      const allProducts: Product[] = prodRes?.data?.items || prodRes?.data || [];
      setProducts(allProducts);
      setMenus(allProducts.filter(p => p.category === "produk_jadi"));
      setComponents(compRes?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchMenuRecipes = async (menuId: string) => {
    try {
      const [res, nRes, nDetail] = await Promise.all([
        apiGet("/recipes"),
        apiGet(`/nutrition/menu/${menuId}`).catch(() => null),
        apiGet(`/nutrition/menu/${menuId}/details`).catch(() => null),
      ]);
      const all: Recipe[] = res?.data || [];
      setMenuRecipes(prev => ({ ...prev, [menuId]: all.filter(r => r.menu_id === menuId) }));
      if (nRes) setNutrition(prev => ({ ...prev, [menuId]: nRes }));
      if (nDetail?.data) setNutritionDetails(prev => ({ ...prev, [menuId]: nDetail.data }));
    } catch (e) { console.error(e); }
  };

  const fetchBomPreview = async (menuId: string) => {
    try {
      const res = await apiGet(`/recipes/simulate?menu_id=${menuId}&qty=1`);
      setBomPreview(prev => ({ ...prev, [menuId]: res?.data?.ingredients || [] }));
    } catch (e) { console.error(e); }
  };

  const handleResyncFiber = async (menuId: string) => {
    if (!confirm("AI Gemini akan membaca nama semua bahan dan mencari estimasi nilai Serat secara massal. Lanjutkan?")) return;
    setSyncingFiber(true);
    try {
      const res = await apiPost("/nutrition/re-sync", {});
      alert(res?.message || "Re-sync serat selesai");
      await fetchMenuRecipes(menuId);
    } catch (e) {
      alert("Gagal re-sync serat");
    }
    setSyncingFiber(false);
  };

  const getCompName = (compId: string) => components.find(c => c.id === compId)?.name || "?";
  const getIngName = (ingId: string) => products.find(p => p.id === ingId)?.name || "?";
  const getIngFactor = (ingId: string) => products.find(p => p.id === ingId)?.conversion_factor || 1;
  const getIngDisplayUnit = (ingId: string) => products.find(p => p.id === ingId)?.display_unit || products.find(p => p.id === ingId)?.unit || "";

  const findProductByName = (name: string): Product | undefined => {
    return products.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
  };

  const getOrCreateIngredient = async (name: string, unit: string): Promise<string> => {
    const existing = findProductByName(name);
    if (existing) return existing.id;
    const res = await apiPost("/products", { name: name.trim(), category: "bahan_baku", display_unit: unit || "kg", unit: unit || "kg", harga: 0, sell_price: 0, stock_min: 0, stock_qty: 0 });
    return res?.data?.id;
  };

  const toggleMenu = async (menuId: string) => {
    if (expandedMenu === menuId) { setExpandedMenu(null); return; }
    setExpandedMenu(menuId);
    await fetchMenuRecipes(menuId);
  };

  const deleteRecipe = async (recipeId: string, menuId: string) => {
    try { await apiDelete(`/recipes/${recipeId}`); await fetchMenuRecipes(menuId); } catch { alert("Gagal menghapus"); }
  };

  const deleteMenu = async (menuId: string) => {
    if (!confirm("Hapus menu BOM ini? Seluruh resep juga akan terhapus.")) return;
    try {
      await apiDelete(`/products/${menuId}`);
      await fetchAll();
    } catch { alert("Gagal menghapus menu"); }
  };

  const openMenuForm = (menu?: Product) => {
    if (menu) {
      setEditingMenuId(menu.id);
      setMenuForm({ name: menu.name, unit: menu.display_unit || menu.unit || "porsi" });
      const recipes = menuRecipes[menu.id] || [];
      const compRecipes = recipes.filter(r => r.component_id);
      const directRecipes = recipes.filter(r => r.ingredient_id && !r.component_id);
      
      setMenuFormComps(compRecipes.map(r => ({ component_id: r.component_id! })));
      setMenuFormDirects(directRecipes.length > 0 ? directRecipes.map(r => {
        const factor = getIngFactor(r.ingredient_id!);
        return {
          ingredient_id: r.ingredient_id,
          ingredient_name: getIngName(r.ingredient_id!),
          usage_type: r.usage_type as any || "per_porsi",
          qty_needed: (r.usage_type === "per_hari" ? (r.daily_qty || r.qty_needed) : r.qty_needed) / factor,
          unit: getIngDisplayUnit(r.ingredient_id!) || r.unit,
          unit_weight_gram: factor > 1 ? factor : undefined,
        };
      }) : [{ ingredient_id: null, ingredient_name: "", qty_needed: 0, unit: "", usage_type: "per_porsi", unit_weight_gram: undefined }]);
    } else {
      setEditingMenuId(null);
      setMenuForm({ name: "", unit: "porsi" });
      setMenuFormComps([]);
      setMenuFormDirects([{ ingredient_id: null, ingredient_name: "", qty_needed: 0, unit: "", usage_type: "per_porsi", unit_weight_gram: undefined }]);
    }
    setShowMenuModal(true);
  };

  const updateMenuDirectRow = (idx: number, val: string) => {
    setMenuFormDirects(prev => {
      const nw = [...prev];
      nw[idx].ingredient_name = val;
      const exist = findProductByName(val);
      if (exist) {
        nw[idx].ingredient_id = exist.id;
        nw[idx].unit = exist.unit;
        if (exist.conversion_factor && exist.conversion_factor > 1) {
          nw[idx].unit_weight_gram = exist.conversion_factor;
        }
      } else {
        nw[idx].ingredient_id = null;
      }
      return nw;
    });
  };

  const menuFormValid = menuForm.name.trim().length > 0
    && (menuFormComps.length > 0 || menuFormDirects.some(r => r.ingredient_name.trim() && r.qty_needed > 0));

  const saveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !menuFormValid) return;
    setSaving(true);
    // ... existing save logic ...
    try {
      let menuId = editingMenuId;
      if (editingMenuId) {
        await apiPut(`/products/${editingMenuId}`, { name: menuForm.name, unit: menuForm.unit });
        // Hapus resep lama
        const existing = menuRecipes[editingMenuId] || [];
        for (const r of existing) {
          await apiDelete(`/recipes/${r.id}`);
        }
      } else {
        const prodRes = await apiPost("/products", { ...menuForm, category: "produk_jadi", stock_qty: 0, harga: 0, sell_price: 0, stock_min: 0 });
        menuId = prodRes?.data?.id;
        if (!menuId) throw new Error("Gagal membuat menu");
      }

      for (const comp of menuFormComps) {
        if (comp.component_id) {
          await apiPost("/recipes/attach-component", { menu_id: menuId, component_id: comp.component_id });
        }
      }

      for (const item of menuFormDirects) {
        if (item.ingredient_name.trim() && item.qty_needed > 0) {
          const actualIngId = await getOrCreateIngredient(item.ingredient_name, item.unit);
          await apiPost("/recipes", {
            menu_id: menuId, 
            ingredient_id: actualIngId,
            qty_needed: item.usage_type === "per_porsi" ? item.qty_needed : 0,
            daily_qty: item.usage_type === "per_hari" ? item.qty_needed : 0,
            usage_type: item.usage_type,
            unit: item.unit || "kg",
            unit_weight_gram: item.unit_weight_gram || undefined,
          });
        }
      }

      setShowMenuModal(false);
      await fetchAll();
    } catch (err: any) { alert(err?.response?.data?.detail || "Gagal menyimpan menu"); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-blue-600">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-white rounded-full animate-spin mb-4 shadow-md bg-blue-100" />
      <span className="font-medium animate-pulse text-sm tracking-wide">Mendeteksi Data Menu (BOM)...</span>
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
          <h2 className="text-xl font-bold text-gray-900 border-l-4 border-orange-500 pl-3 leading-none py-0.5">🍽️ Master Produk Menu (Bill of Materials)</h2>
          <p className="text-gray-500 text-sm mt-2 ml-4 max-w-xl">
            Atur komposisi porsi masakan. Saat Menu / Produk ini dibuat (saat Penyerahan), semua stok bahan akan dipotong sesuai BOM.
          </p>
        </div>
        <button 
          onClick={() => openMenuForm()} 
          className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20 rounded-xl hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all font-bold text-sm whitespace-nowrap"
        >
          + Ciptakan Menu Baru
        </button>
      </div>

      {menus.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-gray-100 rounded-3xl shadow-sm text-gray-400">
          <span className="text-6xl mb-4 opacity-50 grayscale">🍽️</span>
          <p className="font-semibold text-gray-600">Belum ada daftar Menu Produksi.</p>
          <p className="text-sm mt-1">Gunakan tombol [+ Baru] untuk membuat Bill of Material.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {menus.map(menu => {
            const isOpen = expandedMenu === menu.id;
            const recipes = menuRecipes[menu.id] || [];
            const compRecipes = recipes.filter(r => r.component_id);
            const directRecipes = recipes.filter(r => r.ingredient_id && !r.component_id);
            const preview = bomPreview[menu.id];

            return (
              <div key={menu.id} className={`border rounded-3xl bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-[0_12px_40px_rgba(0,0,0,0.06)] border-orange-200' : 'border-gray-100/80 hover:border-orange-100'}`}>
                <button onClick={() => toggleMenu(menu.id)}
                  className={`w-full flex justify-between items-center px-6 py-5 transition-colors relative ${isOpen ? 'bg-orange-50/50' : 'hover:bg-gray-50'}`}>
                  {isOpen && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500" />}
                  <div className="flex items-center gap-4">
                    <span className={`text-xl transition-transform duration-300 ${isOpen ? 'rotate-90 text-orange-500' : 'text-gray-400'}`}>▶</span>
                    <div className="text-left flex flex-col">
                      <span className="font-bold text-gray-900 text-lg group-hover:text-orange-600">{menu.name}</span>
                      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider mt-0.5">Basis Output: <span className="text-orange-600">1 {menu.unit}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <span className="text-xs font-bold px-3 py-1 bg-white border border-gray-100 rounded-lg shadow-sm text-gray-600">
                      <span className="text-purple-600 font-black">{compRecipes.length}</span> Modul <span className="text-gray-300 px-1">|</span> <span className="text-green-600 font-black">{directRecipes.length}</span> Direct
                    </span>
                    <div className="flex gap-2">
                       <span onClick={(e) => { e.stopPropagation(); openMenuForm(menu); }} className="text-blue-600 hover:text-white px-2.5 py-1 bg-blue-50 hover:bg-blue-600 rounded text-xs font-bold transition-colors cursor-pointer shadow-sm">
                         Edit
                       </span>
                       <span onClick={(e) => { e.stopPropagation(); deleteMenu(menu.id); }} className="text-red-600 hover:text-white px-2.5 py-1 bg-red-50 hover:bg-red-600 rounded text-xs font-bold transition-colors cursor-pointer shadow-sm">
                         Del
                       </span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 border-t border-orange-100 bg-white space-y-6 pt-5 animate-in slide-in-from-top-2 duration-300">

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Modul Komponen */}
                      <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-100/50 to-transparent rounded-bl-full pointer-events-none" />
                        <h4 className="font-bold text-purple-900 mb-3 text-sm flex items-center gap-2">
                          🧩 Modul Komponen Gabungan
                        </h4>
                        {compRecipes.length === 0
                          ? <p className="text-gray-400 text-sm italic ml-1">Tidak memakai sistem komponen.</p>
                          : <div className="space-y-2">{compRecipes.map(r => (
                              <div key={r.id} className="flex justify-between items-center bg-white border border-purple-100 px-4 py-2.5 rounded-xl shadow-sm hover:border-purple-200 transition-colors">
                                <span className="text-purple-800 font-semibold">{getCompName(r.component_id!)}</span>
                                <button onClick={() => deleteRecipe(r.id, menu.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">✕</button>
                              </div>
                            ))}</div>}
                      </div>

                      {/* Bahan Langsung */}
                      <div className="bg-green-50/30 border border-green-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-100/50 to-transparent rounded-bl-full pointer-events-none" />
                        <h4 className="font-bold text-green-900 mb-3 text-sm flex items-center gap-2">
                          🧪 Bahan Baku / Racik Langsung
                        </h4>
                        {directRecipes.length === 0
                          ? <p className="text-gray-400 text-sm italic ml-1">Tidak menggunakan bahan mentah tunggal.</p>
                          : <div className="space-y-2">{directRecipes.map(r => {
                              const isDaily = r.usage_type === "per_hari";
                              const ingId = r.ingredient_id || "";
                              const factor = getIngFactor(ingId);
                              const dispUnit = getIngDisplayUnit(ingId) || r.unit;
                              const rawQty = isDaily ? (r.daily_qty || r.qty_needed) : r.qty_needed;
                              const displayQty = isDaily ? rawQty / factor : rawQty / factor;
                              const qtyLabel = isDaily ? `${displayQty.toLocaleString("id-ID")} ${dispUnit}/hari (Abaikan Porsi)` : `${displayQty.toLocaleString("id-ID")} ${dispUnit}/porsi`;
                              
                              return (
                                <div key={r.id} className={`flex justify-between items-center px-4 py-2.5 border rounded-xl shadow-sm transition-colors ${isDaily ? 'bg-orange-50/50 border-orange-100' : 'bg-white border-green-100 hover:border-green-200'}`}>
                                  <div className="flex-1 pr-3">
                                    <div className={`font-semibold ${isDaily ? 'text-orange-900' : 'text-green-900'}`}>
                                      {getIngName(r.ingredient_id!)}
                                      {isDaily && <span className="ml-2 text-[10px] font-black uppercase tracking-wider bg-orange-200/50 text-orange-700 px-1.5 py-0.5 rounded-md">FIXED BIAYA HARIAN</span>}
                                    </div>
                                    <div className={`text-xs font-medium mt-0.5 ${isDaily ? 'text-orange-600' : 'text-green-600'}`}>{qtyLabel}</div>
                                  </div>
                                  <button onClick={() => deleteRecipe(r.id, menu.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors shrink-0">✕</button>
                                </div>
                              );
                            })}</div>}
                      </div>
                    </div>

                    {/* BOM Preview Engine */}
                    <div className="pt-6 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-gray-900 text-sm">Validasi Kalkulasi Sistem BOM</h4>
                        <div className="flex gap-2">
                          <button onClick={() => openMenuForm(menu)} className="px-5 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-200 transition-colors shadow-sm whitespace-nowrap">
                            ✏️ Edit BOM
                          </button>
                          <button onClick={() => fetchBomPreview(menu.id)} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap">
                            🚀 Jalankan Simulasi 1 {menu.unit}
                          </button>
                        </div>
                      </div>
                      
                      {preview && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
                          {preview.length === 0
                            ? <p className="text-gray-500 text-sm font-medium p-6 text-center italic">Simulation Error: Tidak ditemukan akar bahan (BOM Kosong).</p>
                            : <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-800 text-white font-semibold text-xs tracking-wider uppercase">
                                    <th className="py-3 px-4 text-left font-medium">Material Mentah (Diekstrak)</th>
                                    <th className="py-3 px-4 text-left font-medium">Beban Per {menu.unit}</th>
                                    <th className="py-3 px-4 text-left font-medium">Stok Aktual di Gudang</th>
                                    <th className="py-3 px-4 text-center font-medium w-32">Status (1 Porsi)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {preview.map((ing, i) => (
                                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors bg-white/50">
                                      <td className="py-3 px-4 font-bold text-slate-800">{ing.name}</td>
                                      <td className="py-3 px-4 text-slate-600 font-mono font-medium">{ing.total_needed_display ?? ing.total_needed} <span className="text-slate-400">{ing.display_unit || ing.unit}</span></td>
                                      <td className="py-3 px-4 text-slate-600 font-mono font-medium">{ing.available_display ?? ing.available} <span className="text-slate-400">{ing.display_unit || ing.unit}</span></td>
                                      <td className="py-3 px-4 text-center">
                                        {ing.sufficient
                                        ? <span className="inline-flex py-1 px-3 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-100">Aman</span>
                                        : <span className="inline-flex py-1 px-2 bg-red-50 text-red-600 font-bold text-[11px] rounded border border-red-100 uppercase tracking-widest whitespace-nowrap">Kurang {ing.shortage_display ?? ing.shortage}</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                          }
                        </div>
                      )}
                    </div>

                    {/* Nutrition Detail Table */}
                    {nutritionDetails[menu.id] && (
                      <div className="pt-6 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">🩺 Tabel Nutrisi Per Bahan (1 Porsi)</h4>
                          <div className="flex items-center gap-2">
                            {nutritionDetails[menu.id].totals.total_gram === 0 && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">BOM Kosong / Belum ada link nutrisi</span>}
                            <button onClick={() => handleResyncFiber(menu.id)} disabled={syncingFiber} className="text-[10px] px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold hover:bg-green-200 transition-colors shadow-sm border border-green-200 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50">
                              {syncingFiber ? "🔄 Memproses AI..." : "🔄 AI Sync Serat"}
                            </button>
                          </div>
                        </div>

                        {/* Summary Cards */}
                        {nutritionDetails[menu.id].totals.total_gram > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
                            <div className="bg-orange-50 border border-orange-100 p-3 rounded-2xl flex flex-col items-center text-center">
                              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-0.5">Kalori</span>
                              <span className="text-xl font-black text-orange-900">{nutritionDetails[menu.id].totals.calories.toLocaleString("id-ID")} <span className="text-xs font-semibold">kkal</span></span>
                            </div>
                            <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl flex flex-col items-center text-center">
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Protein</span>
                              <span className="text-xl font-black text-blue-900">{nutritionDetails[menu.id].totals.proteins.toLocaleString("id-ID")} <span className="text-xs font-semibold">g</span></span>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-2xl flex flex-col items-center text-center">
                              <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-0.5">Lemak</span>
                              <span className="text-xl font-black text-yellow-900">{nutritionDetails[menu.id].totals.fat.toLocaleString("id-ID")} <span className="text-xs font-semibold">g</span></span>
                            </div>
                            <div className="bg-teal-50 border border-teal-100 p-3 rounded-2xl flex flex-col items-center text-center">
                              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-0.5">Karbohidrat</span>
                              <span className="text-xl font-black text-teal-900">{nutritionDetails[menu.id].totals.carbohydrate.toLocaleString("id-ID")} <span className="text-xs font-semibold">g</span></span>
                            </div>
                            <div className="bg-green-50 border border-green-100 p-3 rounded-2xl flex flex-col items-center text-center relative">
                              {nutritionDetails[menu.id].totals.fiber > 0 && <span className="absolute -top-1 -right-1 text-xs">🥬</span>}
                              <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-0.5">Serat</span>
                              <span className="text-xl font-black text-green-900">{nutritionDetails[menu.id].totals.fiber.toLocaleString("id-ID")} <span className="text-xs font-semibold">g</span></span>
                            </div>
                            <div className={`p-3 rounded-2xl flex flex-col items-center text-center border ${nutritionDetails[menu.id].is_balanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200 relative overflow-hidden'}`}>
                              {!nutritionDetails[menu.id].is_balanced && <div className="absolute inset-0 bg-red-100/50 flex flex-col items-center justify-center animate-pulse border-2 border-red-400 z-10 p-1"><span className="text-2xl">⚠️</span><span className="text-[9px] font-bold text-red-700 leading-tight text-center">SAYUR &lt;30%</span></div>}
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Sayur</span>
                              <span className={`text-xl font-black ${nutritionDetails[menu.id].is_balanced ? 'text-green-700' : 'text-red-700'}`}>{nutritionDetails[menu.id].sayur_percentage}%</span>
                            </div>
                          </div>
                        )}

                        {/* Per-ingredient Table */}
                        {nutritionDetails[menu.id].ingredients.length > 0 && (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider">
                                  <th className="py-2.5 px-3 text-left">Bahan</th>
                                  <th className="py-2.5 px-3 text-right">Berat (g)</th>
                                  <th className="py-2.5 px-3 text-right">Kalori</th>
                                  <th className="py-2.5 px-3 text-right">Protein</th>
                                  <th className="py-2.5 px-3 text-right">Lemak</th>
                                  <th className="py-2.5 px-3 text-right">Karbo</th>
                                  <th className="py-2.5 px-3 text-right text-green-300">Serat</th>
                                  <th className="py-2.5 px-3 text-center">Kategori</th>
                                  <th className="py-2.5 px-3 text-center w-20">Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {nutritionDetails[menu.id].ingredients.map((ing, i) => (
                                  <tr key={ing.product_id + i} className={`border-t border-slate-100 ${!ing.has_nutrition ? 'bg-amber-50/50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`}>
                                    <td className="py-2 px-3 font-semibold text-gray-800">
                                      {ing.product_name}
                                      {!ing.has_nutrition && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded font-bold">NO DATA</span>}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-gray-700">{ing.weight_gram.toLocaleString("id-ID")}</td>
                                    <td className="py-2 px-3 text-right font-mono text-orange-700">{ing.calories.toLocaleString("id-ID")}</td>
                                    <td className="py-2 px-3 text-right font-mono text-blue-700">{ing.proteins.toLocaleString("id-ID")}</td>
                                    <td className="py-2 px-3 text-right font-mono text-yellow-700">{ing.fat.toLocaleString("id-ID")}</td>
                                    <td className="py-2 px-3 text-right font-mono text-teal-700">{ing.carbohydrate.toLocaleString("id-ID")}</td>
                                    <td className="py-2 px-3 text-right font-mono text-green-700">{ing.fiber.toLocaleString("id-ID")}</td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ing.kategori?.includes('sayur') ? 'bg-green-100 text-green-700' : ing.kategori?.includes('lauk') ? 'bg-purple-100 text-purple-700' : ing.kategori?.includes('buah') ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {ing.kategori || '-'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <button onClick={() => {
                                        const pd = products.find(p => p.id === ing.product_id);
                                        if (pd) {
                                          setEditingNutProd(pd);
                                          setNutForm({
                                            conversion_factor: pd.conversion_factor || 1,
                                            calories: ing.has_nutrition ? Math.round(ing.calories / (ing.weight_gram / 100 || 1)) : 0,
                                            proteins: ing.has_nutrition ? Math.round(ing.proteins / (ing.weight_gram / 100 || 1)) : 0,
                                            fat: ing.has_nutrition ? Math.round(ing.fat / (ing.weight_gram / 100 || 1)) : 0,
                                            carbohydrate: ing.has_nutrition ? Math.round(ing.carbohydrate / (ing.weight_gram / 100 || 1)) : 0,
                                            fiber: ing.has_nutrition ? Math.round(ing.fiber / (ing.weight_gram / 100 || 1)) : 0,
                                            kategori: ing.kategori || "",
                                          });
                                        }
                                      }} className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs font-bold rounded hover:bg-yellow-100 border border-yellow-200 transition-colors">
                                        ✏️
                                      </button>
                                      {!ing.has_nutrition && (
                                        <button onClick={async () => {
                                          try {
                                            await apiPost(`/nutrition/auto-link/${ing.product_id}`);
                                            await fetchMenuRecipes(menu.id);
                                          } catch { }
                                        }} className="ml-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 border border-blue-200 transition-colors" title="Auto-link via AI">
                                          🤖
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {/* Total Row */}
                                <tr className="bg-slate-800 text-white font-bold text-xs">
                                  <td className="py-2.5 px-3 uppercase tracking-wider">Total Per Porsi</td>
                                  <td className="py-2.5 px-3 text-right font-mono">{nutritionDetails[menu.id].totals.total_gram.toLocaleString("id-ID")}g</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-orange-300">{nutritionDetails[menu.id].totals.calories.toLocaleString("id-ID")}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-blue-300">{nutritionDetails[menu.id].totals.proteins.toLocaleString("id-ID")}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-yellow-300">{nutritionDetails[menu.id].totals.fat.toLocaleString("id-ID")}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-teal-300">{nutritionDetails[menu.id].totals.carbohydrate.toLocaleString("id-ID")}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-green-300">{nutritionDetails[menu.id].totals.fiber.toLocaleString("id-ID")}</td>
                                  <td className="py-2.5 px-3" colSpan={2}></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Menu Baru (Integrated) ─────────────────────────────── */}
      <Modal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        title={editingMenuId ? "Edit Resep / Menu BOM" : "Tambah Menu / Resep Baru"}
        maxWidthClassName="max-w-3xl"
        footer={
          <>
            <button type="button" onClick={() => setShowMenuModal(false)} className="px-6 py-3 rounded-xl text-gray-700 font-bold hover:bg-gray-200 transition-colors tracking-wide">Batalkan</button>
            <button type="submit" form="menu-form" disabled={saving || !menuFormValid} className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 disabled:opacity-50 disabled:grayscale font-bold tracking-wide transition-all">
              {saving ? "Menyimpan Resep..." : "Simpan Resep / Menu BOM"}
            </button>
          </>
        }
      >
        <form id="menu-form" onSubmit={saveMenu} className="space-y-8">
          {/* Product Creation Data */}
          <div className="grid grid-cols-3 gap-6 bg-orange-50/50 border border-orange-100 rounded-2xl p-5">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 pl-1">Judul Menu / Produk</label>
              <input required autoFocus type="text" placeholder="Contoh: Bistik Sapi Mentega" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 font-bold transition-all shadow-sm outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 pl-1">Target Satuan Output</label>
              <input required type="text" placeholder="porsi / box" value={menuForm.unit} onChange={e => setMenuForm({ ...menuForm, unit: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 font-bold text-center transition-all shadow-sm outline-none" />
            </div>
          </div>

          {/* Komponen Input */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-purple-900 mb-3 border-b border-purple-100 pb-2">
              <span>🧩 Bumbu Halus / Sub-Resep Tambahan (Opsional)</span>
            </label>
            <div className="space-y-4">
              {menuFormComps.length === 0 && <p className="text-sm text-gray-400 italic">Resep ini belum menambahkan sub-resep (seperti Bumbu Halus)</p>}
              <div className="grid sm:grid-cols-2 gap-3">
                {menuFormComps.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-purple-50 p-2 rounded-xl border border-purple-100 shadow-sm animate-in fade-in zoom-in-95">
                    <select required value={row.component_id} onChange={e => setMenuFormComps(prev => prev.map((r, i) => i===idx ? {component_id: e.target.value} : r))} className="flex-1 px-3 py-2 border-none rounded-lg text-sm bg-white font-semibold text-purple-900 outline-none cursor-pointer">
                      <option value="">Pilih sub-resep...</option>
                      {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setMenuFormComps(prev => prev.filter((_, i) => i !== idx))} className="w-8 h-8 rounded-lg bg-white text-gray-400 hover:text-red-500 flex justify-center items-center font-bold shadow-sm">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setMenuFormComps(prev => [...prev, { component_id: "" }])} className="px-5 py-2.5 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 font-bold text-sm tracking-wide transition-colors">
                + Tambah Sub-Resep
              </button>
            </div>
          </div>

          {/* Direct Ingredients Input */}
          <div className="pt-4">
            <label className="flex items-center gap-2 text-sm font-bold text-green-900 mb-3 border-b border-green-100 pb-2">
              <span>🧪 Bahan Baku Mentah</span>
            </label>
            <div className="space-y-4">
              {menuFormDirects.length === 0 && <p className="text-sm text-gray-400 italic">Peringatan: BOM sangat direkomendasikan memiliki Bahan Baku Mentah</p>}
              {menuFormDirects.map((row, idx) => (
                <div key={idx} className="bg-white p-4 border border-gray-200 rounded-2xl relative shadow-sm hover:border-green-300 transition-colors group">
                  <button type="button" onClick={() => setMenuFormDirects(prev => prev.filter((_, i) => i !== idx))} className="absolute right-3 top-3 w-8 h-8 rounded-lg bg-gray-50 text-gray-400 hover:text-white hover:bg-red-500 flex justify-center items-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10">✕</button>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Nama Bahan Baku</label>
                      <input type="text" list="bahan-list" placeholder="Pilih bahan..."
                        value={row.ingredient_name} onChange={e => updateMenuDirectRow(idx, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 font-bold outline-none" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Tipe Hitungan</label>
                      <select 
                        value={row.usage_type} 
                        onChange={e => setMenuFormDirects(prev => prev.map((r, i) => i === idx ? { ...r, usage_type: e.target.value as any } : r))} 
                        className={`w-full px-3 py-2 border rounded-xl text-sm font-bold outline-none cursor-pointer ${row.usage_type === 'per_hari' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                      >
                        <option value="per_porsi">Per {menuForm.unit || "Porsi"} (Berlipat / Fleksibel)</option>
                        <option value="per_hari">Per Hari (Fixed Biaya / Rigid)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
                        Jumlah Qty
                      </label>
                      <input type="number" step="0.001" min="0" placeholder="Qty" value={row.qty_needed || ""}
                        onChange={e => setMenuFormDirects(prev => prev.map((r, i) => i === idx ? { ...r, qty_needed: parseFloat(e.target.value) || 0 } : r))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 font-mono outline-none" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1 text-center">Satuan</label>
                      <input type="text" placeholder="mis: sosis / kg" value={row.unit}
                        onChange={e => setMenuFormDirects(prev => prev.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 font-medium text-center outline-none" />
                    </div>
                  </div>

                  {/* Unit Weight / Gram Conversion Assistant for non-metric units */}
                  {row.unit && !['kg', 'g', 'gram', 'gr', 'l', 'liter', 'ml', 'cc'].includes(row.unit.trim().toLowerCase()) && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <span className="text-amber-600 font-bold">⚖️ Konversi Berat Satuan:</span>
                        <span className="font-medium">1 {row.unit} =</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          placeholder="bobot (g)"
                          value={row.unit_weight_gram ?? (row.ingredient_id ? (getIngFactor(row.ingredient_id) > 1 ? getIngFactor(row.ingredient_id) : "") : "")}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setMenuFormDirects(prev => prev.map((r, i) => i === idx ? { ...r, unit_weight_gram: val } : r));
                          }}
                          className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-lg font-bold text-blue-700 outline-none text-center focus:ring-2 focus:ring-amber-400"
                        />
                        <span className="font-semibold text-gray-500">gram</span>
                      </div>
                      {row.qty_needed > 0 && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          ≈ {((row.qty_needed || 0) * (row.unit_weight_gram || (row.ingredient_id ? getIngFactor(row.ingredient_id) : 1))).toLocaleString('id-ID')} gram / {row.usage_type === 'per_hari' ? 'hari' : 'porsi'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-start">
                <button type="button" onClick={() => setMenuFormDirects(prev => [...prev, { ingredient_name: "", ingredient_id: null, qty_needed: 0, unit: "", usage_type: "per_porsi" }])} className="px-4 py-2 border border-dashed border-green-500 rounded-xl text-green-600 hover:bg-green-50 font-bold text-sm transition-all flex items-center gap-1.5">
                  <span>+ Sisipkan Bahan</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Edit Gizi & Convertion ─────────────────────────── */}
      <Modal
        isOpen={!!editingNutProd}
        onClose={() => setEditingNutProd(null)}
        title="Koreksi Kandungan Gizi AI"
        maxWidthClassName="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setEditingNutProd(null)} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm bg-white hover:bg-gray-50">Batal</button>
            <button 
              type="button"
              onClick={async () => {
                try {
                   const payload: any = { product_id: editingNutProd?.id, conversion_factor: nutForm.conversion_factor };
                   if (nutForm.calories) payload.calories = nutForm.calories;
                   if (nutForm.proteins) payload.proteins = nutForm.proteins;
                   if (nutForm.fat !== undefined) payload.fat = nutForm.fat;
                   if (nutForm.carbohydrate !== undefined) payload.carbohydrate = nutForm.carbohydrate;
                   if (nutForm.fiber !== undefined) payload.fiber = nutForm.fiber;
                   if (nutForm.kategori) payload.kategori = nutForm.kategori;
                   await apiPut(`/nutrition/products/${editingNutProd?.id}`, payload);
                   setEditingNutProd(null);
                   if (expandedMenu) await fetchMenuRecipes(expandedMenu);
                   fetchAll();
                } catch(e) { console.error(e); }
              }} 
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
            >
              Simpan Gizi
            </button>
          </>
        }
      >
        {editingNutProd && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-6">Penyesuaian manual untuk material <span className="font-bold text-indigo-600">{editingNutProd.name}</span></p>

            <div className="space-y-4">
               <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl">
                  <label className="block text-xs font-bold text-orange-800 mb-1">Konversi Berat Aktual ({editingNutProd.unit})</label>
                  <p className="text-xs text-orange-600 mb-2">Penting! Jika bahan "1 siung", tetapkan ini ke ~5 Gram. Jika "kg", tetapkan ke 1000.</p>
                  <div className="flex items-center gap-2">
                     <input type="number" min="0" step="0.01" value={nutForm.conversion_factor} onChange={e => setNutForm({...nutForm, conversion_factor: parseFloat(e.target.value)||0})} className="w-full px-3 py-2 border border-orange-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 font-mono text-sm" />
                     <span className="text-xs font-bold text-orange-700">Gram</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Kalori (per 100g)</label>
                      <input type="number" step="0.1" value={nutForm.calories || ''} onChange={e => setNutForm({...nutForm, calories: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Protein (per 100g)</label>
                      <input type="number" step="0.1" value={nutForm.proteins || ''} onChange={e => setNutForm({...nutForm, proteins: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Lemak (per 100g)</label>
                      <input type="number" step="0.1" value={nutForm.fat || ''} onChange={e => setNutForm({...nutForm, fat: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Karbohidrat (per 100g)</label>
                      <input type="number" step="0.1" value={nutForm.carbohydrate || ''} onChange={e => setNutForm({...nutForm, carbohydrate: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="block text-xs font-bold text-green-700 mb-1">Serat (per 100g)</label>
                      <input type="number" step="0.1" value={nutForm.fiber || ''} onChange={e => setNutForm({...nutForm, fiber: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-green-200 bg-green-50 rounded-lg outline-none text-sm" />
                  </div>
               </div>
               
               <div>
                   <label className="block text-xs font-bold text-gray-600 mb-1">Kategori Gizi</label>
                   <select value={nutForm.kategori} onChange={e => setNutForm({...nutForm, kategori: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm">
                       <option value="">(Abaikan / Jangan ubah)</option>
                       <option value="sayur">Sayur</option>
                       <option value="buah">Buah</option>
                       <option value="lauk">Lauk</option>
                       <option value="lauk hewani">Lauk Hewani</option>
                       <option value="lauk nabati">Lauk Nabati</option>
                       <option value="karbohidrat">Karbohidrat / Makanan Pokok</option>
                       <option value="bahan pangan">Bahan Pangan</option>
                       <option value="bahan pokok">Bahan Pokok</option>
                       <option value="bumbu">Bumbu</option>
                   </select>
               </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
