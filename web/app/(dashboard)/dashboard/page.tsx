"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Rupiah } from "@/components/ui/rupiah";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseTrendChart } from "@/components/charts/ExpenseTrendChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";

// Types
interface DailyData {
    date: string;
    mbg: {
        total_portions: number;
        total_schools: number;
        menu_name: string | null;
        revenue_gross: string;
        has_delivery: boolean;
    };
    expenses: { total: string; count: number; by_supplier: any[] };
    stock_alerts: Array<{ product_name: string; stock_qty: number; stock_min: number; unit: string; deficit: number }>;
    cashflow: { income: string; outcome: string; net: string };
}

interface MonthlyData {
    year: number;
    month: number;
    period_label: string;
    mbg: { total_portions: number; revenue_gross: string; revenue_calculated: string; avg_portions_per_day: number };
    expenses: { total: string; count: number; hutang_outstanding: string };
    piutang_total: string;
    profit_estimate: { gross_profit: string };
    stock_summary: { low_stock_count: number };
    excel_status: string;
}

interface BudgetSummary {
    pagu_amount: string;
    total_disbursed: string;
    total_spent: string;
    sisa_anggaran: string;
    realisasi: Record<string, string>;
    juknis_breakdown: any;
}

interface Transaction {
    id: string;
    date: string;
    nama_toko: string;
    total: string;
    status: string;
    type: string;
}

function formatRp(val: string | number): string {
    const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
        .format(n)
        .replace("IDR", "Rp");
}

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    return "Selamat sore";
}

