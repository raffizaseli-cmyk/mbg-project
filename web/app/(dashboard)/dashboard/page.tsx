"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExpenseTrendChart } from "@/components/charts/ExpenseTrendChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { 
  Sparkles, 
  ArrowUpRight, 
  Download, 
  RefreshCw, 
  UtensilsCrossed, 
  Package, 
  ReceiptText, 
  SlidersHorizontal, 
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  TrendingUp,
  Clock
} from "lucide-react";

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
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState("SPPG Utama");

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
                setTenantName(me?.data?.tenant_name || me?.data?.user?.tenant_name || "SPPG Utama");
            } catch { }
        } catch (e: any) {
            setError("Gagal memuat data. Pastikan server backend sedang aktif.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAll();
        fetchExpenseTrend();
    };

    useEffect(() => {
        fetchAll();
        fetchExpenseTrend();
    }, [fetchAll, fetchExpenseTrend]);

    const handleDownloadExcel = async () => {
        try {
            const r = await apiGet("/reports/excel/download");
            const url = r?.data?.file_url;
            if (url) {
                window.open(url, "_blank");
            } else {
                alert("Laporan Excel sedang disiapkan. Buka menu Pembukuan untuk mengenerate rekapitulasi.");
            }
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Gagal mengunduh Excel. Silakan coba beberapa saat lagi.");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-500">Memuat statistik dapur SPPG...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-80">
                <div className="text-center p-8 bg-white rounded-3xl border border-red-200/80 shadow-lg max-w-md space-y-4">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                        ⚠️
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Koneksi Data Terputus</h3>
                    <p className="text-xs text-slate-500">{error}</p>
                    <button 
                        onClick={handleRefresh} 
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20"
                    >
                        Muat Ulang
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-8">
            
            {/* ─── Hero Header & Action Bar ────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 text-xs font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            Live Telemetri MBG
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-medium text-slate-500">{todayLabel()}</span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                        {getGreeting()},{" "}
                        <span className="text-blue-600">
                            {tenantName}
                        </span>{" "}
                        👋
                    </h1>
                    <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">
                        Pantau penyerahan makanan bergizi, ketersediaan bahan, dan realisasi anggaran dapur hari ini.
                    </p>
                </div>

                {/* Right Action Tools */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        title="Segarkan data"
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all shadow-xs disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
                    </button>

                    <button
                        onClick={handleDownloadExcel}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white text-xs font-bold shadow-md shadow-slate-900/15 hover:shadow-slate-900/25 hover:-translate-y-0.5 transition-all group"
                    >
                        <Download className="w-4 h-4 text-amber-400 group-hover:-translate-y-0.5 transition-transform" />
                        <span>Ekspor Laporan Juknis</span>
                    </button>
                </div>
            </div>

            {/* ─── Stat Cards Tier 1: Metrik Inti Harian ───────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <StatCard
                    title="Porsi MBG Hari Ini"
                    value={daily?.mbg.has_delivery ? `${daily.mbg.total_portions.toLocaleString("id-ID")} Porsi` : "Belum Ada Serah"}
                    subtitle={daily?.mbg.has_delivery ? `${daily.mbg.total_schools} Sekolah Penerima` : "Siap input via Telegram / Web"}
                    icon="🍱"
                    accentColor="blue"
                    trend={daily?.mbg.has_delivery ? "up" : "neutral"}
                    trendValue={daily?.mbg.has_delivery ? "Aktif" : "Menunggu"}
                />
                <StatCard
                    title="Tagihan Negara (Gross)"
                    value={monthly ? formatRp(monthly.mbg.revenue_calculated || monthly.mbg.revenue_gross) : "—"}
                    subtitle={`${monthly?.mbg.total_portions.toLocaleString("id-ID") ?? 0} Porsi Bulan Ini`}
                    icon="💰"
                    accentColor="emerald"
                    trend="up"
                    trendValue="Juknis BGN"
                />
                <StatCard
                    title="Belanja Logistik Hari Ini"
                    value={daily ? formatRp(daily.expenses.total) : "—"}
                    subtitle={`${daily?.expenses.count ?? 0} Nota Belanja Pasar`}
                    icon="🛒"
                    accentColor="amber"
                    trend={daily?.expenses.count ? "up" : "neutral"}
                    trendValue={`${daily?.expenses.count || 0} Trx`}
                />
            </div>

            {/* ─── Operational Control Center: 4 Quick Interactive Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Input Serah MBG */}
                <div 
                    onClick={() => router.push('/mbg')} 
                    className="relative overflow-hidden p-5 rounded-3xl bg-blue-600 text-white cursor-pointer shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 hover:-translate-y-1 transition-all group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between relative z-10 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                            🍱
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-blue-100">
                            Distribusi
                        </span>
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-white group-hover:translate-x-0.5 transition-transform">
                        Input Serah MBG
                    </h3>
                    <p className="text-blue-100/80 text-xs mt-1 leading-relaxed">
                        Catat berita acara & bukti serah terima sekolah
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-200 group-hover:text-white">
                        <span>Buka Penyerahan</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>

                {/* 2. Master Menu & BOM Gizi */}
                <div 
                    onClick={() => router.push('/dapur')} 
                    className="relative overflow-hidden p-5 rounded-3xl bg-orange-600 text-white cursor-pointer shadow-lg shadow-orange-500/20 hover:shadow-orange-500/35 hover:-translate-y-1 transition-all group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between relative z-10 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                            🍽️
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-amber-100">
                            Resep & Gizi
                        </span>
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-white group-hover:translate-x-0.5 transition-transform">
                        Master Resep (BOM)
                    </h3>
                    <p className="text-amber-100/80 text-xs mt-1 leading-relaxed">
                        Formula porsi, kalori & kalkulasi HPP piring
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-bold text-amber-200 group-hover:text-white">
                        <span>Kelola Menu</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>

                {/* 3. AI OCR & Catat Belanja */}
                <div 
                    onClick={() => router.push('/pembukuan')} 
                    className="relative overflow-hidden p-5 rounded-3xl bg-emerald-600 text-white cursor-pointer shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/35 hover:-translate-y-1 transition-all group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between relative z-10 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                            🛒
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-emerald-100">
                            AI OCR Nota
                        </span>
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-white group-hover:translate-x-0.5 transition-transform">
                        Pembukuan & Kas
                    </h3>
                    <p className="text-emerald-100/80 text-xs mt-1 leading-relaxed">
                        Rekonsiliasi nota belanja pasar & rekaman kas
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-200 group-hover:text-white">
                        <span>Buka Pembukuan</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>

                {/* 4. Gudang & Opname Stok */}
                <div 
                    onClick={() => router.push('/stok')} 
                    className="relative overflow-hidden p-5 rounded-3xl bg-slate-700 text-white cursor-pointer shadow-lg shadow-slate-600/20 hover:shadow-slate-600/35 hover:-translate-y-1 transition-all group"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                    <div className="flex items-center justify-between relative z-10 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                            📦
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-slate-200">
                            Gudang Dapur
                        </span>
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-white group-hover:translate-x-0.5 transition-transform">
                        Stok & Opname
                    </h3>
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                        Pantau kuota bahan kritis & kartu stok bahan
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-bold text-slate-300 group-hover:text-white">
                        <span>Cek Persediaan</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>

            </div>

            {/* ─── Stat Cards Tier 2: Kesehatan Finansial & SDM ─────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <StatCard
                    title="Piutang Bahan Pangan"
                    value={monthly ? formatRp(monthly.piutang_total || "0") : "—"}
                    subtitle="Belum cair dari instansi"
                    icon="📋"
                    accentColor="cyan"
                    trend="neutral"
                    trendValue="Piutang"
                />
                <StatCard
                    title="Hutang Outstanding Supplier"
                    value={monthly ? formatRp(monthly.expenses.hutang_outstanding) : "—"}
                    subtitle="Kewajiban bayar pedagang/toko"
                    icon="🧾"
                    accentColor="rose"
                    trend={monthly?.expenses.hutang_outstanding && parseFloat(monthly.expenses.hutang_outstanding) > 0 ? "down" : "neutral"}
                    trendValue="Tempo"
                />
                <StatCard
                    title="Karyawan & Tenaga Masak"
                    value={`${employees.length} Personel`}
                    subtitle="Koki, helper & kurir aktif"
                    icon="👥"
                    accentColor="blue"
                    trend="neutral"
                    trendValue="Tim SPPG"
                />
            </div>

            {/* ─── Charts Section ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Tren Pengeluaran */}
                <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                <span>Tren Belanja Pasar</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                                    7 Hari
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Riwayat pengeluaran nota terkonfirmasi harian</p>
                        </div>
                    </div>
                    
                    <ExpenseTrendChart data={expenseTrend} />
                </div>

                {/* Donut Alokasi Pagu Anggaran */}
                <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                Beban Anggaran Terhadap Pagu
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Proporsi belanja berdasarkan pagu Juknis BGN</p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pagu Bulan Ini</span>
                            <p className="text-sm font-extrabold text-blue-600">{formatRp(budget?.pagu_amount || 0)}</p>
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
                            if (pagu > 0 && sisa > 0) {
                                result.push({ name: "Sisa Pagu Aman", value: sisa, color: "#10B981" });
                            }
                            
                            return result.filter(x => x.value > 0);
                        })()} />
                    ) : (
                        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                            Memuat kalkulasi pagu...
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Two-Column Intelligence Hub: Penyerahan & Stok Kritis ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Penyerahan Hari Ini Card */}
                <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-base">🍱</span>
                                Penyerahan Hari Ini
                            </h2>
                            <Link href="/mbg" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                Kelola <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        {daily?.mbg.has_delivery ? (
                            <div className="space-y-3">
                                {daily.mbg.menu_name && (
                                    <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Menu Masakan</span>
                                            <span className="text-sm font-bold text-slate-900">{daily.mbg.menu_name}</span>
                                        </div>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                            Standar Gizi OK
                                        </span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                                        <span className="text-xs font-semibold text-slate-500 block">Total Porsi</span>
                                        <span className="text-lg font-extrabold text-blue-600">
                                            {daily.mbg.total_portions.toLocaleString("id-ID")} porsi
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                                        <span className="text-xs font-semibold text-slate-500 block">Gross Revenue</span>
                                        <span className="text-lg font-extrabold text-emerald-600">
                                            {formatRp(daily.mbg.revenue_gross)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400 flex flex-col items-center">
                                <span className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-2xl mb-2">
                                    🍽️
                                </span>
                                <p className="font-bold text-sm text-slate-700">Belum ada penyerahan tercatat</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                                    Gunakan menu <span className="font-semibold text-blue-600">Input Serah MBG</span> atau kirim via Bot Telegram <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">/serah</code>
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Format Dokumen BAP Digital BGN
                        </span>
                        <Link href="/mbg" className="font-semibold text-blue-600 hover:underline">
                            Daftar Sekolah &rarr;
                        </Link>
                    </div>
                </div>

                {/* Stok Gudang Kritis */}
                <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-base">📦</span>
                                Peringatan Stok Gudang
                            </h2>
                            <Link href="/stok" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                Semua Stok <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        {daily?.stock_alerts && daily.stock_alerts.length > 0 ? (
                            <div className="space-y-2.5">
                                {daily.stock_alerts.slice(0, 4).map((alert, idx) => (
                                    <div key={idx} className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between group hover:bg-slate-100 transition-colors">
                                        <div className="min-w-0 flex-1 pr-3">
                                            <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                                {alert.product_name}
                                            </h4>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Tersedia {alert.stock_qty} {alert.unit} (Batas min: {alert.stock_min} {alert.unit})
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                                            Kurang {alert.deficit} {alert.unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-emerald-600 flex flex-col items-center">
                                <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-2">
                                    ✅
                                </span>
                                <p className="font-bold text-sm text-slate-800">Semua Persediaan Aman</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Tidak ada bahan baku yang berada di bawah kuota minimum.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Sinkron otomatis tiap ada nota belanja
                        </span>
                        <Link href="/stok" className="font-semibold text-blue-600 hover:underline">
                            Input Masuk &rarr;
                        </Link>
                    </div>
                </div>

            </div>

            {/* ─── Transaksi Nota & Pembukuan Terbaru ───────────────────── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 overflow-hidden relative">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-base">🧾</span>
                            Transaksi Belanja Pasar Terbaru
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">Nota belanja bahan baku yang baru diunggah dan dianalisis AI</p>
                    </div>
                    <Link href="/pembukuan" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        Buka Buku Kas <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <span className="text-4xl mb-2 opacity-40">📭</span>
                        <p className="text-sm font-semibold text-slate-600">Belum ada transaksi bulan ini</p>
                        <p className="text-xs text-slate-400 mt-0.5">Unggah foto nota belanja di menu Pembukuan.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto -mx-6 px-6 no-scrollbar">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-xs">
                                    <th className="py-3 px-3">Tanggal</th>
                                    <th className="py-3 px-3">Toko / Supplier</th>
                                    <th className="py-3 px-3 text-right">Total Tagihan</th>
                                    <th className="py-3 px-3 text-center">Status Verifikasi</th>
                                    <th className="py-3 px-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactions.slice(0, 8).map((trx) => (
                                    <tr key={trx.id} className="hover:bg-slate-50/70 transition-colors group">
                                        <td className="py-3 px-3 text-xs font-semibold text-slate-600 whitespace-nowrap">
                                            {new Date(trx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                        </td>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                                                    {(trx.nama_toko || "T").charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]" title={trx.nama_toko}>
                                                    {trx.nama_toko || "Supplier Pasar"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                                            {formatRp(trx.total)}
                                        </td>
                                        <td className="py-3 px-3 text-center whitespace-nowrap">
                                            <StatusBadge status={trx.status} />
                                        </td>
                                        <td className="py-3 px-3 text-right whitespace-nowrap">
                                            <Link
                                                href={`/pembukuan/${trx.id}`}
                                                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-600 text-xs font-semibold shadow-xs transition-all"
                                            >
                                                Periksa
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}

