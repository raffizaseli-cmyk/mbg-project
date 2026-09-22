"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiDelete, apiPut, apiPost } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { BaseModal } from "@/components/ui/BaseModal";
import Link from "next/link";
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  Search, 
  Download, 
  History, 
  Edit3, 
  Trash2, 
  Check, 
  RotateCcw, 
  Calendar, 
  Layers, 
  Info, 
  Sparkles,
  ChevronRight,
  ChevronDown,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";

function formatRp(val: string | number): string {
    const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
        .format(n).replace("IDR", "Rp");
}

interface Product {
    id: string;
    name: string;
    category?: string;
    unit: string;
    display_unit?: string;
    base_unit?: string;
    conversion_factor?: number;
    harga: string;
    stock_qty: number;
    stock_qty_display?: number;
    stock_min: number;
    stock_min_display?: number;
    is_low_stock: boolean;
}

interface HistoryRow {
    id: string;
    change_qty: string;
    running_balance: string;
    reason?: string;
    notes?: string;
    created_at: string;
}

interface DayBreakdown {
    date: string;
    needed: number;
    stock_after: number;
    sufficient: boolean;
}

interface ProjectionItem {
    product_id: string;
    name: string;
    unit: string;
    display_unit?: string;
    stock_qty: number;
    stock_qty_display?: number;
    stock_min: number;
    daily_usage: number;
    days_remaining: number;
    needed_for_period: number;
    sufficient: boolean;
    shortage: number;
    status: "aman" | "menipis" | "kritis" | "habis";
    day_breakdown?: DayBreakdown[];
}

interface ProjectionData {
    projection_days: number;
    based_on_menu: boolean;
    items: ProjectionItem[];
    summary: {
        total_items: number;
        sufficient_count: number;
        warning_count: number;
        critical_count: number;
    };
}

interface KoreksiModal {
    product: Product;
}

