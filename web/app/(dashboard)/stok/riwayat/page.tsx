"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api";
import Link from "next/link";
import { 
  History, 
  ArrowLeft, 
  Download, 
  Filter, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Wrench, 
  Calendar, 
  Layers,
  PackageCheck,
  RotateCcw
} from "lucide-react";

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("id-ID", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

interface Product {
    id: string;
    name: string;
    unit: string;
    category?: string;
}

interface HistoryRow {
    id: string;
    change_qty: string;
    running_balance: string;
    reason?: string;
    notes?: string;
    created_at: string;
}

const REASON_MAP: Record<string, { label: string; type: "in" | "out" | "adjust" }> = {
    purchase: { label: "Belanja Nota", type: "in" },
    telegram_manual: { label: "Belanja Bot Telegram", type: "in" },
    adjustment: { label: "Koreksi Opname", type: "adjust" },
    initial: { label: "Saldo Awal", type: "in" },
    production: { label: "Produksi Masak", type: "out" },
    mbg_production: { label: "Distribusi Serah MBG", type: "out" },
    serah: { label: "Distribusi Serah MBG", type: "out" },
    spoilage: { label: "Kadaluarsa / Rusak", type: "out" },
    waste: { label: "Susut / Terbuang", type: "out" },
};

export default function RiwayatStokPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [period, setPeriod] = useState("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [loading, setLoading] = useState(false);

    // Load all raw material products for dropdown
    useEffect(() => {
        apiGet("/products").then(r => {
            const all: Product[] = r?.data?.items || r?.data || [];
            const filteredProducts = all.filter(p => p.name && p.unit && p.category !== "produk_jadi" && p.category !== "komponen");
            setProducts(filteredProducts);
            if (filteredProducts.length > 0 && !selectedProduct) {
                setSelectedProduct(filteredProducts[0].id);
            }
        }).catch(() => { });
    }, []);

    const fetchHistory = useCallback(async () => {
        if (!selectedProduct) return;
        setLoading(true);
        try {
            const r = await apiGet(`/products/${selectedProduct}/history?limit=500`);
            setHistory(r?.data?.history ?? []);
        } catch { }
        setLoading(false);
    }, [selectedProduct]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Period filter
    const now = new Date();
    const filtered = history.filter(row => {
        const d = new Date(row.created_at);

        if (period === "week") {
            const start = new Date(now); start.setDate(now.getDate() - now.getDay());
            return d >= start;
        }
        if (period === "month") {
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        if (period === "custom") {
            if (customFrom && d < new Date(customFrom)) return false;
            if (customTo && d > new Date(customTo + "T23:59:59")) return false;
            return true;
        }
        return true; // "all"
    }).filter(row => {
        if (filterType === "all") return true;
        const delta = parseFloat(row.change_qty || "0");
        const reas = REASON_MAP[row.reason || ""];
        if (filterType === "masuk") return delta > 0 || reas?.type === "in";
        if (filterType === "keluar") return delta < 0 || reas?.type === "out";
        if (filterType === "koreksi") return delta === 0 || reas?.type === "adjust" || row.reason === "adjustment";
        return true;
    });

    // Sorted newest first
    const sorted = [...filtered].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const selectedProd = products.find(p => p.id === selectedProduct);

    const exportCsv = () => {
        const rows = [["Tanggal", "Perubahan", "Saldo Setelah", "Alasan", "Notes"]];
        sorted.forEach(r => rows.push([
            formatDate(r.created_at),
            r.change_qty,
            r.running_balance,
            REASON_MAP[r.reason || ""]?.label || r.reason || "",
            r.notes || "",
        ]));
        const csv = rows.map(r => r.join(",")).join("\n");
        const a = document.createElement("a");
        a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
        a.download = `riwayat_mutasi_${selectedProd?.name || "stok"}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fade-in">
            
            {/* ─── Top Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                    <Link 
                        href="/stok" 
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors mb-2 group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        <span>Kembali ke Persediaan Stok</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                                Buku Mutasi & Riwayat Stok
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 font-medium">
                                Audit jejak pergerakan masuk (pembelian), keluar (serah MBG), dan koreksi stok fisik.
                            </p>
                        </div>
                    </div>
                </div>

                {sorted.length > 0 && (
                    <button 
                        onClick={exportCsv}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                        <Download className="w-4 h-4" />
                        <span>Ekspor Mutasi CSV</span>
                    </button>
                )}
            </div>

            {/* ─── Filter Bar Card ─── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap gap-3.5 items-end">
                    <div className="min-w-[220px] flex-1">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                            Pilih Bahan Baku
                        </label>
                        <select 
                            value={selectedProduct} 
                            onChange={e => setSelectedProduct(e.target.value)}
                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all cursor-pointer"
                        >
                            <option value="">— Pilih Bahan Baku —</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-36">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                            Periode
                        </label>
                        <select 
                            value={period} 
                            onChange={e => setPeriod(e.target.value)}
                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all cursor-pointer"
                        >
                            <option value="all">Semua Waktu</option>
                            <option value="week">Minggu Ini</option>
                            <option value="month">Bulan Ini</option>
                            <option value="custom">Kustom Tanggal</option>
                        </select>
                    </div>

                    {period === "custom" && (
                        <>
                            <div className="w-36">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Dari</label>
                                <input 
                                    type="date" 
                                    value={customFrom} 
                                    onChange={e => setCustomFrom(e.target.value)}
                                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600" 
                                />
                            </div>
                            <div className="w-36">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Sampai</label>
                                <input 
                                    type="date" 
                                    value={customTo} 
                                    onChange={e => setCustomTo(e.target.value)}
                                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600" 
                                />
                            </div>
                        </>
                    )}

                    <div className="w-40">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                            Arah Mutasi
                        </label>
                        <select 
                            value={filterType} 
                            onChange={e => setFilterType(e.target.value)}
                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all cursor-pointer"
                        >
                            <option value="all">Semua Jenis</option>
                            <option value="masuk">🟢 Stok Masuk</option>
                            <option value="keluar">🔴 Stok Keluar</option>
                            <option value="koreksi">🔵 Koreksi Fisik</option>
                        </select>
                    </div>
                </div>

                {/* Legend badges */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>Masuk (Belanja Nota / Pasokan)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>Keluar (Konsumsi Masak MBG)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span>Koreksi Fisik (Opname Gudang)</span>
                    </span>
                </div>
            </div>

            {/* ─── Riwayat Table Card ─── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden">
                {!selectedProduct ? (
                    <div className="text-center py-24 text-slate-400 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4 text-slate-400">
                            📦
                        </div>
                        <p className="text-base font-extrabold text-slate-800">Pilih Bahan Baku</p>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
                            Pilih salah satu bahan pada dropdown di atas untuk melihat buku jurnal mutasi stok lengkap.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs sm:text-sm text-slate-500 font-semibold">Memuat riwayat transaksi mutasi...</p>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-24 text-slate-400 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4 text-slate-400">
                            📋
                        </div>
                        <p className="text-base font-extrabold text-slate-800">Tidak Ada Catatan Mutasi</p>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
                            Tidak ditemukan perubahan stok untuk bahan ini pada filter periode yang dipilih.
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                                {sorted.length} Rekam Mutasi — <span className="text-blue-700 font-bold">{selectedProd?.name}</span>
                            </span>
                            <span className="text-xs text-slate-400 font-medium">Satuan: {selectedProd?.unit}</span>
                        </div>
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-xs sm:text-sm">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500">
                                        <th className="text-left px-6 py-3.5 whitespace-nowrap">Waktu Transaksi</th>
                                        <th className="text-right px-6 py-3.5 whitespace-nowrap">Mutasi (Delta)</th>
                                        <th className="text-right px-6 py-3.5 whitespace-nowrap">Saldo Akhir</th>
                                        <th className="text-center px-6 py-3.5 whitespace-nowrap">Jenis Mutasi</th>
                                        <th className="text-left px-6 py-3.5 whitespace-nowrap">Keterangan / Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sorted.map((row) => {
                                        const delta = parseFloat(row.change_qty || "0");
                                        const reasonInfo = REASON_MAP[row.reason || ""];
                                        const isPos = delta > 0;
                                        const isAdjust = reasonInfo?.type === "adjust" || row.reason === "adjustment";
                                        
                                        return (
                                            <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                                                    {formatDate(row.created_at)}
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 font-mono font-extrabold text-xs px-2.5 py-1 rounded-xl ${
                                                        isAdjust 
                                                            ? "bg-blue-50 text-blue-700 border border-blue-200" 
                                                            : isPos 
                                                            ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" 
                                                            : "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                                                    }`}>
                                                        {isAdjust ? (
                                                            <Wrench className="w-3 h-3" />
                                                        ) : isPos ? (
                                                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                                                        ) : (
                                                            <ArrowUpRight className="w-3 h-3 text-rose-600" />
                                                        )}
                                                        <span>{isPos ? "+" : ""}{delta.toLocaleString("id-ID", { maximumFractionDigits: 3 })} {selectedProd?.unit}</span>
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-xs sm:text-sm">
                                                    {parseFloat(row.running_balance).toLocaleString("id-ID", { maximumFractionDigits: 3 })} {selectedProd?.unit}
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    {reasonInfo ? (
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                                            reasonInfo.type === "in" 
                                                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" 
                                                                : reasonInfo.type === "adjust" 
                                                                ? "bg-blue-500/10 text-blue-700 border-blue-500/30" 
                                                                : "bg-rose-500/10 text-rose-700 border-rose-500/30"
                                                        }`}>
                                                            {reasonInfo.label}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs font-mono">{row.reason || "—"}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 text-xs max-w-xs truncate" title={row.notes || ""}>
                                                    {row.notes || <span className="text-slate-300 italic">Tanpa catatan</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
