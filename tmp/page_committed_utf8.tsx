"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { useNutritionRefs } from "@/lib/useNutritionRefs";
import { TabPemetaanBahan } from "../dapur/components/TabPemetaanBahan";
import { 
  Weight, 
  Stethoscope, 
  Link as LinkIcon, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

type MainTab = "satuan" | "nutrisi" | "mapping";
type MappingSubTab = "daftar" | "unmapped";

interface UnitWeight {
  id: string;
  ingredient_id: string;
  unit: string;
  weight_gram: number;
  master_ingredients?: {
    common_name: string;
  };
}

interface MasterIngredient {
  id: string;
  common_name: string;
}


interface NutritionRef {
  id: string;
  name: string;
  calories: number;
  proteins: number;
  fat: number;
  carbohydrate: number;
  fiber: number;
  sodium?: number;
  potassium?: number;
  kategori: string;
  data_source?: string;
  custom_nutrients?: {
    id_bahan?: string;
    kondisi?: string;
    bdd_persen?: number;
    air_g?: number;
    abu_g?: number;
    kalsium_mg?: number;
    fosfor_mg?: number;
    besi_mg?: number;
    tembaga_mg?: number;
    seng_mg?: number;
    retinol_mcg?: number;
    b_karoten_mcg?: number;
    karoten_total_mcg?: number;
    thiamin_mg?: number;
    riboflavin_mg?: number;
    niasin_mg?: number;
    vitamin_c_mg?: number;
  };
}

interface ProductAlias {
  id: string;
  product_id: string;
  alias_name: string;
  packaging_value: number;
  packaging_unit: string;
  source: string;
  confidence: number;
  products?: {
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
  unit: string;
  category: string;
}

interface IngredientMapping {
  id: number;
  nutrition_ref_id: number;
  nama_tkpi: string;
  kategori_induk: string;
  keyword_nota: string[];
  konversi_satuan: Array<{ satuan: string; berat_gram: number }>;
  source?: string;
}

export default function PenyetelanDapurPage() {
  const searchParams = useSearchParams();
  
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<MainTab>("satuan");
  const [mappingSubTab, setMappingSubTab] = useState<MappingSubTab>("daftar");

  // Global loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Master lists
  const [unitWeights, setUnitWeights] = useState<UnitWeight[]>([]);
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [ingredientMappings, setIngredientMappings] = useState<IngredientMapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [masterIngredients, setMasterIngredients] = useState<MasterIngredient[]>([]);

  const {
    nutritionRefs,
    totalCount,
    currentPage,
    pageSize,
    search: searchNutrisi,
    kategori: filterKategori,
    loading: loadingNutrition,
    error: nutritionError,
    exporting,
    totalPages,
    currentFrom,
    currentTo,
    setSearch: setSearchNutrisi,
    setKategori: setFilterKategori,
    setCurrentPage,
    setPageSize,
    reloadNutritionRefs,
    exportAllNutritionRefs,
  } = useNutritionRefs(50);

  // Search filters & show settings
  const [searchSatuan, setSearchSatuan] = useState("");
  const [searchMapping, setSearchMapping] = useState("");
  const [showMikro, setShowMikro] = useState(false);

  // CRUD modals state
  const [modalType, setModalType] = useState<"satuan" | "nutrisi" | "alias" | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null); // holds item being edited, or null for new

  // Form states
  const [formUnitWeight, setFormUnitWeight] = useState({
    ingredient_id: "",
    unit: "",
    weight_gram: "",
  });
  const [formNutrition, setFormNutrition] = useState({
    name: "",
    calories: "",
    proteins: "",
    fat: "",
    carbohydrate: "",
    fiber: "",
    sodium: "",
    potassium: "",
    kategori: "lainnya",
    // custom nutrients:
    id_bahan: "",
    kondisi: "",
    bdd_persen: "",
    air_g: "",
    abu_g: "",
    kalsium_mg: "",
    fosfor_mg: "",
    besi_mg: "",
    tembaga_mg: "",
    seng_mg: "",
    retinol_mcg: "",
    b_karoten_mcg: "",
    karoten_total_mcg: "",
    thiamin_mg: "",
    riboflavin_mg: "",
    niasin_mg: "",
    vitamin_c_mg: "",
  });
  const [formAlias, setFormAlias] = useState({
    product_id: "",
    alias_name: "",
    packaging_value: "1",
    packaging_unit: "pcs",
  });

  const [saving, setSaving] = useState(false);


  // Deep-link support: ?tab=mapping from Telegram
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "mapping") {
      setActiveTab("mapping");
      setMappingSubTab("unmapped");
    }
  }, [searchParams]);

  // Fetch all master configurations
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [satuanResp, aliasesResp, ingredientMappingsResp, productsResp, masterIngredResp] = await Promise.all([
        apiGet("/ingredients/unit-weights"),
        apiGet("/ingredients/aliases"),
        apiGet("/ingredients/ingredient-mappings"),
        apiGet("/products", { limit: 500 }),
        apiGet("/ingredients/master-ingredients"),
      ]);
      setUnitWeights(satuanResp || []);
      setAliases(aliasesResp || []);
      setIngredientMappings(ingredientMappingsResp || []);
      setProducts(productsResp.data || []);
      setMasterIngredients(masterIngredResp || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Gagal memuat data pengaturan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Modal
  const openModal = (type: "satuan" | "nutrisi" | "alias", item: any = null) => {
    setEditingItem(item);
    setModalType(type);
    
    if (type === "satuan") {
      setFormUnitWeight({
        ingredient_id: item?.ingredient_id || "",
        unit: item?.unit || "",
        weight_gram: item?.weight_gram?.toString() || "",
      });
    } else if (type === "nutrisi") {
      setFormNutrition({
        name: item?.name || "",
        calories: item?.calories?.toString() || "",
        proteins: item?.proteins?.toString() || "",
        fat: item?.fat?.toString() || "",
        carbohydrate: item?.carbohydrate?.toString() || "",
        fiber: item?.fiber?.toString() || "",
        sodium: item?.sodium?.toString() || "",
        potassium: item?.potassium?.toString() || "",
        kategori: item?.kategori || "lainnya",
        id_bahan: item?.custom_nutrients?.id_bahan || "",
        kondisi: item?.custom_nutrients?.kondisi || "",
        bdd_persen: item?.custom_nutrients?.bdd_persen?.toString() || "",
        air_g: item?.custom_nutrients?.air_g?.toString() || "",
        abu_g: item?.custom_nutrients?.abu_g?.toString() || "",
        kalsium_mg: item?.custom_nutrients?.kalsium_mg?.toString() || "",
        fosfor_mg: item?.custom_nutrients?.fosfor_mg?.toString() || "",
        besi_mg: item?.custom_nutrients?.besi_mg?.toString() || "",
        tembaga_mg: item?.custom_nutrients?.tembaga_mg?.toString() || "",
        seng_mg: item?.custom_nutrients?.seng_mg?.toString() || "",
        retinol_mcg: item?.custom_nutrients?.retinol_mcg?.toString() || "",
        b_karoten_mcg: item?.custom_nutrients?.b_karoten_mcg?.toString() || "",
        karoten_total_mcg: item?.custom_nutrients?.karoten_total_mcg?.toString() || "",
        thiamin_mg: item?.custom_nutrients?.thiamin_mg?.toString() || "",
        riboflavin_mg: item?.custom_nutrients?.riboflavin_mg?.toString() || "",
        niasin_mg: item?.custom_nutrients?.niasin_mg?.toString() || "",
        vitamin_c_mg: item?.custom_nutrients?.vitamin_c_mg?.toString() || "",
      });
    } else if (type === "alias") {
      setFormAlias({
        product_id: item?.product_id || "",
        alias_name: item?.alias_name || "",
        packaging_value: item?.packaging_value?.toString() || "1",
        packaging_unit: item?.packaging_unit || "pcs",
      });
    }
  };

  // Close Modal
  const closeModal = () => {
    setModalType(null);
    setEditingItem(null);
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const parseFloatOrNull = (val: string) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    };

    try {
      if (modalType === "satuan") {
        const payload = {
          ingredient_id: formUnitWeight.ingredient_id,
          unit: formUnitWeight.unit,
          weight_gram: parseFloat(formUnitWeight.weight_gram),
        };
        if (editingItem) {
          await apiPut(`/ingredients/unit-weights/${editingItem.id}`, payload);
        } else {
          await apiPost("/ingredients/unit-weights", payload);
        }
      } else if (modalType === "nutrisi") {
        const payload = {
          name: formNutrition.name.trim(),
          calories: parseFloatOrNull(formNutrition.calories) || 0,
          proteins: parseFloatOrNull(formNutrition.proteins) || 0,
          fat: parseFloatOrNull(formNutrition.fat) || 0,
          carbohydrate: parseFloatOrNull(formNutrition.carbohydrate) || 0,
          fiber: parseFloatOrNull(formNutrition.fiber) || 0,
          sodium: parseFloatOrNull(formNutrition.sodium),
          potassium: parseFloatOrNull(formNutrition.potassium),
          kategori: formNutrition.kategori.trim().toLowerCase(),
          data_source: editingItem?.data_source || "MANUAL",
          custom_nutrients: {
            id_bahan: formNutrition.id_bahan.trim() || null,
            kondisi: formNutrition.kondisi.trim() || null,
            bdd_persen: parseFloatOrNull(formNutrition.bdd_persen),
            air_g: parseFloatOrNull(formNutrition.air_g),
            abu_g: parseFloatOrNull(formNutrition.abu_g),
            kalsium_mg: parseFloatOrNull(formNutrition.kalsium_mg),
            fosfor_mg: parseFloatOrNull(formNutrition.fosfor_mg),
            besi_mg: parseFloatOrNull(formNutrition.besi_mg),
            tembaga_mg: parseFloatOrNull(formNutrition.tembaga_mg),
            seng_mg: parseFloatOrNull(formNutrition.seng_mg),
            retinol_mcg: parseFloatOrNull(formNutrition.retinol_mcg),
            b_karoten_mcg: parseFloatOrNull(formNutrition.b_karoten_mcg),
            karoten_total_mcg: parseFloatOrNull(formNutrition.karoten_total_mcg),
            thiamin_mg: parseFloatOrNull(formNutrition.thiamin_mg),
            riboflavin_mg: parseFloatOrNull(formNutrition.riboflavin_mg),
            niasin_mg: parseFloatOrNull(formNutrition.niasin_mg),
            vitamin_c_mg: parseFloatOrNull(formNutrition.vitamin_c_mg),
          }
        };
        if (editingItem) {
          await apiPut(`/ingredients/master/${editingItem.id}`, payload);
        } else {
          await apiPost("/ingredients/master", payload);
        }
      } else if (modalType === "alias") {
        const payload = {
          product_id: formAlias.product_id,
          alias_name: formAlias.alias_name,
          packaging_value: parseFloat(formAlias.packaging_value) || 1.0,
          packaging_unit: formAlias.packaging_unit,
        };
        if (editingItem) {
          await apiPut(`/ingredients/aliases/${editingItem.id}`, payload);
        } else {
          await apiPost("/ingredients/aliases", payload);
        }
      }
      closeModal();
      await fetchData();
      if (modalType === "nutrisi") {
        await reloadNutritionRefs();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (type: "satuan" | "nutrisi" | "alias", id: string | number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
    try {
      if (type === "satuan") {
        await apiDelete(`/ingredients/unit-weights/${id}`);
      } else if (type === "nutrisi") {
        await apiDelete(`/ingredients/master/${id}`);
      } else if (type === "alias") {
        await apiDelete(`/ingredients/aliases/${id}`);
      }
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Gagal menghapus data.");
    }
  };

  // Filter lists based on search keys
  const filteredSatuan = unitWeights.filter((w) => {
    const refName = w.master_ingredients?.common_name || "";
    const unitName = w.unit || "";
    return (
      refName.toLowerCase().includes(searchSatuan.toLowerCase()) ||
      unitName.toLowerCase().includes(searchSatuan.toLowerCase())
    );
  });

  const filteredNutrisi = nutritionRefs;

  // Extract unique categories for dropdown filters
  const uniqueCategories = Array.from(
    new Set(nutritionRefs.map((n) => n.kategori).filter(Boolean))
  ).sort();

  const filteredAliases = aliases.filter((a) => {
    const aliasName = a.alias_name || "";
    const prodName = a.products?.name || "";
    return (
      aliasName.toLowerCase().includes(searchMapping.toLowerCase()) ||
      prodName.toLowerCase().includes(searchMapping.toLowerCase())
    );
  });

  const filteredIngredientMappings = ingredientMappings.filter((m) => {
    const keywordText = (m.keyword_nota || []).join(" ");
    return (
      m.nama_tkpi.toLowerCase().includes(searchMapping.toLowerCase()) ||
      m.kategori_induk.toLowerCase().includes(searchMapping.toLowerCase()) ||
      keywordText.toLowerCase().includes(searchMapping.toLowerCase())
    );
  });

  const showIngredientMappings = aliases.length === 0 && ingredientMappings.length > 0;

  const UNIT_OPTIONS = [
    "pcs", "kg", "g", "gram", "ml", "l", "liter",
    "ons", "botol", "pouch", "bks", "dus", "sak",
    "goni", "ikat", "papan", "tabung", "karung", "pack", "sachet"
  ];

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium text-sm">Memuat data penyetelan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Terjadi Kesalahan</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={fetchData}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in mt-2">
      {/* ΓöÇΓöÇΓöÇ Header ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <div className="pt-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
          Penyetelan Dapur
        </h1>
        <p className="text-gray-500 font-medium text-sm mt-1">
          Kelola referensi satuan, database nutrisi bahan pokok, dan pemetaan bahan masakan.
        </p>
      </div>

      {/* ΓöÇΓöÇΓöÇ Main Tabs Navigation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <div className="sticky top-0 z-20 mt-0 pt-2 pb-2 bg-gray-50/90 backdrop-blur-md border-b border-gray-200/50 mb-6">
        <div className="flex gap-2 bg-white/70 backdrop-blur-xl rounded-2xl p-1.5 overflow-x-auto flex-nowrap no-scrollbar border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setActiveTab("satuan")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
              activeTab === "satuan"
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
            }`}
          >
            <Weight className="w-4 h-4" />
            <span>Referensi Satuan</span>
          </button>
          <button
            onClick={() => setActiveTab("nutrisi")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
              activeTab === "nutrisi"
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Database Nutrisi</span>
          </button>
          <button
            onClick={() => setActiveTab("mapping")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
              activeTab === "mapping"
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Mapping Bahan</span>
          </button>
        </div>
      </div>

      {/* ΓöÇΓöÇΓöÇ Main Content Panels ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white min-h-[500px]">
        
        {/* 1. REFERENSI SATUAN TAB */}
        {activeTab === "satuan" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari rujukan atau satuan..."
                  value={searchSatuan}
                  onChange={(e) => setSearchSatuan(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
              </div>
              <button
                onClick={() => openModal("satuan")}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm self-stretch sm:self-auto justify-center"
              >
                <Plus className="w-4 h-4" /> Tambah Rujukan
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-2xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4">Bahan Rujukan</th>
                    <th className="px-6 py-4">Nama Satuan</th>
                    <th className="px-6 py-4">Berat Bersih (Gram)</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                  {filteredSatuan.length > 0 ? (
                    filteredSatuan.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-gray-900 font-bold">{w.master_ingredients?.common_name || "N/A"}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">{w.unit}</span></td>
                        <td className="px-6 py-4">{w.weight_gram.toLocaleString("id-ID")} g</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openModal("satuan", w)}
                              className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete("satuan", w.id)}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                        Tidak ada referensi satuan ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. DATABASE NUTRISI TAB */}
        {activeTab === "nutrisi" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama bahan..."
                    value={searchNutrisi}
                    onChange={(e) => setSearchNutrisi(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                  />
                </div>
                
                {/* Category filter dropdown */}
                <select
                  value={filterKategori}
                  onChange={(e) => setFilterKategori(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white capitalize text-gray-600 font-semibold"
                >
                  <option value="semua">Semua Kategori</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Show mikro columns toggle */}
                <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm cursor-pointer select-none hover:bg-gray-100/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={showMikro}
                    onChange={(e) => setShowMikro(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300"
                  />
                  <span className="font-semibold text-gray-600 text-xs">Tampilkan Mikro</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportAllNutritionRefs()}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm self-stretch sm:self-auto justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 h-4 animate-spin" />
                  ) : (
                    <span>Export Excel</span>
                  )}
                </button>
                <button
                  onClick={() => openModal("nutrisi")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm self-stretch sm:self-auto justify-center"
                >
                  <Plus className="w-4 h-4" /> Tambah Data Gizi
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-gray-500 font-semibold px-1">
              <span>Menampilkan {currentFrom}ΓÇô{currentTo} dari {totalCount} data</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="px-3 py-1 rounded-lg bg-gray-50 text-gray-600">Hal {currentPage + 1} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="px-3 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Selanjutnya
                </button>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                >
                  {[25, 50, 100, 200].map((size) => (
                    <option key={size} value={size}>{size} / halaman</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-2xl no-scrollbar">
              <table className="w-full text-left border-collapse text-sm min-w-max">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                    <th className="px-4 py-4 min-w-[200px]">Bahan Makanan</th>
                    <th className="px-4 py-4 min-w-[120px]">Kategori</th>
                    <th className="px-4 py-4">Energi (kkal)</th>
                    <th className="px-4 py-4">Protein (g)</th>
                    <th className="px-4 py-4">Lemak (g)</th>
                    <th className="px-4 py-4">Karbo (g)</th>
                    <th className="px-4 py-4">Serat (g)</th>
                    <th className="px-4 py-4">Natrium (mg)</th>
                    <th className="px-4 py-4">Kalium (mg)</th>
                    {showMikro && (
                      <>
                        <th className="px-4 py-4">Air (g)</th>
                        <th className="px-4 py-4">Abu (g)</th>
                        <th className="px-4 py-4">Kalsium (mg)</th>
                        <th className="px-4 py-4">Fosfor (mg)</th>
                        <th className="px-4 py-4">Besi (mg)</th>
                        <th className="px-4 py-4">Tembaga (mg)</th>
                        <th className="px-4 py-4">Seng (mg)</th>
                        <th className="px-4 py-4">Retinol (mcg)</th>
                        <th className="px-4 py-4">╬▓-karoten (mcg)</th>
                        <th className="px-4 py-4">Karoten Tot. (mcg)</th>
                        <th className="px-4 py-4">Thiamin (mg)</th>
                        <th className="px-4 py-4">Riboflavin (mg)</th>
                        <th className="px-4 py-4">Niasin (mg)</th>
                        <th className="px-4 py-4">Vit C (mg)</th>
                        <th className="px-4 py-4">BDD (%)</th>
                        <th className="px-4 py-4 min-w-[120px]">Kondisi</th>
                      </>
                    )}
                    <th className="px-4 py-4 min-w-[100px]">Tipe</th>
                    <th className="px-4 py-4 text-right min-w-[100px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                  {filteredNutrisi.length > 0 ? (
                    filteredNutrisi.map((n) => {
                      const isGlobal = n.data_source && n.data_source.toUpperCase().startsWith("TKPI");
                      /** Format value with unit. Returns "-" if null/empty, otherwise "1,1 g" */
                      const fmtVal = (val: any, unit: string) => {
                        if (val === undefined || val === null || val === "" || isNaN(parseFloat(val))) return "-";
                        return `${parseFloat(val).toLocaleString("id-ID")} ${unit}`;
                      };

                      return (
                        <tr key={n.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-gray-900 font-bold whitespace-normal max-w-xs">{n.name}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 capitalize">
                              {n.kategori || "lainnya"}
                            </span>
                          </td>
                          <td className="px-4 py-3">{fmtVal(n.calories, "kkal")}</td>
                          <td className="px-4 py-3">{fmtVal(n.proteins, "g")}</td>
                          <td className="px-4 py-3">{fmtVal(n.fat, "g")}</td>
                          <td className="px-4 py-3">{fmtVal(n.carbohydrate, "g")}</td>
                          <td className="px-4 py-3">{fmtVal(n.fiber, "g")}</td>
                          <td className="px-4 py-3">{fmtVal(n.sodium, "mg")}</td>
                          <td className="px-4 py-3">{fmtVal(n.potassium, "mg")}</td>
                          {showMikro && (
                            <>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.air_g, "g")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.abu_g, "g")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.kalsium_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.fosfor_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.besi_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.tembaga_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.seng_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.retinol_mcg, "mcg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.b_karoten_mcg, "mcg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.karoten_total_mcg, "mcg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.thiamin_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.riboflavin_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.niasin_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.vitamin_c_mg, "mg")}</td>
                              <td className="px-4 py-3">{fmtVal(n.custom_nutrients?.bdd_persen, "%")}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 capitalize">{n.custom_nutrients?.kondisi || "-"}</td>
                            </>
                          )}
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              isGlobal ? "bg-emerald-50 text-emerald-700" : "bg-purple-50 text-purple-700"
                            }`}>
                              {isGlobal ? "Global" : "Custom"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openModal("nutrisi", n)}
                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete("nutrisi", n.id)}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={showMikro ? 27 : 11} className="px-6 py-10 text-center text-gray-400">
                        Tidak ada data yang ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. MAPPING BAHAN TAB */}
        {activeTab === "mapping" && (
          <div className="space-y-6">
            
            {/* Sub-tabs control */}
            <div className="flex gap-4 border-b border-gray-100 pb-3">
              <button
                onClick={() => setMappingSubTab("daftar")}
                className={`text-sm font-bold pb-2 transition-all border-b-2 relative ${
                  mappingSubTab === "daftar"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                ≡ƒöù Daftar Mapping
              </button>
              <button
                onClick={() => setMappingSubTab("unmapped")}
                className={`text-sm font-bold pb-2 transition-all border-b-2 relative flex items-center gap-1.5 ${
                  mappingSubTab === "unmapped"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                <span>ΓÜá∩╕Å Tidak Dikenali</span>
              </button>
            </div>

            {/* Sub-Tab 1: Daftar Mapping */}
            {mappingSubTab === "daftar" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari teks alias atau produk..."
                      value={searchMapping}
                      onChange={(e) => setSearchMapping(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                    />
                  </div>
                  <button
                    onClick={() => openModal("alias")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm self-stretch sm:self-auto justify-center"
                  >
                    <Plus className="w-4 h-4" /> Tambah Mapping
                  </button>
                </div>

                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                        {showIngredientMappings ? (
                          <>
                            <th className="px-6 py-4">Nama TKPI</th>
                            <th className="px-6 py-4">Kategori Induk</th>
                            <th className="px-6 py-4">Kata Kunci Nota</th>
                            <th className="px-6 py-4">Konversi Satuan</th>
                            <th className="px-6 py-4">Sumber</th>
                          </>
                        ) : (
                          <>
                            <th className="px-6 py-4">Teks Input Gagal / Alias</th>
                            <th className="px-6 py-4">Bahan Baku Standard (DB)</th>
                            <th className="px-6 py-4">Ukuran Kemasan Default</th>
                            <th className="px-6 py-4">Sumber</th>
                            <th className="px-6 py-4 text-right">Aksi</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                      {showIngredientMappings ? (
                        filteredIngredientMappings.length > 0 ? (
                          filteredIngredientMappings.map((m) => (
                            <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 text-gray-900 font-bold">{m.nama_tkpi}</td>
                              <td className="px-6 py-4">{m.kategori_induk || "N/A"}</td>
                              <td className="px-6 py-4 whitespace-normal max-w-xl">
                                {(m.keyword_nota || []).join(", ") || "-"}
                              </td>
                              <td className="px-6 py-4">
                                {(m.konversi_satuan || []).map((item, index) => (
                                  <div key={`${item.satuan}-${index}`} className="mb-1 text-sm text-gray-700">
                                    {item.satuan}: {item.berat_gram.toLocaleString("id-ID")} g
                                  </div>
                                ))}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  m.source === "manual" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"
                                }`}>
                                  {m.source || "generated"}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                              Tidak ada mapping ingredient ditemukan.
                            </td>
                          </tr>
                        )
                      ) : filteredAliases.length > 0 ? (
                        filteredAliases.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-gray-900 font-bold">≡ƒôé &quot;{a.alias_name}&quot;</td>
                            <td className="px-6 py-4">≡ƒôª {a.products?.name || "N/A"}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-bold">
                                {a.packaging_value} {a.packaging_unit}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                a.source === "manual" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"
                              }`}>
                                {a.source || "manual"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => openModal("alias", a)}
                                  className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete("alias", a.id)}
                                  className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                            Tidak ada mapping alias ditemukan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Tidak Dikenali (Log Bahan Gagal / Unmapped Nota) */}
            {mappingSubTab === "unmapped" && (
              <div>
                <TabPemetaanBahan />
              </div>
            )}

          </div>
        )}

      </div>

      {/* ΓöÇΓöÇΓöÇ CRUD Modal Forms ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      {modalType !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in">
          <div className={`bg-white rounded-3xl shadow-xl w-full border border-gray-100 overflow-hidden transition-all duration-300 ${
            modalType === "nutrisi" ? "max-w-3xl" : "max-w-lg"
          }`}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-base">
                {editingItem ? "Edit Data" : "Tambah Data Baru"}
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
              
              {/* SATUAN FORM */}
              {modalType === "satuan" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Bahan Rujukan (Standard)</label>
                    <select
                      value={formUnitWeight.ingredient_id}
                      onChange={(e) => setFormUnitWeight({...formUnitWeight, ingredient_id: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    >
                      <option value="">-- Pilih Bahan Baku Rujukan --</option>
                      {masterIngredients.map((m) => (
                        <option key={m.id} value={m.id}>{m.common_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Satuan (e.g. ikat, siung)</label>
                    <input
                      type="text"
                      placeholder="siung, ikat, papan, kg..."
                      value={formUnitWeight.unit}
                      onChange={(e) => setFormUnitWeight({...formUnitWeight, unit: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Berat Konversi Murni (Gram)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5, 250, 1000"
                      value={formUnitWeight.weight_gram}
                      onChange={(e) => setFormUnitWeight({...formUnitWeight, weight_gram: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    />
                  </div>
                </>
              )}

              {/* NUTRISI FORM */}
              {modalType === "nutrisi" && (
                <div className="space-y-6">
                  {/* Identitas & Informasi Umum */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Bahan Standard</label>
                      <input
                        type="text"
                        placeholder="Bawang Putih, Beras, Daging Sapi..."
                        value={formNutrition.name}
                        onChange={(e) => setFormNutrition({...formNutrition, name: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kategori Bahan</label>
                      <select
                        value={formNutrition.kategori}
                        onChange={(e) => setFormNutrition({...formNutrition, kategori: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white capitalize text-gray-700 font-semibold"
                      >
                        <option value="karbohidrat">Karbohidrat / Pokok</option>
                        <option value="lauk_pauk">Lauk Pauk / Protein</option>
                        <option value="sayuran">Sayuran / Serat</option>
                        <option value="buah">Buah-Buahan</option>
                        <option value="bumbu">Bumbu & Minyak</option>
                        <option value="susu">Susu & Olahan</option>
                        <option value="kebersihan_dapur">Kebersihan Dapur</option>
                        <option value="bahan_kemasan">Bahan Kemasan</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ID Bahan (TKPI/Custom)</label>
                      <input
                        type="text"
                        placeholder="e.g. BD001"
                        value={formNutrition.id_bahan}
                        onChange={(e) => setFormNutrition({...formNutrition, id_bahan: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kondisi Bahan</label>
                      <input
                        type="text"
                        placeholder="e.g. Segar, Dikeringkan"
                        value={formNutrition.kondisi}
                        onChange={(e) => setFormNutrition({...formNutrition, kondisi: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">BDD (%) (Dapat Dimakan)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 100"
                        value={formNutrition.bdd_persen}
                        onChange={(e) => setFormNutrition({...formNutrition, bdd_persen: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Makronutrien */}
                  <div>
                    <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-3">
                      Kandungan Makronutrien (per 100g)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Energi (kkal)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0"
                          value={formNutrition.calories}
                          onChange={(e) => setFormNutrition({...formNutrition, calories: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Air (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.air_g}
                          onChange={(e) => setFormNutrition({...formNutrition, air_g: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Protein (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.proteins}
                          onChange={(e) => setFormNutrition({...formNutrition, proteins: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Lemak (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.fat}
                          onChange={(e) => setFormNutrition({...formNutrition, fat: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Karbohidrat (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.carbohydrate}
                          onChange={(e) => setFormNutrition({...formNutrition, carbohydrate: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Serat (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.fiber}
                          onChange={(e) => setFormNutrition({...formNutrition, fiber: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Abu (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.abu_g}
                          onChange={(e) => setFormNutrition({...formNutrition, abu_g: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mineral */}
                  <div>
                    <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-3">
                      Kandungan Mineral (mg per 100g)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Kalsium (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.kalsium_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, kalsium_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Fosfor (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.fosfor_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, fosfor_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Besi (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.besi_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, besi_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Natrium (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.sodium}
                          onChange={(e) => setFormNutrition({...formNutrition, sodium: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Kalium (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.potassium}
                          onChange={(e) => setFormNutrition({...formNutrition, potassium: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Tembaga (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.tembaga_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, tembaga_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Seng (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.seng_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, seng_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vitamin */}
                  <div>
                    <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-3">
                      Kandungan Vitamin (per 100g)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Retinol (mcg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.retinol_mcg}
                          onChange={(e) => setFormNutrition({...formNutrition, retinol_mcg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">╬▓-karoten (mcg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.b_karoten_mcg}
                          onChange={(e) => setFormNutrition({...formNutrition, b_karoten_mcg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Karoten Total (mcg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.karoten_total_mcg}
                          onChange={(e) => setFormNutrition({...formNutrition, karoten_total_mcg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Thiamin (B1) (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.thiamin_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, thiamin_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Riboflavin (B2) (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.riboflavin_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, riboflavin_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Niasin (B3) (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.niasin_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, niasin_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Vitamin C (mg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.vitamin_c_mg}
                          onChange={(e) => setFormNutrition({...formNutrition, vitamin_c_mg: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ALIAS FORM */}
              {modalType === "alias" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Teks Alias (e.g. Bawang Putih Siung, Beras Cap Jempol)</label>
                    <input
                      type="text"
                      placeholder="Nama mentah/bebas yang sering tertulis di nota..."
                      value={formAlias.alias_name}
                      onChange={(e) => setFormAlias({...formAlias, alias_name: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ditargetkan ke Produk Baku (Standard)</label>
                    <select
                      value={formAlias.product_id}
                      onChange={(e) => setFormAlias({...formAlias, product_id: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    >
                      <option value="">-- Pilih Produk Standard --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Isi per Kemasan (Pengali)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="1"
                        value={formAlias.packaging_value}
                        onChange={(e) => setFormAlias({...formAlias, packaging_value: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Satuan Kemasan</label>
                      <select
                        value={formAlias.packaging_unit}
                        onChange={(e) => setFormAlias({...formAlias, packaging_unit: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        required
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              </div> {/* Close scrollable content div */}

              {/* Modal Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 px-6 pb-6 bg-gray-50/50">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