function getStockStatus(qty: number, min: number): { label: string; className: string; dotColor: string } {
    if (qty === 0) return { label: "Habis", className: "text-slate-700 bg-slate-100 border-slate-200", dotColor: "bg-slate-400" };
    if (qty <= min) return { label: "Kritis", className: "text-rose-700 bg-rose-500/10 border-rose-500/20", dotColor: "bg-rose-500" };
    if (qty <= min * 2) return { label: "Menipis", className: "text-amber-700 bg-amber-500/10 border-amber-500/20", dotColor: "bg-amber-500" };
    return { label: "Aman", className: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20", dotColor: "bg-emerald-500" };
}

function DaysDisplay({ days, stock }: { days: number; stock: number }) {
    if (stock <= 0) return <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg text-xs">HABIS</span>;
    if (days >= 999) return <span className="text-emerald-700 font-semibold text-xs">Tidak terpakai</span>;
    if (days === 0) return <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg text-xs">HABIS</span>;
    if (days < 1) return <span className="text-rose-600 font-extrabold text-xs">Hampir Habis</span>;
    if (days <= 7) return <span className="text-amber-700 font-bold text-xs">{days.toFixed(1)} hari</span>;
    if (days <= 30) return <span className="text-blue-700 font-semibold text-xs">{Math.round(days)} hari</span>;
    return <span className="text-emerald-700 font-semibold text-xs">30+ hari</span>;
}

export default function StokPage() {
    const [category, setCategory] = useState("all");
    const [search, setSearch] = useState("");
    const [items, setItems] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortCol, setSortCol] = useState<"status" | "name" | "stock_qty" | "nilai">("status");
    const [sortAsc, setSortAsc] = useState(true);
    const [modalProduct, setModalProduct] = useState<Product | null>(null);
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [histLoading, setHistLoading] = useState(false);
    const [editingMinStockId, setEditingMinStockId] = useState<string | null>(null);
    const [editMinStockValue, setEditMinStockValue] = useState("");

    // Proyeksi
    const [projDays, setProjDays] = useState(7);
    const [projection, setProjection] = useState<ProjectionData | null>(null);
    const [projLoading, setProjLoading] = useState(true);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Koreksi
    const [koreksiModal, setKoreksiModal] = useState<KoreksiModal | null>(null);
    const [koreksiNewQty, setKoreksiNewQty] = useState("");
    const [koreksiReason, setKoreksiReason] = useState("");
    const [koreksiNotes, setKoreksiNotes] = useState("");
    const [koreksiSaving, setKoreksiSaving] = useState(false);
    const [koreksiConfirm, setKoreksiConfirm] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (category !== "all") params.category = category;
            if (search.trim()) params.search = search.trim();
            const r = await apiGet("/reports/stock", params);
            setItems(r?.data?.items ?? []);
        } catch { }
        setLoading(false);
    }, [category, search]);

    const fetchProjection = useCallback(async (days: number) => {
        setProjLoading(true);
        try {
            const r = await apiGet(`/products/projection?days=${days}`);
            setProjection(r?.data ?? null);
        } catch { }
        setProjLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchProjection(projDays); }, [projDays, fetchProjection]);

    const openHistory = async (p: Product) => {
        setModalProduct(p);
        setHistLoading(true);
        setHistory([]);
        try {
            const r = await apiGet(`/products/${p.id}/history`);
            setHistory(r?.data?.history ?? []);
        } catch { }
        setHistLoading(false);
    };

    const openKoreksi = (p: Product) => {
        setKoreksiModal({ product: p });
        setKoreksiNewQty(String(p.stock_qty_display ?? p.stock_qty));
        setKoreksiReason("");
        setKoreksiNotes("");
        setKoreksiConfirm(false);
    };

    const handleSaveKoreksi = async () => {
        if (!koreksiModal || koreksiSaving) return;
        setKoreksiSaving(true);
        try {
            await apiPost(`/products/${koreksiModal.product.id}/adjust-stock-manual`, {
                new_qty: parseFloat(koreksiNewQty) || 0,
                reason: koreksiReason,
                notes: koreksiNotes || null,
            });
            setKoreksiModal(null);
            setKoreksiConfirm(false);
            fetchData();
            fetchProjection(projDays);
        } catch (err: any) {
            alert(err?.response?.data?.detail || "Gagal menyimpan koreksi stok");
        }
        setKoreksiSaving(false);
    };

    // Sort + filter
    const filtered = items.filter(p =>
        !search || p.name.toLowerCase().includes(search.toLowerCase())
    );

    const statusOrder = (p: Product) => {
        const qty = p.stock_qty_display ?? p.stock_qty;
        const min = p.stock_min_display ?? p.stock_min;
        if (qty === 0) return 0;
        if (qty <= min) return 1;
        if (qty <= min * 2) return 2;
        return 3;
    };

    const sorted = [...filtered].sort((a, b) => {
        if (sortCol === "status") return sortAsc ? statusOrder(a) - statusOrder(b) : statusOrder(b) - statusOrder(a);
        if (sortCol === "name") return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        if (sortCol === "stock_qty") {
            const aq = a.stock_qty_display ?? a.stock_qty;
            const bq = b.stock_qty_display ?? b.stock_qty;
            return sortAsc ? aq - bq : bq - aq;
        }
        if (sortCol === "nilai") {
            const av = (a.stock_qty_display ?? a.stock_qty) * parseFloat(a.harga || "0");
            const bv = (b.stock_qty_display ?? b.stock_qty) * parseFloat(b.harga || "0");
            return sortAsc ? av - bv : bv - av;
        }
        return 0;
    });

    const lowCount = items.filter(p => (p.stock_qty_display ?? p.stock_qty) <= (p.stock_min_display ?? p.stock_min)).length;
    const totalNilai = items.reduce((s, p) => s + (p.stock_qty_display ?? p.stock_qty) * parseFloat(p.harga || "0"), 0);

    const handleSort = (col: typeof sortCol) => {
        if (sortCol === col) setSortAsc(a => !a);
        else { setSortCol(col); setSortAsc(true); }
    };

    const handleDeleteProduct = async (p: Product) => {
        if (!confirm(`Hapus "${p.name}" dari daftar stok?`)) return;
        try {
            await apiDelete(`/products/${p.id}`);
            fetchData();
        } catch (err: any) {
            alert(err?.response?.data?.detail || "Gagal menghapus item");
        }
    };

    const handleSaveMinStock = async (p: Product) => {
        try {
            const val = parseFloat(editMinStockValue) || 0;
            await apiPut(`/products/${p.id}`, { stock_min: val });
            setEditingMinStockId(null);
            fetchData();
        } catch (err: any) {
            alert("Gagal update stok minimum.");
        }
    };

    const exportCsv = () => {
        const rows = [["Nama", "Kategori", "Satuan", "Harga", "Stok Saat Ini", "Stok Min", "Nilai Stok"]];
        sorted.forEach(p => {
            const qty = p.stock_qty_display ?? p.stock_qty;
            const min = p.stock_min_display ?? p.stock_min;
            rows.push([
                p.name, p.category ?? "", p.display_unit || p.unit,
                p.harga, String(qty), String(min),
                String(Math.round(qty * parseFloat(p.harga || "0"))),
            ]);
        });
        const csv = rows.map(r => r.join(",")).join("\n");
        const a = document.createElement("a");
        a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
        a.download = "stok_bahan_sppg.csv";
        a.click();
    };

    const statusColor: Record<string, string> = {
        aman: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
        menipis: "text-amber-700 bg-amber-500/10 border-amber-500/20",
        kritis: "text-rose-700 bg-rose-500/10 border-rose-500/20",
        habis: "text-slate-700 bg-slate-100 border-slate-200",
    };
    const statusLabel: Record<string, string> = {
        aman: "✅ Aman",
        menipis: "⚠️ Menipis",
        kritis: "🔴 Kritis",
        habis: "⚫ Habis",
    };

    const newQtyNum = parseFloat(koreksiNewQty) || 0;
    const deltaNum = koreksiModal ? newQtyNum - (koreksiModal.product.stock_qty_display ?? koreksiModal.product.stock_qty) : 0;

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-7xl mx-auto pb-10">
            
            {/* ─── Page Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 text-xs font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                            Manajemen Logistik Gudang
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-500">{items.length} Master Bahan Baku</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                        Persediaan & Stok Bahan
                    </h1>
                    <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">
                        Pantau inventaris fisik bahan pangan, proyeksi kebutuhan resep MBG, dan penyesuaian stock opname.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <Link 
                        href="/stok/riwayat"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/80 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded-xl border border-slate-200/80 shadow-sm transition-all"
                    >
                        <History className="w-4 h-4 text-slate-500" />
                        <span>Riwayat Mutasi</span>
                    </Link>
                    <button 
                        onClick={exportCsv}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                        <Download className="w-4 h-4" />
                        <span>Ekspor CSV</span>
                    </button>
                </div>
            </div>

            {/* ─── Metric Summary Cards ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard 
                    title="Total Item Bahan" 
                    value={`${items.length} sku`} 
                    subtitle="Terdaftar di database gudang" 
                    icon="📦" 
                    accentColor="blue"
                />
                <StatCard 
                    title="Stok Kritis / Menipis" 
                    value={`${lowCount} item`} 
                    subtitle="Perlu reorder belanja segera" 
                    icon="⚠️" 
                    accentColor="rose"
                />
                <StatCard 
                    title="Estimasi Nilai Stok" 
                    value={formatRp(totalNilai)} 
                    subtitle="Aset fisik bahan pangan" 
                    icon="💰" 
                    accentColor="emerald"
                />
                <StatCard 
                    title="Bahan Aktif Digunakan" 
                    value={`${items.filter(p => (p.stock_qty_display ?? p.stock_qty) > 0).length} item`} 
                    subtitle="Stok di atas 0 unit" 
                    icon="✅" 
                    accentColor="cyan"
                />
            </div>

            {/* ─── PROYEKSI STOK & PREDIKSI AI (INTELLIGENCE HUB) ─── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-5 sm:p-7 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                                    Proyeksi Ketahanan Stok Bahan
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-extrabold">
                                    BOM Forecast
                                </span>
                            </div>
                            {projection && (
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                    Metode kalkulasi: <span className="font-semibold text-slate-700">{projection.based_on_menu ? "Resep Terjadwal Mingguan + BOM Dapur" : "Rata-rata Pemakaian Riil 7 Hari"}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
                        {[7, 14, 30].map(d => (
                            <button 
                                key={d} 
                                onClick={() => setProjDays(d)}
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                    projDays === d 
                                        ? "bg-slate-900 text-white shadow-sm" 
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                }`}
                            >
                                {d} Hari
                            </button>
                        ))}
                    </div>
                </div>

                {projLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs text-slate-400 font-semibold">Menghitung proyeksi kebutuhan resep...</p>
                    </div>
                ) : projection ? (
                    <>
                        {/* Summary Status Badges */}
                        <div className="flex flex-wrap gap-2.5 mb-5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 rounded-xl text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Stok Aman: {projection.summary.sufficient_count}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-700 border border-amber-500/20 rounded-xl text-xs font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Stok Menipis: {projection.summary.warning_count}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-700 border border-rose-500/20 rounded-xl text-xs font-bold">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                Kritis / Defisit: {projection.summary.critical_count}
                            </span>
                        </div>

                        {/* Projection Table */}
                        {(() => {
                            const visibleItems = projection.items.filter(i =>
                                i.daily_usage > 0 || i.status !== "aman"
                            );
                            return visibleItems.length === 0 ? (
                                <div className="py-8 text-center text-slate-400 text-xs font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                    Belum ada data pemakaian terdeteksi. Silakan atur menu makan dan resep BOM di modul Dapur.
                                </div>
                            ) : (
                                <div className="overflow-x-auto no-scrollbar rounded-2xl border border-slate-200/80">
                                    <table className="w-full text-xs sm:text-sm">
                                        <thead className="bg-slate-50/80 border-b border-slate-200/80">
                                            <tr className="text-xs uppercase font-bold tracking-wider text-slate-500">
                                                <th className="text-left px-4 py-3 whitespace-nowrap">Bahan Baku</th>
                                                <th className="text-right px-4 py-3 whitespace-nowrap">Stok Saat Ini</th>
                                                <th className="text-right px-4 py-3 whitespace-nowrap">Konsumsi / Hari</th>
                                                <th className="text-right px-4 py-3 whitespace-nowrap">Perlu ({projDays} Hari)</th>
                                                <th className="text-center px-4 py-3 whitespace-nowrap">Ketahanan</th>
                                                <th className="text-center px-4 py-3 whitespace-nowrap">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {visibleItems.map((item) => {
                                                const isExp = expanded[`proj-${item.product_id}`];
                                                return (
                                                    <div key={item.product_id} className="contents">
                                                        <tr 
                                                            className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                                                            onClick={() => item.day_breakdown && item.day_breakdown.length > 0 && setExpanded(e => ({ ...e, [`proj-${item.product_id}`]: !e[`proj-${item.product_id}`] }))}
                                                        >
                                                            <td className="px-4 py-3 font-bold text-slate-900">
                                                                <div className="flex items-center gap-2">
                                                                    {item.day_breakdown && item.day_breakdown.length > 0 && (
                                                                        <span className="text-slate-400 text-xs">
                                                                            {isExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                        </span>
                                                                    )}
                                                                    <span>{item.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                                                {(item.stock_qty_display ?? item.stock_qty).toLocaleString("id-ID")} <span className="text-slate-400 font-sans text-xs">{item.display_unit || item.unit}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-slate-600 font-mono">
                                                                {item.daily_usage > 0
                                                                    ? `${item.daily_usage.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${item.display_unit || item.unit}`
                                                                    : <span className="text-slate-300">—</span>
                                                                }
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono">
                                                                {item.needed_for_period > 0
                                                                    ? <>
                                                                        <span className={item.sufficient ? "text-emerald-700 font-bold" : "text-rose-600 font-extrabold"}>
                                                                            {item.needed_for_period.toLocaleString("id-ID", { maximumFractionDigits: 1 })} {item.display_unit || item.unit}
                                                                        </span>
                                                                        {!item.sufficient && (
                                                                            <span className="block text-xs text-rose-500 font-bold mt-0.5">
                                                                                (Kurang {item.shortage.toFixed(1)})
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                    : <span className="text-slate-300">—</span>
                                                                }
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <DaysDisplay days={item.days_remaining} stock={item.stock_qty_display ?? item.stock_qty} />
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${statusColor[item.status]}`}>
                                                                    {statusLabel[item.status]}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                        {isExp && item.day_breakdown && item.day_breakdown.map((bd, bi) => {
                                                            const dObj = new Date(bd.date);
                                                            return (
                                                                <tr key={`bd-${item.product_id}-${bi}`} className="bg-blue-50/40 border-b border-blue-100/60">
                                                                    <td className="px-4 py-2 pl-8 text-xs text-slate-600 font-semibold" colSpan={2}>
                                                                        📅 {dObj.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">
                                                                        Perlu: {bd.needed.toLocaleString("id-ID", { maximumFractionDigits: 2 })} {item.display_unit || item.unit}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-xs font-mono">
                                                                        <span className={bd.sufficient ? "text-emerald-700 font-bold" : "text-rose-600 font-extrabold"}>
                                                                            Sisa: {bd.stock_after.toLocaleString("id-ID", { maximumFractionDigits: 2 })} {item.display_unit || item.unit}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-center text-xs" colSpan={2}>
                                                                        {bd.sufficient
                                                                            ? <span className="text-emerald-700 font-bold">✅ Cukup</span>
                                                                            : <span className="text-rose-600 font-extrabold">❌ Defisit</span>}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </>
                ) : (
                    <p className="text-slate-400 text-xs text-center py-4">Gagal memuat telemetri proyeksi stok.</p>
                )}
            </div>

            {/* ─── Search, Filter, & Tip Bar ─── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap gap-3.5 items-end">
                    <div className="w-44">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Kategori</label>
                        <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value)}
                            className="bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm w-full font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all cursor-pointer"
                        >
                            <option value="all">Semua Kategori</option>
                            <option value="bahan_baku">🥦 Bahan Baku Pangan</option>
                            <option value="produk_jadi">🍱 Menu / Produk Jadi</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Cari Bahan</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                            <input 
                                value={search} 
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Cari nama beras, telur, minyak, bumbu..." 
                                className="bg-slate-50/80 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm w-full font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all placeholder:text-slate-400" 
                            />
                        </div>
                    </div>
                    <button 
                        onClick={fetchData} 
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-slate-900/10 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                        <Search className="w-3.5 h-3.5" />
                        <span>Filter</span>
                    </button>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-blue-50/80 to-blue-50/60 border border-blue-200/60 text-xs text-blue-900 font-medium">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                        Stok otomatis bertambah saat konfirmasi nota belanja di <strong>Pembukuan</strong>, dan otomatis berkurang saat laporan <strong>Penyerahan MBG</strong>. Klik <strong>Koreksi</strong> untuk stock opname fisik.
                    </span>
                </div>
            </div>

            {/* ─── Master Table Persediaan ─── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs sm:text-sm text-slate-500 font-semibold">Memuat master persediaan stok...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-xs sm:text-sm">
                            <thead className="bg-slate-50/70 border-b border-slate-200/80">
                                <tr>
                                    {[
                                        { key: "name", label: "Nama Bahan" },
                                        { key: null, label: "Kategori" },
                                        { key: null, label: "Satuan" },
                                        { key: null, label: "Harga Ref" },
                                        { key: "stock_qty", label: "Stok Fisik" },
                                        { key: null, label: "Stok Min" },
                                        { key: "status", label: "Status" },
                                        { key: "nilai", label: "Nilai Aset" },
                                        { key: null, label: "Aksi" },
                                    ].map(col => (
                                        <th 
                                            key={col.label}
                                            className={`text-left px-5 py-4 text-slate-500 font-extrabold text-xs uppercase tracking-wider whitespace-nowrap ${col.key ? "cursor-pointer hover:text-slate-900 select-none" : ""}`}
                                            onClick={() => col.key && handleSort(col.key as any)}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>{col.label}</span>
                                                {col.key === sortCol && (
                                                    <span className="text-blue-600 font-bold">{sortAsc ? "▲" : "▼"}</span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sorted.map((p) => {
                                    const qty = p.stock_qty_display ?? p.stock_qty;
                                    const nilai = qty * parseFloat(p.harga || "0");
                                    const st = getStockStatus(qty, p.stock_min_display ?? p.stock_min);
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-5 py-3.5">
                                                <button 
                                                    onClick={() => openHistory(p)}
                                                    className="font-bold text-slate-900 hover:text-blue-600 text-left transition-colors flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <span>{p.name}</span>
                                                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-600 transition-colors" />
                                                </button>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500 text-xs font-medium">
                                                {p.category ? (
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold text-xs">
                                                        {p.category}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                {p.display_unit || p.unit}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-600">
                                                {formatRp(p.harga)}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-extrabold text-slate-900 text-sm">
                                                {(p.stock_qty_display ?? p.stock_qty).toLocaleString("id-ID")}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-slate-500 whitespace-nowrap">
                                                {editingMinStockId === p.id ? (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            step="0.1" 
                                                            autoFocus
                                                            value={editMinStockValue} 
                                                            onChange={e => setEditMinStockValue(e.target.value)}
                                                            className="w-20 px-2 py-1 border border-blue-300 rounded-lg text-xs bg-white text-right font-mono font-bold outline-none ring-2 ring-blue-500/20"
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") handleSaveMinStock(p);
                                                                if (e.key === "Escape") setEditingMinStockId(null);
                                                            }}
                                                        />
                                                        <button 
                                                            onClick={() => handleSaveMinStock(p)} 
                                                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                                                            title="Simpan"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setEditingMinStockId(null)} 
                                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                                            title="Batal"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        className="flex items-center justify-end gap-1.5 group/edit cursor-pointer" 
                                                        onClick={() => { setEditingMinStockId(p.id); setEditMinStockValue(String(p.stock_min_display ?? p.stock_min)); }}
                                                        title="Klik untuk ubah kuota minimum"
                                                    >
                                                        <span className="font-mono font-semibold">{(p.stock_min_display ?? p.stock_min).toLocaleString("id-ID")}</span>
                                                        <Edit3 className="w-3 h-3 text-slate-300 group-hover/edit:text-blue-600 transition-colors" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${st.className}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dotColor}`} />
                                                    <span>{st.label}</span>
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">
                                                {formatRp(nilai)}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <button 
                                                        onClick={() => openKoreksi(p)}
                                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold transition-all cursor-pointer"
                                                        title="Sesuaikan stok fisik"
                                                    >
                                                        <Wrench className="w-3 h-3 text-slate-500" />
                                                        <span>Koreksi</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteProduct(p)}
                                                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                                        title="Hapus bahan dari gudang"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50/90 border-t-2 border-slate-200/80">
                                <tr>
                                    <td className="px-5 py-4 font-extrabold text-slate-900 uppercase text-xs" colSpan={7}>
                                        Total Nilai Aset Fisik Persediaan
                                    </td>
                                    <td className="px-5 py-4 font-bold text-right font-mono text-blue-700 text-sm" colSpan={2}>
                                        {formatRp(totalNilai)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── Riwayat Modal ─── */}
            <BaseModal isOpen={!!modalProduct} onClose={() => setModalProduct(null)} title={modalProduct ? `${modalProduct.name} — Riwayat Mutasi Stok` : ""} maxWidth="max-w-2xl">
                {histLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs text-slate-400 font-medium">Mengambil riwayat mutasi...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                        Belum ada riwayat mutasi keluar/masuk untuk bahan ini.
                    </div>
                ) : (
                    <div className="overflow-x-auto no-scrollbar rounded-2xl border border-slate-100">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr className="text-xs uppercase font-bold tracking-wider text-slate-400">
                                    <th className="text-left px-4 py-3">Tanggal</th>
                                    <th className="text-right px-4 py-3">Perubahan</th>
                                    <th className="text-right px-4 py-3">Saldo</th>
                                    <th className="text-left px-4 py-3">Alasan</th>
                                    <th className="text-left px-4 py-3">Catatan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {modalProduct && history.map((h) => {
                                    const delta = parseFloat(h.change_qty);
                                    const isPos = delta >= 0;
                                    return (
                                        <tr key={h.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 font-medium">
                                                {new Date(h.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            </td>
                                            <td className={`px-4 py-2.5 text-right font-mono font-bold ${isPos ? "text-emerald-700" : "text-rose-600"}`}>
                                                {isPos ? "+" : ""}{delta.toLocaleString("id-ID")} {modalProduct.unit}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">
                                                {parseFloat(h.running_balance).toLocaleString("id-ID")} {modalProduct.unit}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-700 font-medium">{h.reason || "—"}</td>
                                            <td className="px-4 py-2.5 text-slate-400 text-xs">{h.notes || "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </BaseModal>

            {/* ─── Modal Koreksi Stok (Stock Opname) ─── */}
            <BaseModal isOpen={!!koreksiModal} onClose={() => { setKoreksiModal(null); setKoreksiConfirm(false); }} title="Penyesuaian Stok Fisik (Opname)" maxWidth="max-w-md">
                {koreksiModal && (
                    <div className="space-y-4 pt-1">
                        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 text-xs space-y-1.5 border border-slate-200/80">
                            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                                <span className="text-slate-500 font-medium">Nama Bahan</span>
                                <strong className="text-slate-900 font-bold">{koreksiModal.product.name}</strong>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-slate-500 font-medium">Stok Sistem Saat Ini</span>
                                <strong className="text-blue-700 font-mono font-bold text-sm">
                                    {(koreksiModal.product.stock_qty_display ?? koreksiModal.product.stock_qty).toLocaleString("id-ID")} {koreksiModal.product.display_unit || koreksiModal.product.unit}
                                </strong>
                            </div>
                        </div>

                        {!koreksiConfirm ? (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Stok Fisik Sebenarnya (Hasil Hitung) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            step="0.1"
                                            value={koreksiNewQty} 
                                            onChange={e => setKoreksiNewQty(e.target.value)}
                                            className="flex-1 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all"
                                            placeholder="0.0"
                                        />
                                        <span className="text-slate-600 text-xs font-bold px-3 py-2.5 bg-slate-100 rounded-xl border border-slate-200">
                                            {koreksiModal.product.display_unit || koreksiModal.product.unit}
                                        </span>
                                    </div>
                                    {koreksiNewQty !== "" && (
                                        <p className={`text-xs mt-1.5 font-bold ${deltaNum > 0 ? "text-emerald-600" : deltaNum < 0 ? "text-rose-600" : "text-slate-400"}`}>
                                            Selisih (Delta): {deltaNum > 0 ? "+" : ""}{deltaNum.toLocaleString("id-ID", { maximumFractionDigits: 2 })} {koreksiModal.product.display_unit || koreksiModal.product.unit}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Alasan Koreksi <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={koreksiReason} 
                                        onChange={e => setKoreksiReason(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all"
                                        placeholder="Contoh: Opname fisik berkala, susut timbangan, tumpah" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Catatan Tambahan (Opsional)</label>
                                    <input 
                                        type="text" 
                                        value={koreksiNotes} 
                                        onChange={e => setKoreksiNotes(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all"
                                        placeholder="Nomor berita acara opname atau pemeriksa..." 
                                    />
                                </div>
                                <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                                    <button 
                                        onClick={() => { setKoreksiModal(null); setKoreksiConfirm(false); }}
                                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => setKoreksiConfirm(true)}
                                        disabled={!koreksiReason.trim() || koreksiNewQty === ""}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer transition-all"
                                    >
                                        Verifikasi Selisih →
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs space-y-2">
                                    <p className="font-extrabold text-amber-900 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        Konfirmasi Penyesuaian Saldo Fisik
                                    </p>
                                    <p className="text-amber-800 leading-relaxed font-medium">
                                        Stok <strong className="text-amber-950 font-bold">{koreksiModal.product.name}</strong> akan diubah dari{" "}
                                        <strong className="font-mono">{(koreksiModal.product.stock_qty_display ?? koreksiModal.product.stock_qty).toLocaleString("id-ID")}</strong> menjadi{" "}
                                        <strong className="font-mono text-blue-700">{newQtyNum.toLocaleString("id-ID")}</strong> {koreksiModal.product.display_unit || koreksiModal.product.unit}.
                                    </p>
                                    <div className="p-2 rounded-xl bg-white/80 border border-amber-200/60 flex justify-between items-center">
                                        <span className="text-slate-500 font-semibold">Penyesuaian Jurnal Stok:</span>
                                        <span className={`font-mono font-extrabold ${deltaNum > 0 ? "text-emerald-700" : deltaNum < 0 ? "text-rose-600" : "text-slate-600"}`}>
                                            {deltaNum > 0 ? "+" : ""}{deltaNum.toLocaleString("id-ID", { maximumFractionDigits: 2 })} {koreksiModal.product.display_unit || koreksiModal.product.unit}
                                        </span>
                                    </div>
                                    <p className="text-xs text-amber-700 font-medium">Alasan: {koreksiReason}</p>
                                </div>
                                <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                                    <button 
                                        onClick={() => setKoreksiConfirm(false)}
                                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                                    >
                                        ← Kembali Edit
                                    </button>
                                    <button 
                                        onClick={handleSaveKoreksi} 
                                        disabled={koreksiSaving}
                                        className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>{koreksiSaving ? "Menyimpan..." : "Simpan Penyesuaian"}</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </BaseModal>
        </div>
    );
}
