"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiDelete, apiPut, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { BaseModal } from "@/components/ui/BaseModal";
import Link from "next/link";

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

function getStockStatus(qty: number, min: number): { label: string; className: string } {
    if (qty === 0) return { label: "⚫ Habis", className: "text-gray-700 bg-gray-100" };
    if (qty <= min) return { label: "🔴 Kritis", className: "text-red-700 bg-red-100" };
    if (qty <= min * 2) return { label: "⚠️ Menipis", className: "text-yellow-700 bg-yellow-100" };
    return { label: "✅ Aman", className: "text-green-700 bg-green-100" };
}

function DaysDisplay({ days, stock }: { days: number; stock: number }) {
    if (stock <= 0) return <span className="font-bold text-gray-900 bg-gray-200 px-1.5 py-0.5 rounded text-xs">HABIS</span>;
    if (days >= 999) return <span className="text-green-700 font-medium">Tidak terpakai</span>;
    if (days === 0) return <span className="font-bold text-gray-900 bg-gray-200 px-1.5 py-0.5 rounded text-xs">HABIS</span>;
    if (days < 1) return <span className="text-red-600 font-bold text-xs">Hampir Habis</span>;
    if (days <= 7) return <span className="text-orange-600 font-medium">{days.toFixed(1)} hari</span>;
    if (days <= 30) return <span className="text-yellow-600 font-medium">{Math.round(days)} hari</span>;
    return <span className="text-green-700 font-medium">30+ hari</span>;
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
        a.download = "stok_bahan.csv";
        a.click();
    };

    const statusColor: Record<string, string> = {
        aman: "text-green-700 bg-green-50",
        menipis: "text-yellow-700 bg-yellow-50",
        kritis: "text-red-700 bg-red-50",
        habis: "text-gray-700 bg-gray-100",
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
        <div className="space-y-6 sm:space-y-8 animate-in mt-2">
            <PageHeader
                title="Stok Bahan"
                subtitle={`${items.length} item total`}
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/stok/riwayat"
                            className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 bg-white shadow-sm transition-all">
                            📋 Riwayat
                        </Link>
                        <button onClick={exportCsv}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-emerald-600/30 transition-all cursor-pointer ring-1 ring-emerald-700">
                            📥 Export CSV
                        </button>
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Item" value={`${items.length} item`} icon="📦" />
                <StatCard title="Stok Menipis" value={`${lowCount} item`} icon="⚠️" />
                <StatCard title="Nilai Total" value={formatRp(totalNilai)} icon="💰" />
                <StatCard title="Item Aktif" value={`${items.filter(p => (p.stock_qty_display ?? p.stock_qty) > 0).length} item`} icon="✅" />
            </div>

            {/* ═══ PROYEKSI STOK ════════════════════════════════════════ */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-bold text-gray-900">📊 Proyeksi Stok</h3>
                        {projection && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                Berdasarkan: {projection.based_on_menu
                                    ? "Menu minggu ini + BOM"
                                    : "Rata-rata pemakaian 7 hari terakhir"}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-1">
                        {[7, 14, 30].map(d => (
                            <button key={d} onClick={() => setProjDays(d)}
                                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${projDays === d ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                {d} Hari
                            </button>
                        ))}
                    </div>
                </div>

                {projLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : projection ? (
                    <>
                        {/* Summary badges */}
                        <div className="flex flex-wrap gap-3 mb-4">
                            <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                                ✅ Aman: {projection.summary.sufficient_count}
                            </span>
                            <span className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium">
                                ⚠️ Menipis: {projection.summary.warning_count}
                            </span>
                            <span className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
                                🔴 Kritis/Habis: {projection.summary.critical_count}
                            </span>
                        </div>

                        {/* Only show items with usage or low stock */}
                        {(() => {
                            const visibleItems = projection.items.filter(i =>
                                i.daily_usage > 0 || i.status !== "aman"
                            );
                            return visibleItems.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">
                                    Belum ada data pemakaian. Tambahkan resep BOM di Pengaturan.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                {["Bahan", "Stok Saat Ini", "Pemakaian/Hari", `Perlu (${projDays}h)`, "Cukup", "Status"].map(h => (
                                                    <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium text-xs whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleItems.map((item, i) => {
                                                const isExp = expanded[`proj-${item.product_id}`];
                                                return (
                                                    <>
                                                        <tr key={item.product_id}
                                                            className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}
                                                            onClick={() => item.day_breakdown && item.day_breakdown.length > 0 && setExpanded(e => ({ ...e, [`proj-${item.product_id}`]: !e[`proj-${item.product_id}`] }))}>
                                                            <td className="px-3 py-2 font-medium text-gray-800">
                                                                {item.day_breakdown && item.day_breakdown.length > 0 && (
                                                                    <span className="text-gray-400 mr-1 text-xs">{isExp ? "▼" : "▶"}</span>
                                                                )}
                                                                {item.name}
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                {(item.stock_qty_display ?? item.stock_qty).toLocaleString("id-ID")} {item.display_unit || item.unit}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-gray-500">
                                                                {item.daily_usage > 0
                                                                    ? `${item.daily_usage.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${item.display_unit || item.unit}`
                                                                    : <span className="text-gray-300">—</span>
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                {item.needed_for_period > 0
                                                                    ? <><span className={item.sufficient ? "text-green-700" : "text-red-600 font-semibold"}>
                                                                        {item.needed_for_period.toLocaleString("id-ID", { maximumFractionDigits: 1 })} {item.display_unit || item.unit}
                                                                    </span>
                                                                        {!item.sufficient && <span className="ml-1 text-red-500 text-xs">(kurang {item.shortage.toFixed(1)})</span>}
                                                                    </>
                                                                    : <span className="text-gray-300">—</span>
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <DaysDisplay days={item.days_remaining} stock={item.stock_qty_display ?? item.stock_qty} />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[item.status]}`}>
                                                                    {statusLabel[item.status]}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                        {isExp && item.day_breakdown && item.day_breakdown.map((bd, bi) => {
                                                            const dObj = new Date(bd.date);
                                                            return (
                                                                <tr key={`bd-${item.product_id}-${bi}`} className="bg-blue-50/40 border-b border-blue-50">
                                                                    <td className="px-3 py-1 pl-8 text-xs text-gray-500" colSpan={2}>
                                                                        📅 {dObj.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                                                                    </td>
                                                                    <td className="px-3 py-1 text-right text-xs font-mono text-gray-600">
                                                                        {bd.needed.toLocaleString("id-ID", { maximumFractionDigits: 2 })} {item.display_unit || item.unit}
                                                                    </td>
                                                                    <td className="px-3 py-1 text-right text-xs font-mono">
                                                                        <span className={bd.sufficient ? "text-green-600" : "text-red-600 font-bold"}>
                                                                            Sisa: {bd.stock_after.toLocaleString("id-ID", { maximumFractionDigits: 2 })} {item.display_unit || item.unit}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-1 text-center text-xs">
                                                                        {bd.sufficient
                                                                            ? <span className="text-green-600">✅</span>
                                                                            : <span className="text-red-600 font-bold">❌ Kurang</span>}
                                                                    </td>
                                                                    <td />
                                                                </tr>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </>
                ) : (
                    <p className="text-gray-400 text-sm text-center py-4">Gagal memuat data proyeksi</p>
                )}
            </div>

            {/* Filter */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-white p-5 flex flex-wrap gap-4 items-end overflow-visible z-20 relative">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Kategori</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option value="all">Semua</option>
                        <option value="bahan_baku">Bahan Baku</option>
                        <option value="produk_jadi">Produk Jadi</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs text-gray-500 mb-1">Cari</label>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Nama bahan..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full" />
                </div>
                <button onClick={fetchData} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                    🔍 Cari
                </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                💡 Update stok via Telegram Bot <code className="bg-blue-100 px-1 rounded">/belanja</code>
                , atau dikurangi otomatis saat konfirmasi <code className="bg-blue-100 px-1 rounded">/serah</code>.
                Gunakan tombol <strong>🔧 Koreksi</strong> untuk sinkronkan stok fisik.
            </div>

            {/* Tabel */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden mt-2 relative z-10">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        { key: "name", label: "Nama" },
                                        { key: null, label: "Kategori" },
                                        { key: null, label: "Satuan" },
                                        { key: null, label: "Harga" },
                                        { key: "stock_qty", label: "Stok Saat Ini" },
                                        { key: null, label: "Stok Min" },
                                        { key: "status", label: "Status" },
                                        { key: "nilai", label: "Nilai Stok" },
                                        { key: null, label: "Aksi" },
                                    ].map(col => (
                                        <th key={col.label}
                                            className={`text-left px-4 py-2.5 text-gray-500 font-medium text-xs whitespace-nowrap ${col.key ? "cursor-pointer hover:text-gray-800" : ""}`}
                                            onClick={() => col.key && handleSort(col.key as any)}>
                                            {col.label}
                                            {col.key === sortCol ? (sortAsc ? " ↑" : " ↓") : ""}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((p, i) => {
                                    const qty = p.stock_qty_display ?? p.stock_qty;
                                    const nilai = qty * parseFloat(p.harga || "0");
                                    const st = getStockStatus(qty, p.stock_min_display ?? p.stock_min);
                                    return (
                                        <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                            <td className="px-4 py-2.5">
                                                <button onClick={() => openHistory(p)}
                                                    className="font-medium text-blue-700 hover:underline text-left">{p.name}</button>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 text-xs">{p.category || "—"}</td>
                                            <td className="px-4 py-2.5 text-gray-500">{p.display_unit || p.unit}</td>
                                            <td className="px-4 py-2.5 text-right">{formatRp(p.harga)}</td>
                                            <td className="px-4 py-2.5 text-right font-semibold">{(p.stock_qty_display ?? p.stock_qty).toLocaleString("id-ID")}</td>
                                            <td className="px-4 py-2.5 text-right text-gray-500 whitespace-nowrap">
                                                {editingMinStockId === p.id ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <input type="number" min="0" step="0.1" autoFocus
                                                            value={editMinStockValue} onChange={e => setEditMinStockValue(e.target.value)}
                                                            className="w-20 px-2 py-1 border rounded text-xs bg-white text-right"
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") handleSaveMinStock(p);
                                                                if (e.key === "Escape") setEditingMinStockId(null);
                                                            }}
                                                        />
                                                        <button onClick={() => handleSaveMinStock(p)} className="text-green-600 hover:text-green-800 text-lg">✅</button>
                                                        <button onClick={() => setEditingMinStockId(null)} className="text-gray-400 hover:text-red-500 text-lg">✕</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-2 group cursor-pointer" onClick={() => { setEditingMinStockId(p.id); setEditMinStockValue(String(p.stock_min_display ?? p.stock_min)); }}>
                                                        <span>{(p.stock_min_display ?? p.stock_min).toLocaleString("id-ID")}</span>
                                                        <span className="text-gray-300 group-hover:text-blue-500 transition-colors">✏️</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.className}`}>{st.label}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium">{formatRp(nilai)}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1.5 justify-center">
                                                    <button onClick={() => openKoreksi(p)}
                                                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium whitespace-nowrap">
                                                        🔧 Koreksi
                                                    </button>
                                                    <button onClick={() => handleDeleteProduct(p)}
                                                        className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 bg-red-50 rounded hover:bg-red-100 transition-colors">
                                                        🗑️ Hapus
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                    <td className="px-4 py-2.5 font-bold" colSpan={8}>TOTAL NILAI STOK</td>
                                    <td className="px-4 py-2.5 font-bold text-right">{formatRp(totalNilai)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Link Riwayat */}
            <div className="text-center">
                <Link href="/stok/riwayat"
                    className="text-blue-600 hover:underline text-sm font-medium">
                    📋 Lihat Riwayat Pergerakan Stok Lengkap →
                </Link>
            </div>

            {/* Modal History */}
            <BaseModal isOpen={!!modalProduct} onClose={() => setModalProduct(null)} title={modalProduct ? `${modalProduct.name} — Riwayat Perubahan Stok` : ""} maxWidth="max-w-2xl">
                    {histLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <p className="text-center text-gray-400 py-8">Belum ada riwayat</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {["Tanggal", "Perubahan", "Saldo", "Alasan", "Notes"].map(h => (
                                        <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium text-xs">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {modalProduct && history.map((h, i) => {
                                    const delta = parseFloat(h.change_qty);
                                    return (
                                        <tr key={h.id} className={`border-b border-gray-50 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                            <td className="px-3 py-1.5 whitespace-nowrap text-gray-500 text-xs">
                                                {new Date(h.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            </td>
                                            <td className={`px-3 py-1.5 font-semibold ${delta >= 0 ? "text-green-700" : "text-red-500"}`}>
                                                {delta >= 0 ? "+" : ""}{delta.toLocaleString("id-ID")} {modalProduct.unit}
                                            </td>
                                            <td className="px-3 py-1.5 font-medium">
                                                {parseFloat(h.running_balance).toLocaleString("id-ID")} {modalProduct.unit}
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-600 text-xs">{h.reason || "—"}</td>
                                            <td className="px-3 py-1.5 text-gray-400 text-xs">{h.notes || "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
            </BaseModal>

            {/* Modal Koreksi Stok */}
            <BaseModal isOpen={!!koreksiModal} onClose={() => { setKoreksiModal(null); setKoreksiConfirm(false); }} title="🔧 Koreksi Stok" maxWidth="max-w-md">
                {koreksiModal && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">{koreksiModal.product.name}</p>

                        <div className="bg-blue-50 rounded-lg p-3 text-sm">
                            <span className="text-blue-700">Stok sistem saat ini: </span>
                            <span className="font-bold text-blue-900">
                                {(koreksiModal.product.stock_qty_display ?? koreksiModal.product.stock_qty).toLocaleString("id-ID")} {koreksiModal.product.display_unit || koreksiModal.product.unit}
                            </span>
                        </div>

                        {!koreksiConfirm ? (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Stok fisik sebenarnya <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" step="0.1"
                                            value={koreksiNewQty} onChange={e => setKoreksiNewQty(e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                            placeholder="Masukkan stok aktual..."
                                        />
                                        <span className="text-gray-500 text-sm whitespace-nowrap font-semibold">{koreksiModal.product.display_unit || koreksiModal.product.unit}</span>
                                    </div>
                                    {koreksiNewQty !== "" && (
                                        <p className={`text-xs mt-1 ${deltaNum > 0 ? "text-green-600" : deltaNum < 0 ? "text-red-500" : "text-gray-400"}`}>
                                            Delta: {deltaNum > 0 ? "+" : ""}{deltaNum.toLocaleString("id-ID", { maximumFractionDigits: 2 })} {koreksiModal.product.display_unit || koreksiModal.product.unit}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Alasan koreksi <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" value={koreksiReason} onChange={e => setKoreksiReason(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        placeholder="mis: hasil opname fisik, bahan kadaluarsa..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
                                    <input type="text" value={koreksiNotes} onChange={e => setKoreksiNotes(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        placeholder="Tambahan keterangan..." />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => { setKoreksiModal(null); setKoreksiConfirm(false); }}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => setKoreksiConfirm(true)}
                                        disabled={!koreksiReason.trim() || koreksiNewQty === ""}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                                        Lanjut →
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm space-y-1">
                                    <p className="font-semibold text-yellow-900">Konfirmasi Perubahan</p>
                                    <p className="text-yellow-800">
                                        Stok <strong>{koreksiModal.product.name}</strong> akan diubah dari{" "}
                                        <strong>{(koreksiModal.product.stock_qty_display ?? koreksiModal.product.stock_qty).toLocaleString("id-ID")}</strong> ke{" "}
                                        <strong>{newQtyNum.toLocaleString("id-ID")}</strong> {koreksiModal.product.display_unit || koreksiModal.product.unit}
                                    </p>
                                    <p className={`font-bold ${deltaNum > 0 ? "text-green-700" : deltaNum < 0 ? "text-red-600" : "text-gray-600"}`}>
                                        Delta: {deltaNum > 0 ? "+" : ""}{deltaNum.toLocaleString("id-ID", { maximumFractionDigits: 2 })} {koreksiModal.product.display_unit || koreksiModal.product.unit}
                                    </p>
                                    <p className="text-yellow-700 text-xs">Alasan: {koreksiReason}</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setKoreksiConfirm(false)}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                                        ← Ubah
                                    </button>
                                    <button onClick={handleSaveKoreksi} disabled={koreksiSaving}
                                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-60">
                                        {koreksiSaving ? "Menyimpan..." : "✅ Simpan Koreksi"}
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
