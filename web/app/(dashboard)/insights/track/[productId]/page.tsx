"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiDelete } from "@/lib/api";
import { BaseModal } from "@/components/ui/BaseModal";
import Link from "next/link";

function formatRp(val: number | string): string {
    const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
        .format(n).replace("IDR", "Rp");
}

interface ChartPoint {
    date: string;
    avg_price: number;
    by_supplier: Array<{ supplier_name: string; price: number; qty: number; transaction_id?: string }>;
}

interface SupplierComparison {
    supplier_name: string;
    avg_price: number;
    min_price: number;
    max_price: number;
    purchase_count: number;
}

interface DetailData {
    product_id: string;
    product_name: string;
    unit: string;
    period: string;
    chart_data: ChartPoint[];
    suppliers_comparison: SupplierComparison[];
    stats: {
        min_price: string;
        max_price: string;
        avg_price: string;
        price_volatility: number;
    };
}

/* ─── SVG Line Chart ─── */
function PriceLineChart({ data }: { data: ChartPoint[] }) {
    if (!data || data.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">📊</p>
                <p>Belum ada data grafik. Data muncul setelah ada transaksi terkonfirmasi.</p>
            </div>
        );
    }

    const prices = data.map(d => d.avg_price);
    const maxP = Math.max(...prices);
    const minP = Math.min(...prices);
    const range = maxP - minP || 1;

    // Chart dimensions
    const W = 800;
    const H = 300;
    const padL = 70;
    const padR = 20;
    const padT = 20;
    const padB = 60;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Map data to SVG coordinates
    const points = data.map((d, i) => ({
        x: padL + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
        y: padT + chartH - ((d.avg_price - minP) / range) * chartH,
        ...d,
    }));

    // Build line path
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    // Build area fill path
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

    // Y-axis gridlines (5 steps)
    const ySteps = 5;
    const yLines = Array.from({ length: ySteps + 1 }, (_, i) => {
        const val = minP + (range / ySteps) * i;
        const y = padT + chartH - ((val - minP) / range) * chartH;
        return { y, val };
    });

    // X-axis labels (show max ~10 labels)
    const labelInterval = Math.max(1, Math.ceil(data.length / 10));

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" style={{ maxHeight: 350 }}>
                {/* Grid lines */}
                {yLines.map((yl, i) => (
                    <g key={i}>
                        <line x1={padL} y1={yl.y} x2={W - padR} y2={yl.y}
                            stroke="#e5e7eb" strokeWidth={1} />
                        <text x={padL - 8} y={yl.y + 4} textAnchor="end"
                            className="text-[10px] fill-gray-400">
                            {formatRp(yl.val)}
                        </text>
                    </g>
                ))}

                {/* Gradient fill */}
                <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#areaGrad)" />

                {/* Line */}
                <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={2.5}
                    strokeLinecap="round" strokeLinejoin="round" />

                {/* Dots + hover targets */}
                {points.map((p, i) => (
                    <g key={i}>
                        {/* Invisible larger circle for hover */}
                        <circle cx={p.x} cy={p.y} r={12} fill="transparent" className="cursor-pointer">
                            <title>{`${p.date}\n${formatRp(p.avg_price)}`}</title>
                        </circle>
                        {/* Visible dot */}
                        <circle cx={p.x} cy={p.y} r={4} fill="#2563eb" stroke="#fff" strokeWidth={2} />
                    </g>
                ))}

                {/* X-axis labels */}
                {points.map((p, i) => {
                    if (i % labelInterval !== 0 && i !== points.length - 1) return null;
                    const label = new Date(p.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
                    return (
                        <text key={i} x={p.x} y={H - padB + 20} textAnchor="middle"
                            className="text-[10px] fill-gray-500" transform={`rotate(-30, ${p.x}, ${H - padB + 20})`}>
                            {label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}

/* ─── Main Page ─── */
export default function TrackHargaDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const productId = params.productId as string;

    const [detail, setDetail] = useState<DetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(searchParams.get("period") || "3m");
    const [deleteTrxId, setDeleteTrxId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const reloadData = () => {
        if (!productId) return;
        setLoading(true);
        apiGet(`/price-tracking/${productId}?period=${period}`)
            .then(r => setDetail(r?.data ?? null))
            .catch(() => setDetail(null))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        reloadData();
    }, [productId, period]);

    const handleDeleteTransaction = async () => {
        if (!deleteTrxId) return;
        setDeleting(true);
        try {
            await apiDelete(`/transactions/${deleteTrxId}`);
            alert("✅ Nota berhasil dihapus! Data harga outlier, stok, & pembukuan telah dibersihkan.");
            setDeleteTrxId(null);
            reloadData();
        } catch (err: any) {
            alert(err?.response?.data?.detail || "Gagal menghapus nota.");
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="text-center py-20 text-gray-400 space-y-3">
                <p className="text-4xl">📊</p>
                <p>Data tidak ditemukan</p>
                <Link href="/insights?tab=harga" className="text-blue-600 hover:underline text-sm">← Kembali</Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Link href="/insights?tab=harga"
                            className="text-gray-400 hover:text-gray-700 text-sm">← Kembali</Link>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">📈 {detail.product_name}</h1>
                    <p className="text-sm text-gray-500">Riwayat pergerakan harga per {detail.unit}</p>
                </div>
            </div>

            {/* Period tabs */}
            <div className="flex gap-2">
                {[
                    { key: "1m", label: "1 Bulan" },
                    { key: "3m", label: "3 Bulan" },
                    { key: "12m", label: "1 Tahun" },
                ].map(p => (
                    <button key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === p.key
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <span className="text-xs text-gray-500 block mb-1">🟢 Harga Terendah</span>
                    <p className="font-bold text-lg text-green-700">{formatRp(detail.stats.min_price)}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <span className="text-xs text-gray-500 block mb-1">🔴 Harga Tertinggi</span>
                    <p className="font-bold text-lg text-red-700">{formatRp(detail.stats.max_price)}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <span className="text-xs text-gray-500 block mb-1">📊 Rata-rata</span>
                    <p className="font-bold text-lg text-blue-700">{formatRp(detail.stats.avg_price)}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <span className="text-xs text-gray-500 block mb-1">📉 Volatilitas</span>
                    <p className="font-bold text-lg text-purple-700">{detail.stats.price_volatility}%</p>
                </div>
            </div>

            {/* Line Chart */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">📈 Grafik Pergerakan Harga</h2>
                <PriceLineChart data={detail.chart_data} />
            </div>

            {/* Supplier Comparison */}
            {detail.suppliers_comparison.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-800">🏪 Perbandingan Supplier</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {["Supplier", "Rata-rata", "Termurah", "Termahal", "Jumlah Beli"].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {detail.suppliers_comparison.map((s, i) => (
                                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${i === 0 ? "bg-green-50/40" : ""}`}>
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {s.supplier_name}
                                            {i === 0 && <span className="ml-2 text-green-600 text-xs font-bold">🏆 Termurah</span>}
                                        </td>
                                        <td className="px-4 py-3 font-semibold">{formatRp(s.avg_price)}</td>
                                        <td className="px-4 py-3 text-green-700">{formatRp(s.min_price)}</td>
                                        <td className="px-4 py-3 text-red-600">{formatRp(s.max_price)}</td>
                                        <td className="px-4 py-3 text-gray-500">{s.purchase_count}x transaksi</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Per-date breakdown */}
            {detail.chart_data.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-800">📅 Detail Harga Harian</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs">Tanggal</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs">Harga Rata-rata</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs">Supplier</th>
                                    <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...detail.chart_data].reverse().map((d, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                        <td className="px-4 py-2.5 text-gray-600 text-xs">
                                            {new Date(d.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                        </td>
                                        <td className="px-4 py-2.5 font-semibold">{formatRp(d.avg_price)}</td>
                                        <td className="px-4 py-2.5 text-xs text-gray-500">
                                            {d.by_supplier.map(s => `${s.supplier_name} (${formatRp(s.price)})`).join(", ")}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                {d.by_supplier.map((s, idx) => s.transaction_id ? (
                                                    <div key={idx} className="flex gap-1">
                                                        <Link href={`/pembukuan/${s.transaction_id}`} className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded transition-all">
                                                            Detail
                                                        </Link>
                                                        <button
                                                            onClick={() => setDeleteTrxId(s.transaction_id!)}
                                                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded cursor-pointer transition-all flex items-center gap-1"
                                                        >
                                                            <span>🗑️ Hapus</span>
                                                        </button>
                                                    </div>
                                                ) : null)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

                {/* Modal Konfirmasi Hapus Nota */}
                <BaseModal isOpen={!!deleteTrxId} onClose={() => setDeleteTrxId(null)} title="🗑️ Konfirmasi Hapus Nota" maxWidth="max-w-md">
                    {deleteTrxId && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Apakah Anda yakin ingin menghapus nota ini secara permanen?
                            </p>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 space-y-1">
                                <p className="font-bold">⚠️ Efek Penghapusan Nota:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li>Data harga outlier dari nota ini akan dibersihkan dari grafik & AI.</li>
                                    <li>Stok bahan baku akan dikurangi/dikoreksi kembali otomatis.</li>
                                    <li>Transaksi akan dihapus dari laporan Pembukuan & Kas.</li>
                                </ul>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setDeleteTrxId(null)}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2 border rounded-lg text-gray-700 text-sm hover:bg-gray-50 cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleDeleteTransaction}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                                >
                                    {deleting ? "Menghapus..." : "🗑️ Ya, Hapus Permanen"}
                                </button>
                            </div>
                        </div>
                    )}
                </BaseModal>
            </div>
        );
    }
