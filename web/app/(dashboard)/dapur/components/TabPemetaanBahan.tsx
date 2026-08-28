"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { Edit, Check, Loader2 } from "lucide-react";

interface UnmappedItem {
  id: string;
  transaction_id?: string;
  product_name: string;
  ocr_nama_asli: string;
  qty: string;
  unit: string;
  price: string;
  subtotal: string;
  needs_confirmation: boolean;
  packaging_value: string;
  packaging_unit: string;
  product_id: string | null;
}

interface Transaction {
  id: string;
  nama_toko: string;
  date: string;
  total: string;
  status: string;
  photo_url: string;
}

interface UnmappedGroup {
  transaction: Transaction;
  unmapped_items: UnmappedItem[];
  recognized_items?: UnmappedItem[];
}

interface Product {
  id: string;
  name: string;
  unit: string;
  category: string;
  nutrition_ref_kategori?: string;
  nutrition_ref_kondisi?: string;
}

interface ReferenceUnitWeight {
  unit: string;
  weight_gram: number;
}

interface TabPemetaanBahanProps {
  selectedReferenceIngredientId?: string;
  selectedReferenceIngredientName?: string;
  referenceUnitWeights?: ReferenceUnitWeight[];
  globalUnitWeights?: any[];
}

const getStandardUnitFactor = (unit: string): number => {
  const u = (unit || "").trim().toLowerCase();
  if (["kg", "kilogram"].includes(u)) return 1000;
  if (["g", "gr", "gram"].includes(u)) return 1;
  if (["ons", "hg"].includes(u)) return 100;
  if (["l", "liter", "litre"].includes(u)) return 1000;
  if (["ml", "mililiter"].includes(u)) return 1;
  return 1; // Fallback
};

const BASE_UNIT_OPTIONS = [
  "pcs", "kg", "g", "gram", "ml", "l", "liter",
  "ons", "botol", "pouch", "bks", "dus", "sak",
  "goni", "ikat", "papan", "tabung", "karung", "pack", "sachet"
];