function todayLabel(): string {
    return new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function DashboardPage() {
    const router = useRouter();
    const [daily, setDaily] = useState<DailyData | null>(null);
    const [monthly, setMonthly] = useState<MonthlyData | null>(null);
    const [budget, setBudget] = useState<BudgetSummary | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [expenseTrend, setExpenseTrend] = useState<{ date: string; total: number }[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState("SPPG");

    const fetchExpenseTrend = useCallback(async () => {
        try {
            const end = new Date();
            const start = new Date(end);
            start.setDate(start.getDate() - 6);
            const dateFrom = start.toISOString().slice(0, 10);
            const dateTo = end.toISOString().slice(0, 10);

            const trxResp = await apiGet("/transactions", {
                date_from: dateFrom,
                date_to: dateTo,
                type: "expense",
                status: "confirmed",
                limit: 200,
            });
            const items = trxResp?.data ?? [];

            const grouped: Record<string, number> = {};
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                grouped[d.toISOString().slice(0, 10)] = 0;
            }
            items.forEach((item: any) => {
                const dateKey = item?.date?.slice(0, 10);
                if (dateKey && grouped[dateKey] !== undefined) {
                    grouped[dateKey] += Number(item.total || 0);
                }
            });

            const trend = Object.keys(grouped)
                .sort()
                .map((dateKey) => ({
                    date: new Date(dateKey).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
                    total: grouped[dateKey],
                }));

            setExpenseTrend(trend);
        } catch (err) {
            console.warn("Failed to load expense trend", err);
            setExpenseTrend([]);
        }
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [d, m, b, t, empList] = await Promise.all([
                apiGet("/reports/daily").catch(() => null),
                apiGet("/reports/monthly").catch(() => null),
                apiGet("/budget/summary").catch(() => null),
                apiGet("/transactions", { limit: 10, sort: "created_at_desc" }).catch(() => null),
                apiGet("/employees?is_active=true").catch(() => null),
            ]);
            setDaily(d?.data ?? null);
            setMonthly(m?.data ?? null);
            setBudget(b?.data ?? null);
            setTransactions(t?.data?.items ?? t?.data ?? []);
            setEmployees(empList?.data ?? []);
            try {
                const me = await apiGet("/auth/me");
                setTenantName(me?.data?.tenant_name ?? "SPPG");
            } catch { }
        } catch (e: any) {
            setError("Gagal memuat data. Pastikan backend berjalan.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        fetchExpenseTrend();
    }, [fetchAll, fetchExpenseTrend]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-500">Memuat data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3 max-w-md">
                    <p className="text-4xl">⚠️</p>
                    <p className="text-red-600 font-medium">{error}</p>
                    <button onClick={fetchAll} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Coba Lagi
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* ─── Greeting ───────────────────────────────────── */}
            <div className="pt-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                    {getGreeting()}, {tenantName} 👋
                </h1>
                <p className="text-gray-500 font-medium text-sm mt-1">{todayLabel()}</p>
            </div>

            {/* ─── Stat Cards (Baris 1) ─ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
                <StatCard
                    title="Porsi Hari Ini"
                    value={daily?.mbg.has_delivery ? `${daily.mbg.total_portions.toLocaleString("id-ID")} porsi` : "—"}
                    subtitle={daily?.mbg.has_delivery ? `${daily.mbg.total_schools} sekolah` : "Belum ada serah"}
                    icon="🍱"
                />
                <StatCard
                    title="Tagihan Negara (Gross)"
                    value={monthly ? formatRp(monthly.mbg.revenue_calculated || monthly.mbg.revenue_gross) : "—"}
                    subtitle={`${monthly?.mbg.total_portions.toLocaleString("id-ID") ?? 0} total porsi`}
                    icon="💰"
                />
                <StatCard
                    title="Belanja Hari Ini"
                    value={daily ? formatRp(daily.expenses.total) : "—"}
                    subtitle={`${daily?.expenses.count ?? 0} nota`}
                    icon="🛒"
                />
            </div>

            {/* ─── Shortcut Khusus Operasional (Premium Glassmorphism) ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
                <button onClick={() => router.push('/mbg')} className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-3xl text-left border border-white/20 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all group">
                    <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl text-white mb-3 shadow-inner group-hover:scale-110 transition-transform">🍱</span>
                    <h3 className="font-bold text-white text-lg leading-tight">Input Serah</h3>
                    <p className="text-blue-100 text-xs mt-1">Catat penyerahan MBG</p>
                </button>
                <button onClick={() => router.push('/dapur')} className="bg-gradient-to-br from-orange-500 to-red-500 p-5 rounded-3xl text-left border border-white/20 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-1 transition-all group">
                    <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl text-white mb-3 shadow-inner group-hover:scale-110 transition-transform">🍽️</span>
                    <h3 className="font-bold text-white text-lg leading-tight">Master Menu BOM</h3>
                    <p className="text-orange-100 text-xs mt-1">Struktur resep dapur</p>
                </button>
                <button onClick={() => router.push('/pembukuan/belanja')} className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-3xl text-left border border-white/20 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all group">
                    <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl text-white mb-3 shadow-inner group-hover:scale-110 transition-transform">🛒</span>
                    <h3 className="font-bold text-white text-lg leading-tight">Catat Belanja</h3>
                    <p className="text-emerald-100 text-xs mt-1">Input nota manual</p>
                </button>
                <button onClick={() => router.push('/stok')} className="bg-gradient-to-br from-purple-500 to-pink-600 p-5 rounded-3xl text-left border border-white/20 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:-translate-y-1 transition-all group">
                    <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl text-white mb-3 shadow-inner group-hover:scale-110 transition-transform">📦</span>
                    <h3 className="font-bold text-white text-lg leading-tight">Cek Stok Gudang</h3>
                    <p className="text-purple-100 text-xs mt-1">Pantau & opname</p>
                </button>
            </div>

            {/* ─── Stat Cards (Baris 2) ─ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                <StatCard
                    title="Piutang Bahan Pangan"
                    value={monthly ? formatRp(monthly.piutang_total || "0") : "—"}
                    subtitle="Belum masuk kas"
                    icon="📋"
                />
                <StatCard
                    title="Hutang Outstanding"
                    value={monthly ? formatRp(monthly.expenses.hutang_outstanding) : "—"}
                    subtitle="Belum lunas"
                    icon="🧾"
                />
                <StatCard
                    title="Karyawan Aktif"
                    value={`${employees.length} Orang`}
                    subtitle="Terdata di sistem"
                    icon="👥"
                />
            </div>



            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-base font-bold text-gray-900 mb-6">Tren Pengeluaran (7 Hari Terakhir)</h2>
                    <ExpenseTrendChart data={expenseTrend} />
                </div>
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-base font-bold text-gray-900 leading-tight">Beban Anggaran Terhadap Pagu</h2>
                        <div className="text-right">
                           <span className="text-xs text-gray-500 font-medium">Bulan Ini</span>
                           <p className="text-sm font-bold text-blue-600">{formatRp(budget?.pagu_amount || 0)}</p>
                        </div>
                    </div>
                    
                    {budget ? (
                        <CategoryPieChart data={(() => {
                           const b = budget.juknis_breakdown || {};
                           const sumPangan = parseFloat(b.bahan_pangan?.realisasi || "0");
                           const sumOpsGaji = parseFloat(b.operasional?.realisasi || "0");
                           
                           const pagu = parseFloat(budget.pagu_amount || "0");
                           const total_spent = parseFloat(budget.total_spent || "0");
                           const sisa = Math.max(pagu - total_spent, 0);

                           const sumLainnya = Math.max(total_spent - sumPangan - sumOpsGaji, 0);

                           const result = [
                              { name: "Bahan Pangan MBG", value: sumPangan, color: "#3B82F6" },
                              { name: "Operasional & Gaji", value: sumOpsGaji, color: "#8B5CF6" },
                           ];
                           if (sumLainnya > 0) {
                               result.push({ name: "Biaya Lainnya", value: sumLainnya, color: "#F59E0B" });
                           }
                           
                           if (pagu > 0) {
                               result.push({ name: "Sisa Pagu (Aman)", value: sisa, color: "#E5E7EB" });
                           }
                           
                           return result.filter(x => x.value > 0);
                        })()} />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Memuat data pagu...</div>
                    )}
                </div>
            </div>

            {/* ─── Baris konten utama: Penyerahan + Stok ────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Penyerahan Hari Ini */}
                <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <h2 className="text-base font-bold tracking-tight text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg shadow-inner">🍱</span>
                        Penyerahan Hari Ini
                    </h2>
                    {daily?.mbg.has_delivery ? (
                        <div className="space-y-2">
                            {daily.mbg.menu_name && (
                                <p className="text-sm text-gray-600">Menu: <span className="font-medium text-gray-900 p-1 bg-yellow-50 rounded">{daily.mbg.menu_name}</span></p>
                            )}
                            <div className="flex justify-between text-sm border-t border-gray-100/80 pt-3 mt-3">
                                <span className="text-gray-500 font-medium">Total Porsi</span>
                                <span className="font-bold text-blue-600 bg-blue-50/50 px-2 rounded-md">{daily.mbg.total_portions.toLocaleString("id-ID")} porsi</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Gross Revenue</span>
                                <span className="font-bold text-green-700 bg-green-50/50 px-2 rounded-md">{formatRp(daily.mbg.revenue_gross)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400">
                            <p className="text-3xl mb-2 opacity-50">⚪</p>
                            <p className="font-medium text-gray-500">Belum ada penyerahan</p>
                            <p className="text-xs mt-1 text-gray-400">Konfirmasi via Telegram Bot <code className="bg-gray-100 px-1.5 py-0.5 rounded-md font-mono text-gray-600">/serah</code></p>
                        </div>
                    )}
                </div>

                {/* Stok Menipis */}
                <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <h2 className="text-base font-bold tracking-tight text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-lg shadow-inner">📦</span>
                        Stok Menipis
                    </h2>
                    {daily?.stock_alerts && daily.stock_alerts.length > 0 ? (
                        <div className="space-y-2">
                            {daily.stock_alerts.slice(0, 5).map((a, i) => (
                                <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 group">
                                    <span className="text-gray-700 font-medium group-hover:text-blue-600 transition-colors">{a.product_name}</span>
                                    <span className="text-red-500 text-[11px] font-bold px-2 py-0.5 bg-red-50 rounded-md">
                                        {a.stock_qty}{a.unit} / min {a.stock_min}{a.unit}
                                    </span>
                                </div>
                            ))}
                            <Link href="/stok" className="text-[11px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 transition-colors mt-3 inline-block">
                                Lihat semua stok &rarr;
                            </Link>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-green-600">
                            <p className="text-3xl mb-2 opacity-80">✅</p>
                            <p className="font-medium">Semua stok aman</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Transaksi Terbaru ────────────────────────────── */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 overflow-hidden relative">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-base font-bold tracking-tight text-gray-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-inner">🧾</span>
                        Transaksi Terbaru
                    </h2>
                    <Link href="/pembukuan" className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                        Lihat semua <span className="text-lg leading-none">→</span>
                    </Link>
                </div>
                {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <span className="text-4xl mb-3 grayscale opacity-30">📭</span>
                        <p className="text-sm font-medium">Belum ada transaksi bulan ini</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto -mx-6 px-6 no-scrollbar">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-400 font-semibold tracking-wide uppercase text-[10px]">
                                    <th className="text-left py-3 whitespace-nowrap">Tanggal</th>
                                    <th className="text-left py-3 whitespace-nowrap">Supplier</th>
                                    <th className="text-right py-3 whitespace-nowrap">Total</th>
                                    <th className="text-center py-3 whitespace-nowrap">Status</th>
                                    <th className="text-right py-3 whitespace-nowrap">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.slice(0, 10).map((trx, index) => (
                                    <tr key={trx.id} className={`group ${index !== transactions.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50/50 transition-colors`}>
                                        <td className="py-3 text-gray-600 font-medium whitespace-nowrap">
                                            {new Date(trx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                        </td>
                                        <td className="py-3 text-gray-900 font-semibold max-w-[150px] truncate" title={trx.nama_toko}>{trx.nama_toko || "—"}</td>
                                        <td className="py-3 text-right font-bold text-gray-900 whitespace-nowrap font-mono">{formatRp(trx.total)}</td>
                                        <td className="py-3 text-center whitespace-nowrap">
                                            <StatusBadge status={trx.status} />
                                        </td>
                                        <td className="py-3 text-right whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                            <a
                                                href={`/pembukuan/${trx.id}`}
                                                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 text-xs font-semibold tracking-wide shadow-sm transition-all"
                                            >
                                                Detail
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── Quick Links ──────────────────────────────────── */}
            <div>
            <button
                    onClick={async () => {
                        try {
                            const r = await apiGet("/reports/excel/download");
                            const url = r?.data?.file_url;
                            if (url) {
                                window.open(url, "_blank");
                            } else {
                                alert("File Excel belum tersedia. Silakan generate dulu di halaman Pembukuan.");
                            }
                        } catch (e: any) {
                            alert(e?.response?.data?.detail || "Gagal generate Excel. Coba lagi nanti.");
                        }
                    }}
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 px-8 py-3.5 rounded-xl font-semibold hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3"
                >
                    <span className="text-xl">📥</span> Download Excel Laporan
                </button>
            </div>
        </div>
    );
}
