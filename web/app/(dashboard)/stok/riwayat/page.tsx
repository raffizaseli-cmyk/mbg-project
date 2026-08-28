"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";

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
    purchase: { label: "Pembelian", type: "in" },
    telegram_manual: { label: "Belanja Manual Bot", type: "in" },
    adjustment: { label: "Koreksi", type: "adjust" },
    initial: { label: "Stok Awal", type: "in" },
    production: { label: "Produksi", type: "out" },
    mbg_production: { label: "Serah MBG", type: "out" },
    serah: { label: "Serah MBG", type: "out" },
    spoilage: { label: "Kadaluarsa", type: "out" },
    waste: { label: "Terbuang", type: "out" },
};

function getRowClass(reason?: string, change?: string): string {
    const delta = parseFloat(change || "0");
    const r = REASON_MAP[reason || ""];
    if (r?.type === "adjust") return "bg-blue-50/40";
    if (delta > 0) return "bg-green-50/20";
    if (delta < 0) return "bg-red-50/20";
    return "";
}

function getDeltaClass(delta: number, reason?: string): string {
    const r = REASON_MAP[reason || ""];
    if (r?.type === "adjust") return "text-blue-600 font-semibold";
    if (delta > 0) return "text-green-700 font-semibold";
    return "text-red-600 font-semibold";
}

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
            setProducts(all.filter(p => p.name && p.unit && p.category !== "produk_jadi" && p.category !== "komponen"));
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
        a.download = `riwayat_${selectedProd?.name || "stok"}.csv`;
        a.click();
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Riwayat Stok"
                subtitle="Pergerakan lengkap stok bahan"
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/stok"
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                            ← Kembali ke Stok
                        </Link>
                        {sorted.length > 0 && (
                            <button onClick={exportCsv}
                                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
                                📥 Export CSV
                            </button>
                        )}
                    </div>
                }
            />

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
                <div className="min-w-[200px] flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Produk/Bahan</label>
                    <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option value="">— Pilih bahan —</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Periode</label>
                    <select value={period} onChange={e => setPeriod(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option value="all">Semua Waktu</option>
                        <option value="week">Minggu Ini</option>
                        <option value="month">Bulan Ini</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                {period === "custom" && (
                    <>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Dari</label>
                            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Sampai</label>
                            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                        </div>
                    </>
                )}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Jenis</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option value="all">Semua</option>
                        <option value="masuk">🟢 Masuk</option>
                        <option value="keluar">🔴 Keluar</option>
                        <option value="koreksi">🔵 Koreksi</option>
                    </select>
                </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-200 inline-block" /> Masuk (stok bertambah)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-200 inline-block" /> Keluar (stok berkurang)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-200 inline-block" /> Koreksi manual</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {!selectedProduct ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-3xl mb-2">📦</p>
                        <p>Pilih bahan di atas untuk melihat riwayat pergerakannya</p>
                    </div>
                ) : loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-3xl mb-2">📋</p>
                        <p>Tidak ada riwayat untuk filter ini</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                                {sorted.length} catatan — {selectedProd?.name}
                            </span>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {["Tanggal", "Perubahan", "Saldo Setelah", "Alasan", "Notes"].map(h => (
                                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((row, i) => {
                                    const delta = parseFloat(row.change_qty || "0");
                                    const reasonInfo = REASON_MAP[row.reason || ""];
                                    return (
                                        <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50 ${getRowClass(row.reason, row.change_qty)}`}>
                                            <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs">
                                                {formatDate(row.created_at)}
                                            </td>
                                            <td className={`px-4 py-2.5 ${getDeltaClass(delta, row.reason)}`}>
                                                {delta >= 0 ? "+" : ""}{delta.toLocaleString("id-ID", { maximumFractionDigits: 3 })} {selectedProd?.unit}
                                            </td>
                                            <td className="px-4 py-2.5 font-medium text-gray-800">
                                                {parseFloat(row.running_balance).toLocaleString("id-ID", { maximumFractionDigits: 3 })} {selectedProd?.unit}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {reasonInfo ? (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reasonInfo.type === "in" ? "bg-green-100 text-green-700" :
                                                        reasonInfo.type === "adjust" ? "bg-blue-100 text-blue-700" :
                                                            "bg-red-100 text-red-700"}`}>
                                                        {reasonInfo.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">{row.reason || "—"}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate" title={row.notes || ""}>
                                                {row.notes || "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