export function TabPemetaanBahan({
  selectedReferenceIngredientId,
  selectedReferenceIngredientName,
  referenceUnitWeights = [],
  globalUnitWeights = [],
}: TabPemetaanBahanProps) {
  const [loading, setLoading] = useState(true);
  const [unmappedGroups, setUnmappedGroups] = useState<UnmappedGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Per-item mapping state: keyed by item.id
  const [mappingState, setMappingState] = useState<
    Record<string, { productId: string; pkgValue: string; pkgUnit: string; done: boolean; isNewProduct: boolean; newProductName: string }>
  >({});

  const [productSearch, setProductSearch] = useState<Record<string, string>>({});

  // Human-in-the-loop editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [savingItemMap, setSavingItemMap] = useState<Record<string, boolean>>({});
  const [showCustomPkg, setShowCustomPkg] = useState<Record<string, boolean>>({});
  const [pkgLocked, setPkgLocked] = useState<Record<string, boolean>>({});

  const [paymentMethodState, setPaymentMethodState] = useState<Record<string, string>>({});
  const [dueDateState, setDueDateState] = useState<Record<string, string>>({});
  const [confirmingTrxMap, setConfirmingTrxMap] = useState<Record<string, boolean>>({});

  const handleConfirmTransaction = async (trxId: string) => {
    const paymentMethod = paymentMethodState[trxId] || "cash";
    setConfirmingTrxMap((prev) => ({ ...prev, [trxId]: true }));
    try {
      const confirmBody: any = { payment_method: paymentMethod };
      if (paymentMethod === "hutang" && dueDateState[trxId]) {
        confirmBody.due_date = dueDateState[trxId];
      }
      const res = await apiPost(`/transactions/${trxId}/confirm`, confirmBody);
      // Surface payable warning from backend
      if (res?.payable_warning) {
        alert(`⚠️ ${res.payable_warning}`);
      } else {
        alert("✅ Nota berhasil dikonfirmasi & stok database telah diupdate!");
      }
      await fetchData();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      alert(typeof detail === "string" ? detail : "Gagal mengonfirmasi transaksi.");
    } finally {
      setConfirmingTrxMap((prev) => ({ ...prev, [trxId]: false }));
    }
  };

  const handleUpdateItemData = (itemId: string, field: string, value: any) => {
    setUnmappedGroups((prevGroups) =>
      prevGroups.map((group) => {
        const updateItem = (item: UnmappedItem) => {
          if (item.id === itemId) {
            const updated = { ...item, [field]: value };
            if (field === "qty" || field === "price") {
              const q = parseFloat(updated.qty) || 0;
              const p = parseFloat(updated.price) || 0;
              updated.subtotal = (q * p).toString();
            }
            return updated;
          }
          return item;
        };
        const updatedUnmapped = group.unmapped_items.map(updateItem);
        const updatedRecognized = (group.recognized_items || []).map(updateItem);
        const total = [...updatedUnmapped, ...updatedRecognized].reduce((sum, it) => sum + (parseFloat(it.subtotal) || 0), 0);
        return {
          ...group,
          transaction: {
            ...group.transaction,
            total: total > 0 ? total.toString() : group.transaction.total,
          },
          unmapped_items: updatedUnmapped,
          recognized_items: updatedRecognized,
        };
      })
    );

    if (field === "unit" && value) {
      updateMapping(itemId, { pkgUnit: value.toLowerCase() }, value.toLowerCase());
    }
  };

  const handleSaveInlineEdit = async (item: UnmappedItem) => {
    if (!item.transaction_id) {
      alert("ID Transaksi tidak ditemukan.");
      return;
    }

    const qty = parseFloat(String(item.qty));
    const price = parseFloat(String(item.price));

    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Qty harus berupa angka positif.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      alert("Harga satuan harus berupa angka ≥ 0.");
      return;
    }

    setSavingItemMap((prev) => ({ ...prev, [item.id]: true }));
    try {
      await apiPut(`/transactions/${item.transaction_id}/items/${item.id}`, {
        qty: qty,
        harga_satuan: price,
        ocr_nama_asli: item.ocr_nama_asli || item.product_name,
        unit: item.unit,
      });
      // Optimistically close edit mode without wiping other drafts
      setEditingItemId(null);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      alert(typeof detail === "string" ? detail : "Gagal menyimpan pembaruan item. Pastikan data valid.");
    } finally {
      setSavingItemMap((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unmappedResp, productsResp] = await Promise.all([
        apiGet("/transactions/unmapped-items"),
        apiGet("/products", { limit: 500 }),
      ]);
      setUnmappedGroups(unmappedResp.data || []);
      setProducts(productsResp.data || []);
      // Preserve existing mappingState drafts (do not wipe them!)
    } catch (err: any) {
      setError(err.response?.data?.detail || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getMapping = (itemId: string, defaultUnit: string = "pcs") => {
    return mappingState[itemId] || { productId: "", pkgValue: "1", pkgUnit: defaultUnit || "pcs", done: false, isNewProduct: false, newProductName: "" };
  };

  const updateMapping = (itemId: string, updates: Partial<typeof mappingState[string]>, defaultUnit: string = "pcs") => {
    setMappingState((prev) => ({
      ...prev,
      [itemId]: { ...getMapping(itemId, defaultUnit), ...updates },
    }));
  };

  // Collect all UNRECOGNIZED items that are ready to save (have productId set and not done yet)
  const readyItems = useMemo(() => {
    const items: UnmappedItem[] = [];
    unmappedGroups.forEach((g) => {
      g.unmapped_items.forEach((item) => {
        const m = getMapping(item.id, item.unit);
        if ((m.productId || m.isNewProduct) && !m.done) {
          items.push(item);
        }
      });
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unmappedGroups, mappingState]);

  const handleBulkSave = async () => {
    if (readyItems.length === 0) return;
    setBulkSaving(true);

    const results: { id: string; ok: boolean }[] = [];

    try {
      // Phase 1: Create any new products first (sequentially to avoid race conditions)
      const newProductIds: Record<string, string> = {};
      for (const item of readyItems) {
        const m = getMapping(item.id, item.unit);
        if (m.isNewProduct && m.newProductName) {
          // Check if we already created a product with this name in this batch
          const nameKey = m.newProductName.trim().toLowerCase();
          if (newProductIds[nameKey]) {
            // Reuse the already-created product id
            updateMapping(item.id, { productId: newProductIds[nameKey], isNewProduct: false }, item.unit);
            continue;
          }
          try {
            const createResp = await apiPost("/products", {
              name: m.newProductName.trim(),
              category: "bahan_baku",
              unit: m.pkgUnit || "pcs",
              display_unit: m.pkgUnit || "pcs",
              stock_qty: 0,
              stock_min: 0,
              harga: 0,
              sell_price: 0,
            });
            const createdId = createResp?.data?.id;
            if (createdId) {
              newProductIds[nameKey] = createdId;
              updateMapping(item.id, { productId: createdId, isNewProduct: false }, item.unit);
            } else {
              results.push({ id: item.id, ok: false });
              continue;
            }
          } catch (err: any) {
            // If product already exists (409 conflict), try to find it from products list
            if (err?.response?.status === 409) {
              const existingProd = products.find(
                (p) => p.name.trim().toLowerCase() === m.newProductName.trim().toLowerCase()
              );
              if (existingProd) {
                newProductIds[nameKey] = existingProd.id;
                updateMapping(item.id, { productId: existingProd.id, isNewProduct: false }, item.unit);
              } else {
                results.push({ id: item.id, ok: false });
                continue;
              }
            } else {
              results.push({ id: item.id, ok: false });
              continue;
            }
          }
        }
      }

      // Phase 2: Map all items (including newly created products)
      await Promise.all(
        readyItems.map(async (item) => {
          // Skip items that already failed during product creation
          if (results.some((r) => r.id === item.id && !r.ok)) return;

          const m = getMapping(item.id, item.unit);
          const resolvedProductId = m.productId || newProductIds[m.newProductName?.trim().toLowerCase()];

          if (!resolvedProductId) {
            results.push({ id: item.id, ok: false });
            return;
          }

          const factor = getStandardUnitFactor(m.pkgUnit);
          const val = parseFloat(m.pkgValue) || 1.0;
          const resolvedWeight = val * factor;

          try {
            await apiPost("/transactions/map-item", {
              item_id: item.id,
              product_id: resolvedProductId,
              packaging_value: val,
              packaging_unit: m.pkgUnit,
              original_unit: item.unit,
              resolved_weight_gram: resolvedWeight,
            });
            results.push({ id: item.id, ok: true });
          } catch {
            results.push({ id: item.id, ok: false });
          }
        })
      );

      // Update state
      setMappingState((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          if (r.ok && next[r.id]) {
            next[r.id] = { ...next[r.id], done: true };
          }
        });
        return next;
      });

      const successCount = results.filter((r) => r.ok).length;
      const failCount = results.filter((r) => !r.ok).length;

      if (failCount > 0) {
        alert(`${successCount} berhasil, ${failCount} gagal disimpan.`);
      }

      // Refresh data after short delay
      setTimeout(() => fetchData(), 800);
    } catch (err: any) {
      alert("Terjadi kesalahan saat menyimpan: " + (err.message || "Unknown error"));
    } finally {
      setBulkSaving(false);
    }
  };

  const referensiSatuanOptions = useMemo(() => {
    const normalized = new Set<string>(BASE_UNIT_OPTIONS);

    globalUnitWeights.forEach((entry) => {
      const unit = (entry.unit || "").trim().toLowerCase();
      if (unit) normalized.add(unit);
    });

    return Array.from(normalized).sort();
  }, [globalUnitWeights]);

  const availableUnitOptions = useMemo(() => {
    const normalized = new Set<string>(BASE_UNIT_OPTIONS);

    referenceUnitWeights.forEach((entry) => {
      const unit = (entry.unit || "").trim().toLowerCase();
      if (unit) normalized.add(unit);
    });

    return Array.from(normalized);
  }, [referenceUnitWeights]);

  const filteredProducts = (itemId: string) => {
    const search = (productSearch[itemId] || "").toLowerCase();
    if (!search) return products.slice(0, 30);
    return products.filter((p) => p.name.toLowerCase().includes(search)).slice(0, 30);
  };

  const fmtRp = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return "Rp 0";
    return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Memuat data pemetaan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-2xl">❌</div>
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (unmappedGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl mx-auto">🎉</div>
        <h3 className="text-lg font-bold text-gray-900">Semua bahan berhasil dikenali sistem.</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Tidak ada bahan dari nota yang gagal dikenali. Semua nota diproses secara otomatis.
        </p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  const totalUnmapped = unmappedGroups.reduce((sum, g) => {
    return sum + g.unmapped_items.filter((i) => i.needs_confirmation).length;
  }, 0);

  const totalRecognized = unmappedGroups.reduce((sum, g) => {
    return sum + g.unmapped_items.filter((i) => !i.needs_confirmation).length;
  }, 0);

  // Split groups: ready to confirm vs needs mapping
  const readyToConfirmGroups = unmappedGroups.filter((g) => {
    const unmappedRemaining = g.unmapped_items.filter((item) => item.needs_confirmation);
    return unmappedRemaining.length === 0;
  });
  const needsMappingGroups = unmappedGroups.filter((g) => {
    const unmappedRemaining = g.unmapped_items.filter((item) => item.needs_confirmation);
    return unmappedRemaining.length > 0;
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Header Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            📋 Pemetaan & Konfirmasi Nota
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {unmappedGroups.length} nota — {readyToConfirmGroups.length} siap dikonfirmasi, {needsMappingGroups.length} perlu dipetakan
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1.5"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {readyToConfirmGroups.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl shrink-0">✅</span>
            <div>
              <p className="text-sm font-bold text-emerald-900">{readyToConfirmGroups.length} Nota Siap Dikonfirmasi</p>
              <p className="text-xs text-emerald-700 mt-0.5">Semua bahan sudah dipetakan. Pilih metode bayar & konfirmasi untuk masuk pembukuan.</p>
            </div>
          </div>
        )}
        {needsMappingGroups.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-900">{needsMappingGroups.length} Nota Perlu Dipetakan</p>
              <p className="text-xs text-amber-700 mt-0.5">{totalUnmapped} bahan belum dikenali. Petakan ke produk DB terlebih dahulu.</p>
            </div>
          </div>
        )}
      </div>

      {referenceUnitWeights.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">
                Kamus satuan aktif: {selectedReferenceIngredientName || "bahan terpilih"}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Unit yang tersedia di referensi satuan akan muncul di daftar satuan pemetaan agar konsisten dengan data utama.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {referenceUnitWeights.slice(0, 6).map((entry) => (
                <span key={`${entry.unit}-${entry.weight_gram}`} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {entry.unit} = {entry.weight_gram}g
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: NOTA SIAP DIKONFIRMASI                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {readyToConfirmGroups.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-emerald-200" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
              ✅ Siap Dikonfirmasi ({readyToConfirmGroups.length} nota)
            </span>
            <div className="h-px flex-1 bg-emerald-200" />
          </div>

          {readyToConfirmGroups.map((group) => (
            <div
              key={group.transaction.id}
              className="bg-white rounded-2xl border-2 border-emerald-300 shadow-md overflow-hidden transition-all"
            >
              {/* Transaction Header - Green */}
              <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      {group.transaction.nama_toko || "Nota"}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{group.transaction.date}</span>
                      <span>{fmtRp(group.transaction.total)}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                        ✓ Semua Dipetakan — Menunggu Konfirmasi
                      </span>
                    </div>
                  </div>
                  {group.transaction.photo_url && (
                    <a
                      href={group.transaction.photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      Lihat Foto
                    </a>
                  )}
                </div>
              </div>

              {/* Recognized / Mapped Items with full inline edit support */}
              <div className="divide-y divide-gray-100">
                {(group.recognized_items || []).map((item) => {
                  const isEditing = editingItemId === item.id;
                  return (
                    <div key={item.id} className={`px-5 py-3.5 transition-colors ${
                      isEditing ? "bg-blue-50/50 border-y border-blue-100 space-y-4" : "bg-green-50/30"
                    }`}>
                      {isEditing ? (
                        /* Inline Edit Form for recognized items */
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                              <Edit className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                              <span>Koreksi Pembacaan AI / Nota</span>
                            </h4>
                            <span className="text-[10px] text-blue-500 font-medium">Bahan sudah dikenali — koreksi data jika ada yang salah</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-5">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Bahan (OCR/Raw)</label>
                              <input
                                type="text"
                                value={item.ocr_nama_asli || ""}
                                onChange={(e) => handleUpdateItemData(item.id, "ocr_nama_asli", e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-800"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Qty</label>
                              <input
                                type="number" step="any"
                                value={item.qty || ""}
                                onChange={(e) => handleUpdateItemData(item.id, "qty", e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-800"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Harga Satuan</label>
                              <input
                                type="number"
                                value={item.price || ""}
                                onChange={(e) => handleUpdateItemData(item.id, "price", e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-800"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Satuan</label>
                              <select
                                value={(item.unit || "").toLowerCase()}
                                onChange={(e) => handleUpdateItemData(item.id, "unit", e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-800"
                              >
                                {referensiSatuanOptions.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingItemId(null)}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all">
                              Batal
                            </button>
                            <button type="button" onClick={() => handleSaveInlineEdit(item)}
                              disabled={savingItemMap[item.id]}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50">
                              {savingItemMap[item.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              <span>Simpan Koreksi</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            </span>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{item.ocr_nama_asli || item.product_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {item.qty} <strong className="text-gray-700">{item.unit}</strong> × {fmtRp(item.price)} = {fmtRp(item.subtotal)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(item.id)}
                            className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-1 border border-transparent hover:border-gray-200"
                            title="Koreksi data yang salah dibaca AI"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold hidden sm:inline">Koreksi</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ★ CONFIRMATION BLOCK — prominent */}
              <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-t-2 border-emerald-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">✓</span>
                  <span className="text-sm font-bold text-emerald-900">
                    Konfirmasi Nota Ini untuk Masuk Pembukuan & Update Stok
                  </span>
                </div>
                <p className="text-xs text-emerald-700 ml-9">
                  Nota ini belum tercatat di pembukuan. Pilih metode pembayaran lalu klik tombol konfirmasi.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3 ml-9">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-700">Metode Pembayaran:</label>
                    <select
                      value={paymentMethodState[group.transaction.id] || "cash"}
                      onChange={(e) => setPaymentMethodState(prev => ({ ...prev, [group.transaction.id]: e.target.value }))}
                      className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold bg-white text-gray-800 focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer"
                    >
                      <option value="cash">💵 Tunai (Cash)</option>
                      <option value="hutang">💳 Hutang (Kredit)</option>
                      <option value="transfer">🏦 Transfer Bank</option>
                    </select>
                  </div>
                  {(paymentMethodState[group.transaction.id] || "cash") === "hutang" && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-700">Jatuh Tempo:</label>
                      <input
                        type="date"
                        value={dueDateState[group.transaction.id] || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}
                        onChange={(e) => setDueDateState(prev => ({ ...prev, [group.transaction.id]: e.target.value }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold bg-white text-gray-800 focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleConfirmTransaction(group.transaction.id)}
                    disabled={confirmingTrxMap[group.transaction.id]}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {confirmingTrxMap[group.transaction.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memproses Konfirmasi...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>✅ Konfirmasi Pembayaran & Update Stok</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: NOTA PERLU DIPETAKAN                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {needsMappingGroups.length > 0 && (
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-amber-200" />
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
            ⚠️ Perlu Dipetakan ({needsMappingGroups.length} nota)
          </span>
          <div className="h-px flex-1 bg-amber-200" />
        </div>
      )}

      {/* Transaction Groups — only needs-mapping notes rendered with full mapping UI */}
      {needsMappingGroups.map((group) => {
        const unmappedRemaining = group.unmapped_items.filter((item) => !getMapping(item.id, item.unit).done);
        const isGroupFullyMapped = unmappedRemaining.length === 0;

        return (
          <div
            key={group.transaction.id}
            className={`bg-white rounded-2xl border ${isGroupFullyMapped ? "border-emerald-300 shadow-md" : "border-amber-200/60 shadow-sm"} overflow-hidden transition-all`}
          >
            {/* Transaction Header */}
            <div className={`px-5 py-4 ${isGroupFullyMapped ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100" : "bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    {group.transaction.nama_toko || "Nota"}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{group.transaction.date}</span>
                    <span>{fmtRp(group.transaction.total)}</span>
                    {isGroupFullyMapped ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                        ✓ Semua Dipetakan (Siap Konfirmasi)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                        {unmappedRemaining.length} belum dipetakan
                      </span>
                    )}
                  </div>
                </div>
              {group.transaction.photo_url && (
                <a
                  href={group.transaction.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  Lihat Foto
                </a>
              )}
            </div>
          </div>

          {/* Recognized + Unrecognized Items */}
          <div className="divide-y divide-gray-100">
            {/* Section: Sudah Dikenali (from recognized_items) */}
            {(group.recognized_items || []).map((item) => {
              const isEditing = editingItemId === item.id;
              return (
                <div key={item.id} className={`px-5 py-3.5 transition-colors ${
                  isEditing ? "bg-blue-50/50 border-y border-blue-100 space-y-4" : "bg-green-50/30"
                }`}>
                  {isEditing ? (
                    /* Inline Edit Form for recognized items */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                          <Edit className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                          <span>Koreksi Pembacaan AI</span>
                        </h4>
                        <span className="text-[10px] text-blue-500 font-medium">Bahan sudah dikenali — hanya koreksi data jika salah</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-5">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Bahan (OCR/Raw)</label>
                          <input
                            type="text"
                            value={item.ocr_nama_asli || ""}
                            onChange={(e) => handleUpdateItemData(item.id, "ocr_nama_asli", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-800"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Qty</label>
                          <input
                            type="number" step="any"
                            value={item.qty || ""}
                            onChange={(e) => handleUpdateItemData(item.id, "qty", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-800"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Harga Satuan</label>
                          <input
                            type="number"
                            value={item.price || ""}
                            onChange={(e) => handleUpdateItemData(item.id, "price", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-800"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Satuan</label>
                          <select
                            value={(item.unit || "").toLowerCase()}
                            onChange={(e) => handleUpdateItemData(item.id, "unit", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none font-medium text-gray-800"
                          >
                            {referensiSatuanOptions.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingItemId(null)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all">
                          Batal
                        </button>
                        <button type="button" onClick={() => handleSaveInlineEdit(item)}
                          disabled={savingItemMap[item.id]}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50">
                          {savingItemMap[item.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Simpan Koreksi</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Read-only recognized row */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{item.ocr_nama_asli || item.product_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.qty} <strong className="text-gray-700">{item.unit}</strong> × {fmtRp(item.price)} = {fmtRp(item.subtotal)}
                            <span className="ml-2 text-green-600 font-semibold text-[10px] uppercase tracking-wide">✓ Dikenali</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(item.id)}
                        className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-1 border border-transparent hover:border-gray-200"
                        title="Koreksi data yang salah dibaca AI"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold hidden sm:inline">Koreksi</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Divider jika ada kedua tipe */}
            {(group.recognized_items || []).length > 0 && group.unmapped_items.length > 0 && (
              <div className="px-5 py-2 bg-amber-50/60 border-y border-amber-100 flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">⚠️ Bahan Berikut Perlu Dipetakan ke Produk DB</span>
              </div>
            )}

            {/* Section: Belum Dikenali (unmapped_items from backend) */}
            {group.unmapped_items.map((item) => {
              const mapping = getMapping(item.id, item.unit);

              if (mapping.done) {
                return (
                  <div key={item.id} className="px-5 py-3 bg-emerald-50/50 flex items-center gap-3">
                    <span className="text-emerald-500 text-lg">✅</span>
                    <span className="text-sm text-emerald-700 font-medium">
                      &quot;{item.ocr_nama_asli || item.product_name}&quot; berhasil dipetakan
                    </span>
                  </div>
                );
              }

              const isReady = !!mapping.productId || mapping.isNewProduct;

              const isEditing = editingItemId === item.id;

              return (
                <div key={item.id} className={`px-5 py-4 space-y-3 transition-colors ${isReady ? "bg-green-50/30" : ""} ${isEditing ? "bg-blue-50/50 border-y border-blue-100" : ""}`}>
                  {isEditing ? (
                    /* Inline Editing Form */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                          <Edit className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                          <span>Edit Detail Bahan Asli</span>
                        </h4>
                        <span className="text-[10px] text-blue-500 font-medium">Ubah pembacaan AI yang salah</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* Nama Bahan */}
                        <div className="md:col-span-5">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Bahan (OCR/Raw)</label>
                          <input
                            type="text"
                            value={item.ocr_nama_asli || ""}
                            onChange={(e) => handleUpdateItemData(item.id, "ocr_nama_asli", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none font-medium text-gray-800"
                            placeholder="Nama bahan asli..."
                          />
                        </div>

                        {/* Qty */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Qty</label>
                          <input
                            type="number"
                            step="any"
                            value={item.qty || ""}
                            onChange={(e) => handleUpdateItemData(item.id, "qty", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none font-medium text-gray-800"
                            placeholder="1"
                          />
                        </div>

                        {/* Harga Satuan */}
                        <div className="md:col-span-3">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Harga Satuan</label>
                          <input
                            type="number"
                            value={item.price || ""}
                            onChange={(e) => handleUpdateItemData(item.id, "price", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none font-medium text-gray-800"
                            placeholder="Harga..."
                          />
                        </div>

                        {/* Satuan */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Satuan</label>
                          <select
                            value={(item.unit || "").toLowerCase()}
                            onChange={(e) => handleUpdateItemData(item.id, "unit", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none font-medium text-gray-800"
                          >
                            {referensiSatuanOptions.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveInlineEdit(item)}
                          disabled={savingItemMap[item.id]}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          {savingItemMap[item.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Done</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Read-Only Mode */
                    <>
                      {/* Item Info */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                            {isReady ? (
                              <span className="text-green-500 font-bold">✓</span>
                            ) : (
                              <span className="text-amber-500 font-bold">❓</span>
                            )}
                            {item.ocr_nama_asli || item.product_name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.qty} <strong className="text-gray-700">{item.unit}</strong> × {fmtRp(item.price)} = {fmtRp(item.subtotal)}
                          </p>
                        </div>
                        {/* Inline edit toggle button */}
                        <button
                          type="button"
                          onClick={() => setEditingItemId(item.id)}
                          className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-center border border-transparent hover:border-gray-200"
                          title="Edit Detail Bahan Asli"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mapping Form */}
                      <div className="space-y-2">
                        <div className="relative w-full">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Petakan ke Produk Baku</label>
                          <input
                            type="text"
                            placeholder="Cari produk baku..."
                            value={productSearch[item.id] || ""}
                            onChange={(e) =>
                              setProductSearch((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                          />
                          {(productSearch[item.id] || "").length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                              {filteredProducts(item.id).map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    updateMapping(item.id, { productId: p.id, isNewProduct: false, newProductName: "" }, item.unit);
                                    setProductSearch((prev) => ({ ...prev, [item.id]: "" }));
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50/70 transition-colors flex flex-col gap-1 border-b border-gray-50 last:border-0"
                                >
                                  <div className="flex justify-between items-center w-full">
                                    <span className="font-medium text-gray-800">{p.name}</span>
                                    <span className="text-xs text-gray-400 font-semibold uppercase">{p.unit}</span>
                                  </div>
                                  {(p.nutrition_ref_kategori || p.nutrition_ref_kondisi) && (
                                    <div className="flex flex-wrap gap-1 mt-0.5 pb-1">
                                      {p.nutrition_ref_kategori && (
                                        <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wide">
                                          {p.nutrition_ref_kategori}
                                        </span>
                                      )}
                                      {p.nutrition_ref_kondisi && (
                                        <span className="text-[9px] font-bold bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-100 uppercase tracking-wide">
                                          {p.nutrition_ref_kondisi}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </button>
                              ))}

                              {/* Creatable: "+ Buat Produk Baku Baru" option */}
                              {(() => {
                                const searchVal = (productSearch[item.id] || "").trim();
                                const hasExactMatch = products.some(
                                  (p) => p.name.trim().toLowerCase() === searchVal.toLowerCase()
                                );
                                if (searchVal.length >= 2 && !hasExactMatch) {
                                  return (
                                    <button
                                      onClick={() => {
                                        updateMapping(
                                          item.id,
                                          { productId: "", isNewProduct: true, newProductName: searchVal },
                                          item.unit
                                        );
                                        setProductSearch((prev) => ({ ...prev, [item.id]: "" }));
                                      }}
                                      className="w-full text-left px-3 py-2.5 text-sm bg-emerald-50/60 hover:bg-emerald-100 transition-colors border-t-2 border-emerald-100 flex items-center gap-2 group sticky bottom-0"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 group-hover:scale-110 transition-transform">+</span>
                                      <span className="text-emerald-800 font-semibold">
                                        Buat Produk Baku Baru:{" "}
                                        <span className="text-emerald-600 font-bold">&ldquo;{searchVal}&rdquo;</span>
                                      </span>
                                    </button>
                                  );
                                }
                                return null;
                              })()}

                              {filteredProducts(item.id).length === 0 && !(productSearch[item.id] || "").trim() && (
                                <p className="px-3 py-2 text-xs text-gray-400">Tidak ditemukan</p>
                              )}
                            </div>
                          )}

                          {/* Selected product display */}
                          {(mapping.productId || mapping.isNewProduct) && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {mapping.isNewProduct ? (
                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-semibold border border-emerald-200 flex items-center gap-1.5">
                                  <span className="w-3.5 h-3.5 rounded bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold">+</span>
                                  BARU: &ldquo;{mapping.newProductName}&rdquo;
                                </span>
                              ) : (
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium">
                                  ✔ {products.find((p) => p.id === mapping.productId)?.name || "Selected"}
                                </span>
                              )}
                              <button
                                onClick={() => updateMapping(item.id, { productId: "", isNewProduct: false, newProductName: "" }, item.unit)}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Wholesale / Packaging Conversion Section */}
                        {showCustomPkg[item.id] || (mapping.pkgValue && mapping.pkgValue !== "1") ? (
                          pkgLocked[item.id] ? (
                            <div className="pt-2 border-t border-emerald-200 bg-emerald-50/70 p-3 rounded-xl flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                                Konversi Terkunci: <strong>1 {item.unit} = {mapping.pkgValue} {mapping.pkgUnit}</strong>
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPkgLocked((prev) => ({ ...prev, [item.id]: false }))}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                                >
                                  ✏️ Ubah
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPkgLocked((prev) => ({ ...prev, [item.id]: false }));
                                    setShowCustomPkg((prev) => ({ ...prev, [item.id]: false }));
                                    updateMapping(item.id, { pkgValue: "1", pkgUnit: item.unit }, item.unit);
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-red-600 font-semibold"
                                >
                                  ✕ Reset
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-amber-200/80 bg-amber-50/60 p-3.5 rounded-xl space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                                  ⚙️ Atur Konversi Grosir ({item.unit})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowCustomPkg((prev) => ({ ...prev, [item.id]: false }));
                                    updateMapping(item.id, { pkgValue: "1", pkgUnit: item.unit }, item.unit);
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-red-600 font-semibold"
                                >
                                  Reset ke Eceran (1 {item.unit})
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Isi per {item.unit}</label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.0001"
                                    value={mapping.pkgValue}
                                    onChange={(e) => updateMapping(item.id, { pkgValue: e.target.value }, item.unit)}
                                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none bg-white font-bold text-gray-900"
                                    placeholder="misal: 25 (jika 25 kg)"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-700 mb-0.5">Satuan Target</label>
                                  <select
                                    value={mapping.pkgUnit}
                                    onChange={(e) => updateMapping(item.id, { pkgUnit: e.target.value }, item.unit)}
                                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none bg-white font-bold text-gray-900 cursor-pointer"
                                  >
                                    {item.unit && !availableUnitOptions.includes(item.unit.toLowerCase()) && (
                                      <option value={item.unit.toLowerCase()}>{item.unit}</option>
                                    )}
                                    {availableUnitOptions.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Action to Lock / Confirm this conversion */}
                              <div className="pt-1 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-gray-500 font-medium">
                                  Rasio: 1 {item.unit} = <strong>{mapping.pkgValue || "1"} {mapping.pkgUnit}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!mapping.pkgValue || parseFloat(mapping.pkgValue) <= 0) {
                                      alert("Isi per kemasan harus lebih dari 0.");
                                      return;
                                    }
                                    setPkgLocked((prev) => ({ ...prev, [item.id]: true }));
                                  }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Kunci Konversi Ini
                                </button>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                            <span>
                              Konversi: 1 {item.unit} = 1 {mapping.pkgUnit || item.unit} (Eceran)
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowCustomPkg((prev) => ({ ...prev, [item.id]: true }))}
                              className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 hover:underline"
                            >
                              ⚙️ Konversi Grosir ({item.unit} ke kg/gram)?
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Direct Confirmation Block when all items are mapped */}
            {isGroupFullyMapped && (
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">✓</span>
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    Semua Bahan Dipetakan! Konfirmasi Pembayaran & Update Stok
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-700">Metode Pembayaran:</label>
                    <select
                      value={paymentMethodState[group.transaction.id] || "cash"}
                      onChange={(e) => setPaymentMethodState(prev => ({ ...prev, [group.transaction.id]: e.target.value }))}
                      className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold bg-white text-gray-800 focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer"
                    >
                      <option value="cash">💵 Tunai (Cash)</option>
                      <option value="hutang">💳 Hutang (Kredit)</option>
                      <option value="transfer">🏦 Transfer Bank</option>
                    </select>
                  </div>
                  {(paymentMethodState[group.transaction.id] || "cash") === "hutang" && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-700">Jatuh Tempo:</label>
                      <input
                        type="date"
                        value={dueDateState[group.transaction.id] || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}
                        onChange={(e) => setDueDateState(prev => ({ ...prev, [group.transaction.id]: e.target.value }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold bg-white text-gray-800 focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleConfirmTransaction(group.transaction.id)}
                    disabled={confirmingTrxMap[group.transaction.id]}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {confirmingTrxMap[group.transaction.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memproses Konfirmasi...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Konfirmasi Pembayaran & Update Stok</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    })}

      {/* Help Info */}
      <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-5">
        <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
          Cara Pemetaan Bahan
        </h4>
        <ol className="mt-2 space-y-1 text-xs text-blue-800 list-decimal list-inside">
          <li>Pilih produk yang sesuai untuk setiap bahan yang belum dikenali</li>
          <li>Isi volume kemasan dan satuan jika perlu disesuaikan</li>
          <li>Klik <strong>&quot;Simpan Semua&quot;</strong> atau petakan per-item secara langsung</li>
          <li>Setelah semua bahan terpetakan, Anda dapat memilih metode pembayaran (Tunai/Hutang) dan klik <strong>&quot;Konfirmasi Pembayaran &amp; Update Stok&quot;</strong> langsung di Web atau via Telegram</li>
        </ol>
      </div>

      {/* ── Floating Bulk Save Bar ── */}
      {readyItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                {readyItems.length}
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {readyItems.length} bahan siap disimpan
                </p>
                <p className="text-xs text-gray-500">
                  dari {totalUnmapped} total bahan yang perlu dipetakan
                </p>
              </div>
            </div>
            <button
              onClick={handleBulkSave}
              disabled={bulkSaving}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                bulkSaving
                  ? "bg-gray-200 text-gray-500 cursor-wait"
                  : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-lg hover:shadow-xl active:scale-95"
              }`}
            >
              {bulkSaving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Menyimpan...
                </span>
              ) : (
                `Simpan Semua (${readyItems.length})`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
