"use client";

import React, { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { useNutritionRefs } from "@/lib/useNutritionRefs";
import { TabPemetaanBahan } from "../dapur/components/TabPemetaanBahan";
import { Modal } from "@/components/ui/Modal";
import {
  Weight,
  Stethoscope,
  Link as LinkIcon,
  Plus,
  Search,
  Trash2,
  Edit,
  Loader2,
  AlertCircle,
  Tag,
  Calculator,
  Layers3,
  X,
  ChevronDown,
  ChevronRight,
  GitFork,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Network,
  HelpCircle
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
  nutrition_ref_id?: number | null;
  category?: string;
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
    id?: string;
    name: string;
    category?: string;
    unit?: string;
    nutrition_ref_id?: number | null;
    nutrition_ref?: {
      id: number;
      name?: string;
      calories: number;
      proteins: number;
      fat: number;
      carbohydrate: number;
      fiber: number;
      kategori: string;
    };
  };
}

interface Product {
  id: string;
  name: string;
  unit: string;
  category: string;
  nutrition_ref_id?: number | null;
  nutrition_ref?: {
    id: number;
    name?: string;
    calories: number;
    proteins: number;
    fat: number;
    carbohydrate: number;
    fiber: number;
    kategori: string;
  };
}

interface IngredientMapping {
  id: number;
  nutrition_ref_id: number;
  nama_tkpi: string;
  kategori_induk: string;
  keyword_nota: string[];
  konversi_satuan: Array<{ satuan: string; berat_gram: number }>;
  source?: string;
  nutrition_ref?: {
    calories: number;
    proteins: number;
    fat: number;
    carbohydrate: number;
    fiber: number;
    kategori: string;
  };
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
  const [selectedReferenceIngredientId, setSelectedReferenceIngredientId] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientDropdownOpen, setIngredientDropdownOpen] = useState(false);
  const [creatingIngredient, setCreatingIngredient] = useState(false);
  const [unitFormMode, setUnitFormMode] = useState<"manual" | "multiplier">("manual");
  const [newUnitForm, setNewUnitForm] = useState({
    unit: "",
    weight_gram: "",
    multiplier: "1",
    baseUnit: "",
  });
  const [savingUnit, setSavingUnit] = useState(false);

  // Hierarchical Unit Chains State
  const [ingredientChains, setIngredientChains] = useState<any[]>([]);
  const [chainResolution, setChainResolution] = useState<any>(null);
  const [loadingChains, setLoadingChains] = useState(false);
  const [chainForm, setChainForm] = useState({
    from_qty: "1",
    from_unit: "",
    to_qty: "1",
    to_unit: "",
    description: "",
  });
  const [savingChain, setSavingChain] = useState(false);

  // CRUD modals state
  const [modalType, setModalType] = useState<"satuan" | "nutrisi" | "alias" | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null); // holds item being edited, or null for new

  // Accordion state for grouped aliases
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  const toggleProductExpand = (prodId: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [prodId]: !prev[prodId]
    }));
  };

  // State hooks for standard product combobox
  const [productComboboxSearch, setProductComboboxSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);

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

  // Nutrition linking modal state
  const [linkingProduct, setLinkingProduct] = useState<{ id: string; name: string; nutrition_ref_id?: number | null; nutrition_ref?: any } | null>(null);
  const [searchNutrisiLink, setSearchNutrisiLink] = useState("");
  const [savingNutrisiLink, setSavingNutrisiLink] = useState(false);
  const [modalNutritionResults, setModalNutritionResults] = useState<NutritionRef[]>([]);
  const [modalNutritionLoading, setModalNutritionLoading] = useState(false);

  // Live search for Nutrition Link Modal across full DB
  useEffect(() => {
    if (!linkingProduct) {
      setModalNutritionResults([]);
      return;
    }

    setModalNutritionLoading(true);
    const queryTerm = searchNutrisiLink.trim() || linkingProduct.name.split(",")[0].split(" ")[0].trim();

    const timer = setTimeout(async () => {
      try {
        const resp = await apiGet("/ingredients/master", {
          search: searchNutrisiLink.trim() ? searchNutrisiLink.trim() : queryTerm,
          limit: 50,
        });
        setModalNutritionResults(resp?.data || []);
      } catch (err) {
        console.error("Gagal cari database nutrisi modal:", err);
        setModalNutritionResults([]);
      } finally {
        setModalNutritionLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [linkingProduct, searchNutrisiLink]);

  const handleSaveNutritionLink = async (productId: string, nutritionRefId: number | null) => {
    setSavingNutrisiLink(true);
    try {
      await apiPut(`/products/${productId}`, { nutrition_ref_id: nutritionRefId });
      setLinkingProduct(null);
      setSearchNutrisiLink("");
      await fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Gagal menghubungkan data nutrisi ke produk.");
    } finally {
      setSavingNutrisiLink(false);
    }
  };


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

  useEffect(() => {
    if (masterIngredients.length === 0) {
      setSelectedReferenceIngredientId("");
      return;
    }

    if (!selectedReferenceIngredientId || !masterIngredients.some((m) => m.id === selectedReferenceIngredientId)) {
      setSelectedReferenceIngredientId(masterIngredients[0].id);
    }
  }, [masterIngredients, selectedReferenceIngredientId]);

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
    setProductComboboxSearch("");
    setProductDropdownOpen(false);
  };

  const selectedReferenceIngredient = useMemo(() => {
    return masterIngredients.find((m) => m.id === selectedReferenceIngredientId) || null;
  }, [masterIngredients, selectedReferenceIngredientId]);

  const selectedReferenceUnitWeights = useMemo(() => {
    const sel = masterIngredients.find((m) => m.id === selectedReferenceIngredientId);
    const refId = sel?.nutrition_ref_id;
    const selName = sel?.common_name?.trim().toLowerCase();

    return unitWeights
      .filter((w) => {
        if (w.ingredient_id === selectedReferenceIngredientId) return true;
        if (refId && (w as any).nutrition_ref_id === refId) return true;
        const wName = (w as any).master_ingredients?.common_name?.trim().toLowerCase();
        if (selName && wName && selName === wName) return true;
        return false;
      })
      .sort((a, b) => a.unit.localeCompare(b.unit));
  }, [unitWeights, masterIngredients, selectedReferenceIngredientId]);

  const filteredSelectedUnits = useMemo(() => {
    const query = searchSatuan.toLowerCase();
    if (!query) return selectedReferenceUnitWeights;

    return selectedReferenceUnitWeights.filter((w) => {
      return `${w.unit} ${w.weight_gram}`.toLowerCase().includes(query);
    });
  }, [searchSatuan, selectedReferenceUnitWeights]);

  const computedMultiplierWeight = useMemo(() => {
    const multiplier = Number(newUnitForm.multiplier);
    const baseUnitEntry = selectedReferenceUnitWeights.find(
      (w) => w.unit.toLowerCase() === newUnitForm.baseUnit.toLowerCase()
    );

    if (!Number.isFinite(multiplier) || multiplier <= 0 || !baseUnitEntry) return 0;
    return multiplier * baseUnitEntry.weight_gram;
  }, [newUnitForm.baseUnit, newUnitForm.multiplier, selectedReferenceUnitWeights]);

  const handleSaveReferenceUnit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReferenceIngredientId) {
      alert("Pilih bahan baku rujukan terlebih dahulu.");
      return;
    }

    setSavingUnit(true);
    try {
      let payload: { ingredient_id: string; unit: string; weight_gram: number; source: string };

      if (unitFormMode === "manual") {
        const unit = newUnitForm.unit.trim().toLowerCase();
        const weight = Number(newUnitForm.weight_gram);

        if (!unit) throw new Error("Nama satuan wajib diisi.");
        if (!Number.isFinite(weight) || weight <= 0) {
          throw new Error("Nilai gram harus lebih dari 0.");
        }

        payload = {
          ingredient_id: selectedReferenceIngredientId,
          unit,
          weight_gram: weight,
          source: "user_mapping",
        };
      } else {
        const unit = newUnitForm.unit.trim().toLowerCase();
        const multiplier = Number(newUnitForm.multiplier);
        const baseUnit = newUnitForm.baseUnit.trim().toLowerCase();

        if (!unit) throw new Error("Nama satuan baru wajib diisi.");
        if (!Number.isFinite(multiplier) || multiplier <= 0) {
          throw new Error("Pengali harus lebih dari 0.");
        }
        if (!baseUnit) throw new Error("Pilih satuan dasar yang sudah ada.");

        const baseUnitEntry = selectedReferenceUnitWeights.find((w) => w.unit.toLowerCase() === baseUnit);
        if (!baseUnitEntry) throw new Error("Satuan dasar tidak ditemukan untuk bahan ini.");

        payload = {
          ingredient_id: selectedReferenceIngredientId,
          unit,
          weight_gram: multiplier * baseUnitEntry.weight_gram,
          source: "user_mapping",
        };
      }

      await apiPost("/ingredients/unit-weights", payload);
      setNewUnitForm({ unit: "", weight_gram: "", multiplier: "1", baseUnit: selectedReferenceUnitWeights[0]?.unit || "" });
      await fetchData();
    } catch (err: any) {
      alert(err?.message || err?.response?.data?.detail || "Gagal menyimpan satuan.");
    } finally {
      setSavingUnit(false);
    }
  };

  const fetchIngredientChains = useCallback(async (ingId: string) => {
    if (!ingId) {
      setIngredientChains([]);
      setChainResolution(null);
      return;
    }
    setLoadingChains(true);
    try {
      const res = await apiGet(`/ingredients/chains/${ingId}`);
      setIngredientChains(res?.chains || []);
      setChainResolution(res?.resolution || null);
    } catch (err) {
      console.error("Gagal memuat rantai konversi:", err);
    } finally {
      setLoadingChains(false);
    }
  }, []);

  useEffect(() => {
    if (selectedReferenceIngredientId) {
      fetchIngredientChains(selectedReferenceIngredientId);
    }
  }, [selectedReferenceIngredientId, fetchIngredientChains]);

  const handleSaveChain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReferenceIngredientId) {
      alert("Pilih bahan baku rujukan terlebih dahulu.");
      return;
    }
    if (!chainForm.from_unit.trim() || !chainForm.to_unit.trim()) {
      alert("Satuan asal dan tujuan wajib diisi.");
      return;
    }
    setSavingChain(true);
    try {
      const payload = {
        ingredient_id: selectedReferenceIngredientId,
        from_qty: parseFloat(chainForm.from_qty) || 1,
        from_unit: chainForm.from_unit.trim().toLowerCase(),
        to_qty: parseFloat(chainForm.to_qty) || 1,
        to_unit: chainForm.to_unit.trim().toLowerCase(),
        description: chainForm.description.trim() || undefined,
      };
      await apiPost("/ingredients/chains", payload);
      await fetchIngredientChains(selectedReferenceIngredientId);
      const updatedWeights = await apiGet("/ingredients/unit-weights");
      setUnitWeights(updatedWeights || []);
      setChainForm({
        from_qty: "1",
        from_unit: "",
        to_qty: "1",
        to_unit: "",
        description: "",
      });
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Gagal menyimpan rantai konversi.");
    } finally {
      setSavingChain(false);
    }
  };

  const handleDeleteChain = async (chainId: string) => {
    if (!confirm("Hapus aturan rantai konversi ini?")) return;
    try {
      await apiDelete(`/ingredients/chains/${chainId}`);
      await fetchIngredientChains(selectedReferenceIngredientId);
      const updatedWeights = await apiGet("/ingredients/unit-weights");
      setUnitWeights(updatedWeights || []);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Gagal menghapus rantai konversi.");
    }
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
        if (editingItem) {
          const payload = {
            product_id: formAlias.product_id,
            alias_name: formAlias.alias_name.trim(),
            packaging_value: parseFloat(formAlias.packaging_value) || 1.0,
            packaging_unit: formAlias.packaging_unit,
          };
          await apiPut(`/ingredients/aliases/${editingItem.id}`, payload);
        } else {
          // Check for comma-separated aliases
          const aliasNames = formAlias.alias_name
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
          
          if (aliasNames.length === 0) {
            throw new Error("Teks Alias tidak boleh kosong.");
          }
          
          // Bulk create by mapping parallel apiPost calls
          await Promise.all(
            aliasNames.map((name) =>
              apiPost("/ingredients/aliases", {
                product_id: formAlias.product_id,
                alias_name: name,
                packaging_value: parseFloat(formAlias.packaging_value) || 1.0,
                packaging_unit: formAlias.packaging_unit,
              })
            )
          );
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
  const filteredNutrisi = nutritionRefs;

  // Combined reference ingredients (masterIngredients + standard products)
  const combinedReferenceIngredients = useMemo(() => {
    const list: { id: string; common_name: string; category?: string }[] = [...masterIngredients];
    const existingNames = new Set(masterIngredients.map((m) => m.common_name.toLowerCase()));

    products.forEach((p) => {
      if (p.name && !existingNames.has(p.name.toLowerCase())) {
        list.push({
          id: p.id,
          common_name: p.name,
          category: p.category || "bahan_baku",
        });
        existingNames.add(p.name.toLowerCase());
      }
    });

    return list.sort((a, b) => a.common_name.localeCompare(b.common_name));
  }, [masterIngredients, products]);

  // Extract unique categories for dropdown filters
  const uniqueCategories = useMemo(() => {
    const masterCats = ["buah", "daging", "ikan dsb", "kacang", "lemak", "sayur", "serealia", "umbi"];
    const loadedCats = nutritionRefs.map((n) => n.kategori).filter(Boolean);
    return Array.from(new Set([...masterCats, ...loadedCats])).sort();
  }, [nutritionRefs]);

  const filteredAliases = aliases.filter((a) => {
    const aliasName = a.alias_name || "";
    const prodName = a.products?.name || "";
    return (
      aliasName.toLowerCase().includes(searchMapping.toLowerCase()) ||
      prodName.toLowerCase().includes(searchMapping.toLowerCase())
    );
  });

  const groupedAliases = useMemo(() => {
    const groups: Record<
      string,
      {
        product_id: string;
        productName: string;
        productObj?: Product;
        aliases: typeof aliases;
      }
    > = {};

    filteredAliases.forEach((a) => {
      const prodId = a.product_id || "unmapped";
      const prodName = a.products?.name || "Bahan Baku Standard (Tidak Dikenali)";
      const prodMatch = products.find((p) => p.id === prodId) || (a.products as any);

      if (!groups[prodId]) {
        groups[prodId] = {
          product_id: prodId,
          productName: prodName,
          productObj: prodMatch,
          aliases: [],
        };
      }
      groups[prodId].aliases.push(a);
    });

    return Object.values(groups).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [filteredAliases, products]);

  const filteredIngredientMappings = ingredientMappings.filter((m) => {
    const keywordText = (m.keyword_nota || []).join(" ");
    return (
      m.nama_tkpi.toLowerCase().includes(searchMapping.toLowerCase()) ||
      m.kategori_induk.toLowerCase().includes(searchMapping.toLowerCase()) ||
      keywordText.toLowerCase().includes(searchMapping.toLowerCase())
    );
  });

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
    <>
      <div className="max-w-7xl mx-auto pb-20 animate-in mt-2">
        {/* Header */}
        <div className="pt-2 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Penyetelan Dapur
          </h1>
          <p className="text-gray-500 font-medium text-sm mt-1">
            Kelola referensi satuan, database nutrisi bahan pokok, dan pemetaan bahan masakan.
          </p>
        </div>

        {/* Main Tabs Navigation */}
        <div className="sticky top-0 z-20 mt-0 pt-2 pb-2 bg-gray-50/90 backdrop-blur-md border-b border-gray-200/50 mb-6">
          <div className="flex gap-2 bg-white/70 backdrop-blur-xl rounded-2xl p-1.5 overflow-x-auto flex-nowrap no-scrollbar border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <button
              onClick={() => setActiveTab("satuan")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${activeTab === "satuan"
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                }`}
            >
              <Weight className="w-4 h-4" />
              <span>Referensi Satuan</span>
            </button>
            <button
              onClick={() => setActiveTab("nutrisi")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${activeTab === "nutrisi"
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Database Nutrisi</span>
            </button>
            <button
              onClick={() => setActiveTab("mapping")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${activeTab === "mapping"
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>Mapping Bahan</span>
            </button>
          </div>
        </div>

        {/* Main Content Panels */}
        <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white min-h-[500px]">

          {/* 1. REFERENSI SATUAN TAB */}
          {activeTab === "satuan" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header Info Banner */}
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/90 p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3.5">
                    <div className="rounded-2xl bg-white p-3 text-blue-600 shadow-sm border border-blue-100/50 shrink-0">
                      <Network className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-gray-900">Rantai Konversi Satuan Bertingkat</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Hybrid Graph + Fast Cache O(1)
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 leading-relaxed max-w-3xl">
                        Susun hubungan satuan alami pasar (misal: <strong>4 Karung = 10 Dus</strong>, <strong>1 Dus = 9 Pcs</strong>, <strong>1 Pcs = 25 Gram</strong>). 
                        Mesin graf otomatis menghitung bobot bersih ke Base Unit (Gram) dan menguncinya di cache cepat agar OCR nota & stok berjalan seketika.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start rounded-2xl border border-blue-200/70 bg-white/90 px-4 py-2.5 text-sm text-gray-700 shadow-sm shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-bold text-gray-900">{ingredientChains.length}</span> aturan rantai aktif
                  </div>
                </div>
              </div>

              {/* Selector Bahan Baku Rujukan */}
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                    🎯 Pilih Bahan Baku Rujukan
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari atau ketik nama bahan..."
                      value={ingredientSearch}
                      onChange={(e) => {
                        setIngredientSearch(e.target.value);
                        setIngredientDropdownOpen(true);
                      }}
                      onFocus={() => setIngredientDropdownOpen(true)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white transition-all"
                    />
                    {ingredientDropdownOpen && (
                      <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                        {combinedReferenceIngredients
                          .filter((m) => m.common_name.toLowerCase().includes(ingredientSearch.toLowerCase()) || (m.category || "").toLowerCase().includes(ingredientSearch.toLowerCase()))
                          .slice(0, 30)
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedReferenceIngredientId(item.id);
                                setIngredientSearch("");
                                setIngredientDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between gap-2 ${item.id === selectedReferenceIngredientId ? "bg-blue-50/80 font-bold text-blue-700" : "text-gray-700"
                                }`}
                            >
                              <span className="truncate">{item.common_name}</span>
                              {item.category && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wide shrink-0">
                                  {item.category}
                                </span>
                              )}
                            </button>
                          ))}

                        {/* Creatable option */}
                        {(() => {
                          const searchVal = ingredientSearch.trim();
                          if (searchVal.length < 2) return null;
                          const hasExactMatch = combinedReferenceIngredients.some(
                            (m) => m.common_name.trim().toLowerCase() === searchVal.toLowerCase()
                          );
                          if (hasExactMatch) return null;
                          return (
                            <button
                              type="button"
                              disabled={creatingIngredient}
                              onClick={async () => {
                                setCreatingIngredient(true);
                                try {
                                  const result = await apiPost("/ingredients/master-ingredients", {
                                    common_name: searchVal,
                                  });
                                  if (result?.id) {
                                    setMasterIngredients((prev) => [
                                      ...prev,
                                      { id: result.id, common_name: result.common_name },
                                    ].sort((a, b) => a.common_name.localeCompare(b.common_name)));
                                    setSelectedReferenceIngredientId(result.id);
                                    setIngredientSearch("");
                                    setIngredientDropdownOpen(false);
                                  }
                                } catch (err: any) {
                                  alert(err?.response?.data?.detail || "Gagal membuat bahan baru.");
                                } finally {
                                  setCreatingIngredient(false);
                                }
                              }}
                              className="w-full text-left px-4 py-3 text-sm bg-emerald-50/80 hover:bg-emerald-100 transition-colors border-t-2 border-emerald-200 flex items-center gap-2 sticky bottom-0 disabled:opacity-50"
                            >
                              {creatingIngredient ? (
                                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                              ) : (
                                <span className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">+</span>
                              )}
                              <span className="text-emerald-800 font-semibold">
                                Buat Bahan Baru: <span className="font-bold text-emerald-600">&ldquo;{searchVal}&rdquo;</span>
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {ingredientDropdownOpen && (
                    <div className="fixed inset-0 z-20" onClick={() => setIngredientDropdownOpen(false)} />
                  )}

                  {selectedReferenceIngredient ? (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Bahan Aktif: {selectedReferenceIngredient.common_name}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-amber-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Belum ada bahan rujukan yang dipilih.
                    </p>
                  )}
                </div>

                {/* Quick Info Status Card */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                      <Layers3 className="w-4 h-4 text-blue-600" />
                      Status Resolusi Graf
                    </div>
                    <div className="mt-2.5">
                      {chainResolution?.has_cycle ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
                          <p className="font-bold flex items-center gap-1.5 text-red-800">
                            <AlertTriangle className="w-4 h-4 text-red-600" /> Terdeteksi Konversi Memutar!
                          </p>
                          <p className="mt-1">{chainResolution.errors?.join(", ")}</p>
                        </div>
                      ) : chainResolution?.is_valid && ingredientChains.length > 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 font-medium">
                          <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Rantai Valid & Terkunci ke Base Unit
                          </p>
                          <p className="mt-1">Seluruh satuan otomatis terhubung ke satuan dasar (Gram/Pcs).</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                          <p className="font-semibold text-gray-700">Belum ada aturan rantai bertingkat.</p>
                          <p className="mt-1">Buat aturan di bawah untuk menghubungkan satuan grosir ke satuan dasar.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>Cache Cepat DB:</span>
                    <span className="font-bold text-gray-800">{selectedReferenceUnitWeights.length} Satuan Siap Pakai</span>
                  </div>
                </div>
              </div>

              {/* FORM VISUAL CHAIN BUILDER (Input Rantai Alami) */}
              <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-blue-50/40 via-white to-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                      <GitFork className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Tambah Hubungan Rantai Satuan Baru</h3>
                      <p className="text-xs text-gray-500">Tulis pernyataan alami dari nota pasar atau kemasan supplier.</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveChain} className="mt-5 space-y-4">
                  {/* Natural Statement Row: [ 4 ] [ Karung ]  =  [ 10 ] [ Dus ] */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 sm:p-5">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                      {/* Left: From Unit */}
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">Jumlah</label>
                          <input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={chainForm.from_qty}
                            onChange={(e) => setChainForm((prev) => ({ ...prev, from_qty: e.target.value }))}
                            placeholder="4"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">Satuan Asal</label>
                          <input
                            type="text"
                            value={chainForm.from_unit}
                            onChange={(e) => setChainForm((prev) => ({ ...prev, from_unit: e.target.value }))}
                            placeholder="mis. karung"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            required
                          />
                        </div>
                      </div>

                      {/* Equal Sign Divider */}
                      <div className="flex flex-col items-center justify-center px-2 py-1 text-blue-600 font-extrabold text-lg">
                        <span className="hidden md:inline">=</span>
                        <span className="md:hidden text-xs text-gray-400 font-semibold my-1">sama dengan</span>
                      </div>

                      {/* Right: To Unit */}
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">Jumlah</label>
                          <input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={chainForm.to_qty}
                            onChange={(e) => setChainForm((prev) => ({ ...prev, to_qty: e.target.value }))}
                            placeholder="10"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">Satuan Tujuan</label>
                          <input
                            type="text"
                            value={chainForm.to_unit}
                            onChange={(e) => setChainForm((prev) => ({ ...prev, to_unit: e.target.value }))}
                            placeholder="mis. dus / gram / pcs"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick suggestion chips for To Unit */}
                    <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-gray-400 mr-1">Saran Satuan Tujuan:</span>
                      {["gram", "pcs", "kg", "liter", "dus", "pack", "ikat", "papan"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setChainForm((prev) => ({ ...prev, to_unit: s }))}
                          className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Formula Summary & Submit Button */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-gray-600 font-medium">
                      {chainForm.from_unit && chainForm.to_unit ? (
                        <span>
                          Preview: <strong>1 {chainForm.from_unit}</strong> ={" "}
                          <strong>
                            {(parseFloat(chainForm.to_qty) || 1) / (parseFloat(chainForm.from_qty) || 1)} {chainForm.to_unit}
                          </strong>
                        </span>
                      ) : (
                        <span className="text-gray-400">Isi satuan asal dan tujuan untuk melihat kalkulasi rasio.</span>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={savingChain || !selectedReferenceIngredientId}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      {savingChain ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Simpan Rantai Konversi
                    </button>
                  </div>
                </form>
              </div>

              {/* ACTIVE CHAIN RULES CARDS */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-blue-600" />
                    <h3 className="text-base font-bold text-gray-900">Aturan Rantai Aktif untuk Bahan Ini</h3>
                  </div>
                  {loadingChains && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                </div>

                {ingredientChains.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {ingredientChains.map((chain) => {
                      const mult = (parseFloat(chain.to_qty) || 1) / (parseFloat(chain.from_qty) || 1);
                      return (
                        <div
                          key={chain.id}
                          className="group relative rounded-2xl border border-gray-200 bg-gray-50/70 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aturan Rantai</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteChain(chain.id)}
                              className="opacity-60 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title="Hapus Rantai"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2 font-bold text-gray-900 text-sm">
                            <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-xl shadow-2xs">
                              {chain.from_qty} {chain.from_unit}
                            </span>
                            <ArrowRight className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-xl shadow-2xs text-blue-700">
                              {chain.to_qty} {chain.to_unit}
                            </span>
                          </div>

                          <p className="mt-2.5 text-[11px] text-gray-500 font-medium border-t border-gray-100 pt-2">
                            Rasio: 1 {chain.from_unit} = <strong>{mult} {chain.to_unit}</strong>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">
                    Belum ada aturan rantai satuan yang didaftarkan untuk bahan ini.
                  </div>
                )}
              </div>

              {/* RESOLVED CACHE TABLE (O(1) FAST LOOKUP) */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-base font-bold text-gray-900">Bobot Satuan Bersih (Fast Cache Database)</h3>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Nilai gramasi murni yang otomatis dipakai oleh modul OCR Nota, Potong Stok Resep (BOM), dan Perhitungan Gizi BGN.
                    </p>
                  </div>
                  <div className="relative w-full lg:max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari satuan terdaftar..."
                      value={searchSatuan}
                      onChange={(e) => setSearchSatuan(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                        <th className="px-6 py-3.5">Nama Satuan</th>
                        <th className="px-6 py-3.5">Jalur Traversal (Graph Path)</th>
                        <th className="px-6 py-3.5">Bobot Bersih (Base Gram)</th>
                        <th className="px-6 py-3.5">Status Sambungan</th>
                        <th className="px-6 py-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                      {filteredSelectedUnits.length > 0 ? (
                        filteredSelectedUnits.map((w) => {
                          const matchingResolution = chainResolution?.resolved_units?.find(
                            (r: any) => r.unit.toLowerCase() === w.unit.toLowerCase()
                          );
                          return (
                            <tr key={w.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-4">
                                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-extrabold uppercase">
                                  {w.unit}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-gray-600 font-mono">
                                {matchingResolution?.path || w.description || `${w.unit} -> gram`}
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-900">
                                {w.weight_gram.toLocaleString("id-ID")} <span className="text-xs font-normal text-gray-500">gram</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> Valid Base Unit
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => openModal("satuan", w)}
                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                    title="Edit Manual"
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
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                            Tidak ada satuan tersimpan untuk bahan ini. Buat rantai konversi di atas untuk menghasilkan satuan otomatis.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                <span>Menampilkan {currentFrom}-{currentTo} dari {totalCount} data</span>
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
                          <th className="px-4 py-4">β-karoten (mcg)</th>
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
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isGlobal ? "bg-emerald-50 text-emerald-700" : "bg-purple-50 text-purple-700"
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
                  className={`text-sm font-bold pb-2 transition-all border-b-2 relative ${mappingSubTab === "daftar"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                    }`}
                >
                  Daftar Mapping
                </button>
                <button
                  onClick={() => setMappingSubTab("unmapped")}
                  className={`text-sm font-bold pb-2 transition-all border-b-2 relative flex items-center gap-1.5 ${mappingSubTab === "unmapped"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                    }`}
                >
                  <span>Tidak Dikenali</span>
                </button>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Kamus satuan terhubung</p>
                    <h3 className="text-base font-semibold text-gray-900">Gunakan data rujukan yang sama saat memetakan bahan</h3>
                  </div>
                  <select
                    value={selectedReferenceIngredientId}
                    onChange={(e) => setSelectedReferenceIngredientId(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {masterIngredients.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.common_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedReferenceUnitWeights.length > 0 ? (
                    selectedReferenceUnitWeights.slice(0, 8).map((w) => (
                      <span key={w.id} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
                        {w.unit} = {w.weight_gram}g
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">Belum ada satuan yang terdaftar untuk bahan ini.</span>
                  )}
                </div>
              </div>

              {/* Sub-Tab 1: Daftar Mapping */}
              {mappingSubTab === "daftar" && (
                <div className="space-y-5">
                  {/* Search & Stats bar */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="relative w-full sm:max-w-sm">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cari bahan, kategori, atau alias nota..."
                        value={searchMapping}
                        onChange={(e) => setSearchMapping(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-medium">
                        {groupedAliases.length} Produk Baku | {filteredIngredientMappings.length} Ref Nutrisi
                      </span>
                      <button
                        onClick={() => openModal("alias")}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                      >
                        <Plus className="w-4 h-4" /> Tambah Mapping
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Produk Baku Dapur & Mapping Alias */}
                  {groupedAliases.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pt-2 pb-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                          <span>Daftar Produk Baku & Alias Terdaftar ({groupedAliases.length})</span>
                        </h3>
                        <span className="text-[11px] text-gray-400">Hubungkan setiap produk ke Database Nutrisi TKPI</span>
                      </div>

                      {groupedAliases.map((group) => {
                        const isExpanded = !!expandedProducts[group.product_id];
                        const prodObj = group.productObj || products.find((p) => p.id === group.product_id);
                        const nutRef = prodObj?.nutrition_ref;
                        const hasNut = nutRef && (nutRef.calories > 0 || nutRef.proteins > 0);

                        return (
                          <div
                            key={group.product_id}
                            className="rounded-2xl border border-gray-100 bg-white overflow-hidden hover:border-gray-200 transition-all shadow-sm"
                          >
                            {/* Header */}
                            <div className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div
                                className="flex items-start gap-3 flex-1 cursor-pointer"
                                onClick={() => toggleProductExpand(group.product_id)}
                              >
                                <div className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 shrink-0 mt-0.5">
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <h4 className="text-base font-bold text-gray-900">{group.productName}</h4>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                      {group.aliases.length} Alias Terdaftar
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    Alias: <span className="font-medium text-gray-700">{group.aliases.map((a) => `"${a.alias_name}"`).join(", ")}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Nutrition Info & Link Action */}
                              <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                                {hasNut ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 bg-emerald-50/70 border border-emerald-100 px-3 py-1.5 rounded-xl">
                                      <span className="text-xs font-bold text-emerald-800">
                                        🥗 {nutRef.name || group.productName}
                                      </span>
                                      {nutRef.kategori && (
                                        <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                          {nutRef.kategori}
                                        </span>
                                      )}
                                    </div>
                                    <div className="hidden lg:flex items-center gap-1 text-[11px] font-bold">
                                      <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">{Math.round(nutRef.calories)} kkal</span>
                                      <span className="px-2 py-1 bg-red-50 text-red-700 rounded-lg border border-red-100">P: {Number(nutRef.proteins).toFixed(1)}g</span>
                                      <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-100">L: {Number(nutRef.fat).toFixed(1)}g</span>
                                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">K: {Number(nutRef.carbohydrate).toFixed(1)}g</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLinkingProduct(prodObj || { id: group.product_id, name: group.productName });
                                      }}
                                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                                      title="Ubah Hubungan Database Nutrisi"
                                    >
                                      ✏️ Ubah DB
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-xl font-semibold border border-amber-200">
                                      ⚠️ Belum Terhubung DB Nutrisi
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLinkingProduct(prodObj || { id: group.product_id, name: group.productName });
                                      }}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                    >
                                      <Stethoscope className="w-3.5 h-3.5" />
                                      <span>+ Hubungkan DB Nutrisi</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Accordion Detail Content */}
                            {isExpanded && (
                              <div className="border-t border-gray-100 bg-gray-50/40 p-4 space-y-3">
                                {/* Nutrition Details Card if linked */}
                                {hasNut && (
                                  <div className="bg-white rounded-xl border border-gray-200 p-3.5">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">📊 Content Nutrisi per 100g (Standard TKPI)</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                      <div className="px-3 py-2 bg-orange-50 rounded-lg border border-orange-100">
                                        <p className="text-[10px] text-orange-500 font-semibold uppercase">Kalori</p>
                                        <p className="text-sm font-bold text-orange-700">{Math.round(nutRef.calories)} kkal</p>
                                      </div>
                                      <div className="px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                                        <p className="text-[10px] text-red-500 font-semibold uppercase">Protein</p>
                                        <p className="text-sm font-bold text-red-700">{Number(nutRef.proteins).toFixed(1)} g</p>
                                      </div>
                                      <div className="px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-100">
                                        <p className="text-[10px] text-yellow-600 font-semibold uppercase">Lemak</p>
                                        <p className="text-sm font-bold text-yellow-700">{Number(nutRef.fat).toFixed(1)} g</p>
                                      </div>
                                      <div className="px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                        <p className="text-[10px] text-indigo-500 font-semibold uppercase">Karbohidrat</p>
                                        <p className="text-sm font-bold text-indigo-700">{Number(nutRef.carbohydrate).toFixed(1)} g</p>
                                      </div>
                                      <div className="px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                                        <p className="text-[10px] text-green-500 font-semibold uppercase">Serat</p>
                                        <p className="text-sm font-bold text-green-700">{Number(nutRef.fiber).toFixed(1)} g</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Aliases Table */}
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                  <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                      <tr>
                                        <th className="px-4 py-3">Teks Input Gagal / Alias</th>
                                        <th className="px-4 py-3">Ukuran Kemasan Default</th>
                                        <th className="px-4 py-3">Sumber</th>
                                        <th className="px-4 py-3 text-right">Aksi</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                                      {group.aliases.map((a) => (
                                        <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                                          <td className="px-4 py-3 font-bold text-gray-900">&quot;{a.alias_name}&quot;</td>
                                          <td className="px-4 py-3">
                                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-bold">
                                              {a.packaging_value} {a.packaging_unit}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                              {a.source || "web_mapping"}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1.5">
                                              <button
                                                onClick={() => openModal("alias", a)}
                                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                title="Edit Alias"
                                              >
                                                <Edit className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleDelete("alias", a.id)}
                                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                title="Hapus Alias"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl">📋</div>
                      <h3 className="text-sm font-bold text-gray-900">Belum ada produk alias terdaftar</h3>
                      <p className="text-xs text-gray-500 max-w-sm">
                        Proses nota pembelian di Telegram atau tambahkan alias manual untuk mulai menghubungkan nama produk toko ke database nutrisi.
                      </p>
                    </div>
                  )}

                  {/* Section 2: AI / TKPI Ingredient Mappings (if available) */}
                  {filteredIngredientMappings.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Referensi Mapping TKPI ({filteredIngredientMappings.length})
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {filteredIngredientMappings.map((m) => {
                          const isExpanded = !!expandedProducts[`im_${m.id}`];
                          const nut = m.nutrition_ref;
                          const hasNutrition = nut && (nut.calories > 0 || nut.proteins > 0);
                          const keywords = m.keyword_nota || [];
                          const conversions = m.konversi_satuan || [];

                          return (
                            <div
                              key={m.id}
                              className="rounded-2xl border border-gray-100 bg-white overflow-hidden hover:border-gray-200 transition-all shadow-sm"
                            >
                              <div
                                className="px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                                onClick={() => setExpandedProducts((prev) => ({ ...prev, [`im_${m.id}`]: !prev[`im_${m.id}`] }))}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <h4 className="text-sm font-bold text-gray-900 truncate">{m.nama_tkpi}</h4>
                                      {m.kategori_induk && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide shrink-0">
                                          {m.kategori_induk}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    {hasNutrition && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold">{Math.round(nut.calories)} kkal</span>
                                        <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-bold">P: {Number(nut.proteins).toFixed(1)}g</span>
                                      </div>
                                    )}
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 2: Tidak Dikenali (Log Bahan Gagal / Unmapped Nota) */}
              {mappingSubTab === "unmapped" && (
                <div>
                  <TabPemetaanBahan
                    selectedReferenceIngredientId={selectedReferenceIngredientId}
                    selectedReferenceIngredientName={selectedReferenceIngredient?.common_name || ""}
                    referenceUnitWeights={selectedReferenceUnitWeights}
                    globalUnitWeights={unitWeights}
                  />
                </div>
              )}

            </div>
          )}

        </div>
        {/* End Main Container */}

        {/* CRUD Modal Forms */}
        <Modal
          isOpen={modalType !== null}
          onClose={closeModal}
          title={editingItem ? "Edit Data" : "Tambah Data Baru"}
          maxWidthClassName={modalType === "nutrisi" ? "max-w-3xl" : "max-w-lg"}
          footer={
            <>
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="crud-form"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Simpan</span>
              </button>
            </>
          }
        >
          {modalType !== null && (
            <form id="crud-form" onSubmit={handleSave} className="space-y-4">

              {/* SATUAN FORM */}
              {modalType === "satuan" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Bahan Rujukan (Standard)</label>
                    <select
                      value={formUnitWeight.ingredient_id}
                      onChange={(e) => setFormUnitWeight({ ...formUnitWeight, ingredient_id: e.target.value })}
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
                      onChange={(e) => setFormUnitWeight({ ...formUnitWeight, unit: e.target.value })}
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
                      onChange={(e) => setFormUnitWeight({ ...formUnitWeight, weight_gram: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    />
                  </div>
                </>
              )}

              {/* NUTRISI FORM */}
              {modalType === "nutrisi" && (
                <div className="space-y-6">
                  {/* Nama Standard */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Standard (Database)</label>
                    <input
                      type="text"
                      placeholder="e.g. Bawang Merah, Kangkung Segar..."
                      value={formNutrition.name}
                      onChange={(e) => setFormNutrition({ ...formNutrition, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    />
                  </div>

                  {/* Kategori */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kategori Bahan</label>
                    <select
                      value={formNutrition.kategori}
                      onChange={(e) => setFormNutrition({ ...formNutrition, kategori: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    >
                      <option value="">-- Pilih Kategori --</option>
                      <option value="karbohidrat">Karbohidrat / Makanan Pokok</option>
                      <option value="lauk hewani">Lauk Hewani</option>
                      <option value="lauk nabati">Lauk Nabati</option>
                      <option value="sayur">Sayuran</option>
                      <option value="buah">Buah-buahan</option>
                      <option value="bumbu">Bumbu & Bahan Pelengkap</option>
                      <option value="minyak">Minyak & Lemak</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>

                  {/* Makro */}
                  <div>
                    <h4 className="font-bold text-xs text-blue-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-3">
                      Nilai Gizi Makro (per 100g BDD)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Energi (kal)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.calories}
                          onChange={(e) => setFormNutrition({ ...formNutrition, calories: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Protein (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.proteins}
                          onChange={(e) => setFormNutrition({ ...formNutrition, proteins: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Lemak (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.fat}
                          onChange={(e) => setFormNutrition({ ...formNutrition, fat: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Karbo (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.carbohydrate}
                          onChange={(e) => setFormNutrition({ ...formNutrition, carbohydrate: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Serat (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.fiber}
                          onChange={(e) => setFormNutrition({ ...formNutrition, fiber: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kebutuhan Lainnya (Opsional) */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150 space-y-4">
                    <span className="text-xs font-bold text-gray-700 block">Detail Komposisi Fisik & Air (Opsional)</span>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">BDD (%)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="100"
                          value={formNutrition.bdd_persen}
                          onChange={(e) => setFormNutrition({ ...formNutrition, bdd_persen: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Kandungan Air (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.air_g}
                          onChange={(e) => setFormNutrition({ ...formNutrition, air_g: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Kandungan Abu (g)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.abu_g}
                          onChange={(e) => setFormNutrition({ ...formNutrition, abu_g: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, kalsium_mg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, fosfor_mg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, besi_mg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, sodium: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, potassium: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, tembaga_mg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, seng_mg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, retinol_mcg: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">ß-karoten (mcg)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={formNutrition.b_karoten_mcg}
                          onChange={(e) => setFormNutrition({ ...formNutrition, b_karoten_mcg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, karoten_total_mcg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, thiamin_mg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, riboflavin_mg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, niasin_mg: e.target.value })}
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
                          onChange={(e) => setFormNutrition({ ...formNutrition, vitamin_c_mg: e.target.value })}
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
                      onChange={(e) => setFormAlias({ ...formAlias, alias_name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ditargetkan ke Produk Baku (Standard)</label>
                    {formAlias.product_id ? (
                      <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 font-semibold mb-2">
                        <span>
                          {products.find((p) => p.id === formAlias.product_id)?.name || "Produk Terpilih"} ({products.find((p) => p.id === formAlias.product_id)?.unit || "pcs"})
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormAlias({ ...formAlias, product_id: "" })}
                          className="text-blue-500 hover:text-red-500 text-xs font-bold"
                        >
                          Ubah
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Cari atau ketik nama produk standard baru..."
                            value={productComboboxSearch}
                            onChange={(e) => {
                              setProductComboboxSearch(e.target.value);
                              setProductDropdownOpen(true);
                            }}
                            onFocus={() => setProductDropdownOpen(true)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                            required={!formAlias.product_id}
                          />
                        </div>
                        
                        {productDropdownOpen && (
                          <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            {products
                              .filter((p) => p.name.toLowerCase().includes(productComboboxSearch.toLowerCase()))
                              .slice(0, 30)
                              .map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setFormAlias({ ...formAlias, product_id: p.id });
                                    setProductComboboxSearch("");
                                    setProductDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 text-gray-700 flex justify-between items-center"
                                >
                                  <span className="font-semibold">{p.name}</span>
                                  <span className="text-xs text-gray-400 uppercase">{p.unit}</span>
                                </button>
                              ))}
                              
                            {/* Creatable Option */}
                            {(() => {
                              const searchVal = productComboboxSearch.trim();
                              if (searchVal.length < 2) return null;
                              const hasExactMatch = products.some(
                                (p) => p.name.trim().toLowerCase() === searchVal.toLowerCase()
                              );
                              if (hasExactMatch) return null;
                              return (
                                <button
                                  type="button"
                                  disabled={creatingProduct}
                                  onClick={async () => {
                                    setCreatingProduct(true);
                                    try {
                                      const result = await apiPost("/products", {
                                        name: searchVal,
                                        category: "bahan_baku",
                                        unit: formAlias.packaging_unit || "pcs",
                                        display_unit: formAlias.packaging_unit || "pcs",
                                        stock_qty: 0,
                                        stock_min: 0,
                                        harga: 0,
                                        sell_price: 0,
                                      });
                                      if (result?.id) {
                                        setProducts((prev) => [
                                          ...prev,
                                          { id: result.id, name: result.name, unit: result.unit, category: result.category }
                                        ].sort((a, b) => a.name.localeCompare(b.name)));
                                        setFormAlias({ ...formAlias, product_id: result.id });
                                        setProductComboboxSearch("");
                                        setProductDropdownOpen(false);
                                      }
                                    } catch (err: any) {
                                      alert(err?.response?.data?.detail || "Gagal membuat produk standard baru.");
                                    } finally {
                                      setCreatingProduct(false);
                                    }
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm bg-emerald-50/60 hover:bg-emerald-100 transition-colors border-t-2 border-emerald-200 flex items-center gap-2 sticky bottom-0 disabled:opacity-50"
                                >
                                  {creatingProduct ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                  ) : (
                                    <span className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">+</span>
                                  )}
                                  <span className="text-emerald-800 font-semibold">
                                    Buat Produk Baku Standard Baru: <span className="font-bold text-emerald-600">&ldquo;{searchVal}&rdquo;</span>
                                  </span>
                                </button>
                              );
                            })()}
                            
                            {products.filter((p) => p.name.toLowerCase().includes(productComboboxSearch.toLowerCase())).length === 0 && productComboboxSearch.trim().length < 2 && (
                              <p className="px-4 py-3 text-xs text-gray-400">Ketik minimal 2 karakter untuk mencari atau membuat produk standard baru.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Isi per Kemasan (Pengali)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="1"
                        value={formAlias.packaging_value}
                        onChange={(e) => setFormAlias({ ...formAlias, packaging_value: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Satuan Kemasan</label>
                      <select
                        value={formAlias.packaging_unit}
                        onChange={(e) => setFormAlias({ ...formAlias, packaging_unit: e.target.value })}
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
            </form>
          )}
        </Modal>

        {/* Modal Hubungkan DB Nutrisi */}
        {linkingProduct && (
          <Modal
            isOpen={!!linkingProduct}
            onClose={() => { setLinkingProduct(null); setSearchNutrisiLink(""); }}
            title={`Hubungkan Produk "${linkingProduct.name}" ke Database Nutrisi`}
          >
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3 text-xs text-blue-800">
                Pilih item referensi nutrisi standar TKPI yang sesuai dengan produk <strong>{linkingProduct.name}</strong> agar kandungan gizi dan perhitungan BOM dapur terhitung otomatis.
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Cari nutrisi (misal: ${linkingProduct.name}, beras, telur)...`}
                  value={searchNutrisiLink}
                  onChange={(e) => setSearchNutrisiLink(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white"
                />
              </div>

              <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                {modalNutritionLoading ? (
                  <div className="p-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Mencari di seluruh database nutrisi...</span>
                  </div>
                ) : modalNutritionResults.length > 0 ? (
                  modalNutritionResults.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleSaveNutritionLink(linkingProduct.id, Number(n.id))}
                      disabled={savingNutrisiLink}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-3 group border-b border-gray-50 last:border-0 disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{n.name}</p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 uppercase mt-0.5 inline-block">
                          {n.kategori || "Lainnya"}
                        </span>
                      </div>
                      <div className="text-right text-xs text-gray-500 shrink-0">
                        <p className="font-bold text-orange-600">{Math.round(n.calories)} kkal</p>
                        <p className="text-[10px]">P: {Number(n.proteins).toFixed(1)}g | L: {Number(n.fat).toFixed(1)}g | K: {Number(n.carbohydrate).toFixed(1)}g</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-gray-400">
                    Tidak ditemukan referensi nutrisi yang sesuai. Coba ketik kata kunci lain (misal: bihun, telur, daging).
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                {linkingProduct.nutrition_ref_id ? (
                  <button
                    onClick={() => handleSaveNutritionLink(linkingProduct.id, null)}
                    disabled={savingNutrisiLink}
                    className="text-xs text-red-600 hover:text-red-800 font-semibold"
                  >
                    Lepas Hubungan Nutrisi
                  </button>
                ) : <div />}
                <button
                  onClick={() => { setLinkingProduct(null); setSearchNutrisiLink(""); }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
              </div>
            </div>
          </Modal>
        )}

      </div> {/* 🔥 KUNCI DI SINI! Penutup untuk <div className="max-w-7xl..."> */}
    </>
  );
}

