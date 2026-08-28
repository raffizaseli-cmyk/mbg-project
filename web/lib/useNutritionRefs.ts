import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

export interface NutritionRef {
  id: number;
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

interface NutritionResponse {
  data: NutritionRef[];
  count: number;
}

const PAGE_LIMIT = 1000;

export function useNutritionRefs(initialPageSize = 50) {
  const [nutritionRefs, setNutritionRefs] = useState<NutritionRef[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [kategori, setKategori] = useState("semua");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const totalPages = useMemo(() => {
    if (!totalCount) return 1;
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount, pageSize]);

  const currentFrom = useMemo(() => {
    if (!totalCount) return 0;
    return currentPage * pageSize + 1;
  }, [currentPage, pageSize, totalCount]);

  const currentTo = useMemo(() => {
    return Math.min(totalCount, currentPage * pageSize + nutritionRefs.length);
  }, [currentPage, pageSize, totalCount, nutritionRefs.length]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, any> = {
        limit: pageSize,
        offset: currentPage * pageSize,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (kategori && kategori.trim().toLowerCase() !== "semua") {
        params.kategori = kategori.trim().toLowerCase();
      }

      const response = await apiGet("/ingredients/master", params) as NutritionResponse;
      setNutritionRefs(response.data || []);
      setTotalCount(response.count ?? response.data?.length ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Gagal memuat data nutrisi.");
    } finally {
      setLoading(false);
    }
  }, [search, kategori, pageSize, currentPage]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [search, kategori, pageSize]);

  const reloadNutritionRefs = useCallback(() => {
    loadPage();
  }, [loadPage]);

  const exportAllNutritionRefs = useCallback(async () => {
    setExporting(true);
    try {
      const allRows: NutritionRef[] = [];
      let offset = 0;
      let total = 0;

      do {
        const params: Record<string, any> = {
          limit: PAGE_LIMIT,
          offset,
        };

        if (search.trim()) params.search = search.trim();
        if (kategori && kategori.trim().toLowerCase() !== "semua") {
          params.kategori = kategori.trim().toLowerCase();
        }

        const response = await apiGet("/ingredients/master", params) as NutritionResponse;
        const pageItems = response.data || [];
        total = response.count ?? total;
        allRows.push(...pageItems);
        offset += PAGE_LIMIT;
      } while (allRows.length < total);

      if (allRows.length === 0) {
        throw new Error("Tidak ada data untuk diekspor.");
      }

      const XLSX = await import("xlsx");
      const rows = allRows.map((row) => ({
        id: row.id,
        name: row.name,
        kategori: row.kategori,
        data_source: row.data_source,
        calories: row.calories,
        proteins: row.proteins,
        fat: row.fat,
        carbohydrate: row.carbohydrate,
        fiber: row.fiber,
        sodium: row.sodium,
        potassium: row.potassium,
        ...row.custom_nutrients,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "NutritionRef");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `nutrition_ref_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      throw err;
    } finally {
      setExporting(false);
    }
  }, [search, kategori]);

  return {
    nutritionRefs,
    totalCount,
    currentPage,
    pageSize,
    search,
    kategori,
    loading,
    error,
    exporting,
    totalPages,
    currentFrom,
    currentTo,
    setSearch,
    setKategori,
    setCurrentPage,
    setPageSize,
    reloadNutritionRefs,
    exportAllNutritionRefs,
  };
}
