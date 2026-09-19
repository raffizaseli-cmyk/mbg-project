"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { 
  Truck, 
  Calendar, 
  CalendarDays, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Utensils, 
  ChevronDown, 
  ChevronRight, 
  School, 
  Apple, 
  Sparkles, 
  Search, 
  ArrowRight, 
  FileText, 
  Layers,
  Info,
  Users,
  Flame,
  ShieldCheck,
  Edit3,
  Save,
  Check,
  Building2,
  TrendingUp
} from "lucide-react";

const MONTHS_FULL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatRp(val: string | number): string {
    const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
        .format(n).replace("IDR", "Rp");
}

interface DeliverySummary {
    date: string;
    menu_name: string | null;
    total_portions: number;
    schools_count: number;
    has_delivery: boolean;
    pdf_draft_url?: string | null;
    deliveries?: Array<{ school_name: string; portions_sent: number; receiver_name?: string; status?: string }>;
}

interface NutritionTotals {
    calories: number;
    proteins: number;
    fat: number;
    carbohydrate: number;
    total_gram: number;
}

interface DayNutrition {
    ingredients: Array<{
        name: string;
        weight_gram: number;
        calories: number;
        proteins: number;
        fat: number;
        carbohydrate: number;
        kategori: string;
    }>;
    totals: NutritionTotals;
    sayur_percentage: number;
    is_balanced: boolean;
}

interface CalendarDay {
    date: string;
    day: number;
    day_name: string;
    is_weekday: boolean;
    menu_name: string;
    menu_id: string | null;
    has_menu: boolean;
    has_delivery: boolean;
    total_portions: number;
    schools_delivered: number;
    deliveries: Array<{ school_name: string; portions_sent: number; school_level: string; status: string }>;
    nutrition: DayNutrition | null;
}

interface Beneficiary {
    school_name: string;
    school_level: string;
    beneficiary_type: string;
    target_portions: number;
}

interface CalendarData {
    year: number;
    month: number;
    days_in_month: number;
    days: CalendarDay[];
    beneficiaries: Beneficiary[];
    monthly_summary: {
        total_portions: number;
        delivery_days: number;
        avg_portions_per_day: number;
    };
}

type TabMode = "penyerahan" | "nutrisi";

export default function MbgPage() {
    const now = new Date();
    const [bulan, setBulan] = useState(now.getMonth() + 1);
    const [tahun, setTahun] = useState(now.getFullYear());
    const [summaries, setSummaries] = useState<DeliverySummary[]>([]);
    const [monthly, setMonthly] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [pricePerPortion, setPricePerPortion] = useState(15000);

    // Nutrition Calendar
    const [tabMode, setTabMode] = useState<TabMode>("penyerahan");
    const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
    const [calLoading, setCalLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    
    // Edit Menu State
    const [menus, setMenus] = useState<any[]>([]);
    const [isEditingMenu, setIsEditingMenu] = useState(false);
    const [searchMenuText, setSearchMenuText] = useState("");
    const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
    const [isSavingMenu, setIsSavingMenu] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [mResp, settingsResp] = await Promise.all([
                apiGet("/reports/monthly", { year: tahun, month: bulan }),
                apiGet("/mbg/settings").catch(() => null),
            ]);
            const monthlyData = mResp?.data;
            setMonthly(monthlyData ?? null);
            if (settingsResp?.data?.price_per_portion) {
                setPricePerPortion(Number(settingsResp.data.price_per_portion));
            }

            if (monthlyData?.summaries) {
                const filled = monthlyData.summaries.map((s: any) => ({
                    ...s,
                    has_delivery: true,
                }));
                setSummaries(filled.sort((a: any, b: any) => a.date.localeCompare(b.date)));
            } else {
                setSummaries([]);
            }
        } catch { }
        setLoading(false);
    }, [bulan, tahun]);

    const fetchCalendar = useCallback(async () => {
        setCalLoading(true);
        try {
            const [res, prodRes] = await Promise.all([
                apiGet("/nutrition/calendar", { year: tahun, month: bulan }),
                apiGet("/products", { category: "produk_jadi" })
            ]);
            if (res?.data) setCalendarData(res.data);
            if (prodRes?.data) setMenus(prodRes.data.items || prodRes.data);
        } catch { }
        setCalLoading(false);
    }, [bulan, tahun]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { 
        if (tabMode === "nutrisi") fetchCalendar(); 
        setSelectedDay(null);
        setIsEditingMenu(false);
    }, [tabMode, fetchCalendar]);

    const handleSaveMenu = async () => {
        if (!selectedDay) return;
        setIsSavingMenu(true);
        try {
            const payload = {
                date: selectedDay.date,
                menu_name: searchMenuText,
                menu_id: selectedMenuId
            };
            await apiPost("/mbg/weekly-menus", payload);
            setIsEditingMenu(false);
            fetchCalendar();
        } catch (e) {
            alert("Gagal menyimpan menu. Periksa koneksi atau hak akses.");
        }
        setIsSavingMenu(false);
    };

    const totalPortions = summaries.reduce((s, d) => s + (d.total_portions || 0), 0);
    const totalGross = totalPortions * pricePerPortion;

    // Nutrition color helpers
    const calBg = (day: CalendarDay) => {
        if (!day.is_weekday) return "bg-slate-100/60 border-slate-200/50 opacity-60";
        if (!day.has_menu) return "bg-white/80 border-slate-200 border-dashed hover:border-slate-300";
        if (day.nutrition?.is_balanced) return "bg-emerald-50/70 border-emerald-200/80 hover:border-emerald-300";
        if (day.nutrition && !day.nutrition.is_balanced) return "bg-rose-50/70 border-rose-200/80 hover:border-rose-300";
        return "bg-amber-50/70 border-amber-200/80 hover:border-amber-300";
    };

    return (
        <div className="space-y-6 sm:space-y-8 animate-in mt-2 pb-16">
            <PageHeader 
                title="Operasional MBG & Nutrisi" 
                subtitle={`Monitoring Distribusi, Verifikasi Porsi, & Audit Gizi Seimbang — ${MONTHS_FULL[bulan]} ${tahun}`} 
                actions={
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Standar BGN Terpantau
                        </span>
                    </div>
                }
            />

            {/* Filter & Sub-Nav Hub */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-white p-5 flex flex-wrap gap-4 items-end justify-between relative z-20">
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Bulan Pelaksanaan</label>
                        <select 
                            value={bulan} 
                            onChange={e => setBulan(Number(e.target.value))}
                            className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        >
                            {MONTHS_FULL.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tahun</label>
                        <input 
                            type="number" 
                            value={tahun} 
                            onChange={e => setTahun(Number(e.target.value))}
                            className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium w-28 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                        />
                    </div>
                    <button 
                        onClick={() => { fetchData(); if (tabMode === "nutrisi") fetchCalendar(); }} 
                        className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                        <Search className="w-4 h-4" /> Terapkan
                    </button>
                </div>

                {/* Segmented Mode Selector */}
                <div className="flex bg-slate-100/80 p-1 rounded-xl gap-1 border border-slate-200/60 self-stretch sm:self-auto justify-center">
                    <button 
                        onClick={() => setTabMode("penyerahan")} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                            tabMode === "penyerahan" 
                                ? "bg-white shadow-sm text-blue-700 font-bold" 
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <Truck className="w-4 h-4" /> Riwayat Penyerahan
                    </button>
                    <button 
                        onClick={() => setTabMode("nutrisi")} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                            tabMode === "nutrisi" 
                                ? "bg-white shadow-sm text-emerald-700 font-bold" 
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <Apple className="w-4 h-4" /> Jadwal Menu & Nutrisi
                    </button>
                </div>
            </div>

            {/* Summary Metrics Cards */}
            {monthly && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    <StatCard 
                        title="Total Porsi Disalurkan" 
                        value={`${monthly.mbg?.total_portions?.toLocaleString("id-ID") || 0} porsi`} 
                        icon={<Utensils className="w-5 h-5 text-emerald-600" />} 
                        accentColor="emerald"
                        subtitle="Akumulasi bulan berjalan"
                    />
                    <StatCard 
                        title="Hari Operasional Pengiriman" 
                        value={`${monthly.mbg?.total_delivery_days || 0} hari`} 
                        icon={<CalendarDays className="w-5 h-5 text-blue-600" />} 
                        accentColor="blue"
                        subtitle="Hari kerja aktif"
                    />
                    <StatCard 
                        title="Nilai Hak Tagih Terbentuk" 
                        value={formatRp(monthly.mbg?.revenue_gross || 0)} 
                        icon={<Sparkles className="w-5 h-5 text-amber-600" />} 
                        accentColor="amber"
                        subtitle={`Tarif acuan ${formatRp(pricePerPortion)}/porsi`}
                    />
                    <StatCard 
                        title="Rata-rata Distribusi / Hari" 
                        value={`${monthly.mbg?.avg_portions_per_day || 0} porsi`} 
                        icon={<Truck className="w-5 h-5 text-cyan-600" />} 
                        accentColor="cyan"
                        subtitle="Kapasitas harian dapur"
                    />
                </div>
            )}

            {/* Smart Information Banner */}
            <div className="rounded-2xl border border-blue-200/60 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/40 p-4 sm:p-5 flex items-start gap-3.5 backdrop-blur-sm shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600 mt-0.5">
                    <Info className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <span className="font-bold text-blue-900">Otomasi Pelaporan Telegram & Rekonsiliasi Nota:</span> Data pengiriman harian dicatat langsung oleh tim logistik lapangan via perintah Telegram Bot <code className="bg-blue-100 text-blue-800 font-mono px-1.5 py-0.5 rounded text-xs font-semibold">/serah</code>. Modul ini menyajikan telemetri real-time, validasi kepatuhan menu, serta dokumen rekap format resmi dinas.
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB: Penyerahan */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {tabMode === "penyerahan" && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden relative z-10">
                    <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-transparent">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-base">Riwayat Distribusi Fisik & Berita Acara</h2>
                                <p className="text-xs text-slate-500 font-medium">Tercatat {summaries.length} hari operasional pengiriman</p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                            <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-medium">Memuat log distribusi...</p>
                        </div>
                    ) : summaries.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 space-y-3">
                            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">
                                📭
                            </div>
                            <p className="font-semibold text-slate-600 text-sm">Belum ada pengiriman tercatat pada periode ini</p>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">Gunakan bot Telegram atau pastikan input nota penyerahan telah diproses.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="text-left px-5 py-3.5">Tanggal Operasional</th>
                                        <th className="text-left px-4 py-3.5">Menu Sajian</th>
                                        <th className="text-center px-4 py-3.5">Titik Sekolah</th>
                                        <th className="text-right px-4 py-3.5">Total Porsi</th>
                                        <th className="text-right px-5 py-3.5">Estimasi Gross</th>
                                        <th className="text-center px-4 py-3.5">Draft Bukti</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {summaries.map((s, i) => {
                                        const gross = s.total_portions * pricePerPortion;
                                        const isExp = expanded[s.date];
                                        const d = new Date(s.date);
                                        return (
                                            <div key={s.date} className="contents">
                                                <tr 
                                                    className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${isExp ? "bg-blue-50/20" : i % 2 === 1 ? "bg-slate-50/30" : "bg-white"}`}
                                                    onClick={() => setExpanded(e => ({ ...e, [s.date]: !e[s.date] }))}
                                                >
                                                    <td className="px-5 py-3.5 font-semibold text-slate-800 flex items-center gap-2">
                                                        <span className="text-slate-400 group-hover:text-blue-600 transition-colors">
                                                            {isExp ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4" />}
                                                        </span>
                                                        <span>{d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                                                        {s.menu_name ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                                                                <Utensils className="w-3 h-3 text-emerald-600" /> {s.menu_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-xs">Belum dikaitkan resep</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                                            <School className="w-3 h-3 text-slate-500" />
                                                            {s.schools_count || (s.deliveries?.length ?? 0)} Sekolah
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                                                        {s.total_portions.toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">porsi</span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-700">
                                                        {formatRp(gross)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        {s.pdf_draft_url ? (
                                                            <a 
                                                                href={s.pdf_draft_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold text-xs transition-colors" 
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                <Download className="w-3.5 h-3.5" /> PDF
                                                            </a>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExp && s.deliveries && s.deliveries.length > 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="bg-slate-50/70 p-0 border-b border-blue-100">
                                                            <div className="py-3 px-8 space-y-2 border-l-4 border-blue-500 ml-4 my-2">
                                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Breakdown Distribusi Sekolah:</p>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                    {s.deliveries.map((school, si) => (
                                                                        <div key={`${s.date}-${si}`} className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-xs flex items-center justify-between">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                                                    <School className="w-3.5 h-3.5" />
                                                                                </div>
                                                                                <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px]" title={school.school_name}>
                                                                                    {school.school_name}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                                                                {school.portions_sent} porsi
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </div>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-100/80 border-t-2 border-slate-200 font-bold text-slate-900">
                                    <tr>
                                        <td className="px-5 py-4 uppercase tracking-wider text-xs" colSpan={3}>
                                            Total Akumulasi Periode Ini
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono text-base text-blue-900">
                                            {totalPortions.toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-500">porsi</span>
                                        </td>
                                        <td className="px-5 py-4 text-right font-mono text-base text-emerald-800">
                                            {formatRp(totalGross)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB: Kalender Nutrisi */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {tabMode === "nutrisi" && (
                <div className="space-y-6">
                    {calLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                            <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-medium">Menghitung formulasi nutrisi TKPI & kalender...</p>
                        </div>
                    ) : !calendarData ? (
                        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-100">
                            Data kalender nutrisi tidak tersedia
                        </div>
                    ) : (
                        <>
                            {/* Calendar Matrix Card */}
                            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-white p-5 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-800 text-base">Matriks Jadwal Menu & Status Nutrisi</h2>
                                            <p className="text-xs text-slate-500 font-medium">{MONTHS_FULL[bulan]} {tahun} — Klik kartu tanggal untuk melihat & mengedit komposisi</p>
                                        </div>
                                    </div>
                                    
                                    {/* Quick Summary Pill */}
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-600">
                                        <span>Total Terjadwal: <strong className="text-emerald-700">{calendarData.monthly_summary.total_portions.toLocaleString("id-ID")} porsi</strong></span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-7 gap-2 mb-2">
                                    {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(h => (
                                        <div key={h} className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider py-1.5 bg-slate-50/70 rounded-lg">
                                            {h}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-2">
                                    {/* Empty cells for leading offset */}
                                    {Array.from({ length: new Date(tahun, bulan - 1, 1).getDay() === 0 ? 6 : new Date(tahun, bulan - 1, 1).getDay() - 1 }).map((_, i) => (
                                        <div key={`empty-${i}`} className="min-h-[110px] rounded-xl bg-slate-50/30 border border-slate-100" />
                                    ))}

                                    {calendarData.days.map(day => (
                                        <div 
                                            key={day.date}
                                            className={`min-h-[115px] rounded-xl border p-2 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${calBg(day)} ${
                                                selectedDay?.date === day.date ? "ring-2 ring-blue-600 shadow-md scale-[1.02]" : ""
                                            }`}
                                            onClick={() => {
                                                setSelectedDay(selectedDay?.date === day.date ? null : day);
                                                setIsEditingMenu(false);
                                                setSearchMenuText(day.menu_name || "");
                                                setSelectedMenuId(day.menu_id || null);
                                            }}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                                                    day.is_weekday ? "bg-white/80 text-slate-800 shadow-xs" : "text-slate-400"
                                                }`}>
                                                    {day.day}
                                                </span>
                                                {day.has_delivery && (
                                                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-md font-bold shadow-xs">
                                                        {day.total_portions}
                                                    </span>
                                                )}
                                            </div>

                                            {day.has_menu ? (
                                                <p className="text-[11px] font-bold text-slate-800 mt-1 leading-tight line-clamp-2">
                                                    {day.menu_name}
                                                </p>
                                            ) : day.is_weekday ? (
                                                <p className="text-[10px] text-slate-400 italic mt-1 font-medium">Belum ada menu</p>
                                            ) : null}

                                            {day.nutrition ? (
                                                <div className="mt-1 pt-1 border-t border-black/5">
                                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                                        <span className="text-orange-700">{day.nutrition.totals.calories} kkal</span>
                                                        <span className="text-blue-700">P:{day.nutrition.totals.proteins}g</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[8px] mt-0.5">
                                                        <span className="text-amber-700">L:{day.nutrition.totals.fat}g</span>
                                                        <span className="text-teal-700">K:{day.nutrition.totals.carbohydrate}g</span>
                                                    </div>
                                                    {!day.nutrition.is_balanced && (
                                                        <span className="text-[8px] bg-rose-100 text-rose-700 px-1 rounded font-bold block mt-1 text-center">
                                                            ⚠️ Sayur {day.nutrition.sayur_percentage}%
                                                        </span>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>

                                {/* Modern Legend Bar */}
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-5 pt-4 border-t border-slate-100 text-xs font-medium text-slate-600">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-300 inline-block" /> 
                                        Gizi Seimbang (BGN)
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 rounded-md bg-rose-100 border border-rose-300 inline-block" /> 
                                        Porsi Sayur Kurang (&lt;30%)
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-300 inline-block" /> 
                                        Belum Ada Analisis TKPI
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300 inline-block" /> 
                                        Hari Libur / Non-Aktif
                                    </span>
                                </div>
                            </div>

                            {/* Selected Day Detail Card */}
                            {selectedDay && (
                                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-blue-200/80 p-6 animate-in">
                                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold">
                                                {selectedDay.day}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                                                    Detail Operasional — {selectedDay.day_name}, {new Date(selectedDay.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                                </h3>
                                                <p className="text-xs text-slate-500 font-medium">Analisis nilai gizi per porsi serta penetapan menu</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedDay(null)} 
                                            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="grid lg:grid-cols-2 gap-8">
                                        {/* Left Side: Nutrition & Menu Management */}
                                        <div className="space-y-5">
                                            <div className="flex items-center justify-between bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60">
                                                <div>
                                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Menu Sajian Terpilih</p>
                                                    <p className="text-base font-bold text-slate-800 mt-0.5">
                                                        {selectedDay.menu_name || <span className="text-slate-400 italic">(Belum ada menu)</span>}
                                                    </p>
                                                </div>
                                                {!selectedDay.has_delivery && selectedDay.is_weekday && (
                                                    <button 
                                                        onClick={() => {
                                                            setIsEditingMenu(!isEditingMenu);
                                                            setSearchMenuText(selectedDay.menu_name || "");
                                                            setSelectedMenuId(selectedDay.menu_id || null);
                                                        }} 
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-xs hover:bg-blue-50 transition-colors cursor-pointer"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                        {isEditingMenu ? "Batal" : "Atur / Ganti Menu"}
                                                    </button>
                                                )}
                                            </div>

                                            {isEditingMenu && (
                                                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 space-y-3 animate-in">
                                                    <label className="block text-xs font-bold text-blue-900">Pilih / Ketik Nama Menu Resep</label>
                                                    <input 
                                                        type="text" 
                                                        list="menus-list"
                                                        value={searchMenuText}
                                                        onChange={e => {
                                                            setSearchMenuText(e.target.value);
                                                            const found = menus.find(m => m.name.toLowerCase() === e.target.value.toLowerCase());
                                                            setSelectedMenuId(found ? found.id : null);
                                                        }}
                                                        placeholder="Cari menu resep terdaftar..."
                                                        className="w-full text-sm bg-white border border-blue-300 rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    />
                                                    <datalist id="menus-list">
                                                        {menus.map(m => (
                                                            <option key={m.id} value={m.name} />
                                                        ))}
                                                    </datalist>
                                                    <button 
                                                        onClick={handleSaveMenu} 
                                                        disabled={!searchMenuText.trim() || isSavingMenu}
                                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-500/20"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        {isSavingMenu ? "Menyimpan Perubahan..." : "Simpan Menu Hari Ini"}
                                                    </button>
                                                </div>
                                            )}

                                            {selectedDay.nutrition ? (
                                                <>
                                                    <div className="grid grid-cols-4 gap-2.5">
                                                        <div className="bg-orange-50/80 border border-orange-200/70 p-3 rounded-xl text-center">
                                                            <div className="text-[10px] font-bold text-orange-600 uppercase">Kalori</div>
                                                            <div className="text-lg font-black text-orange-900">{selectedDay.nutrition.totals.calories}</div>
                                                            <div className="text-[9px] text-orange-500 font-medium">kkal</div>
                                                        </div>
                                                        <div className="bg-blue-50/80 border border-blue-200/70 p-3 rounded-xl text-center">
                                                            <div className="text-[10px] font-bold text-blue-600 uppercase">Protein</div>
                                                            <div className="text-lg font-black text-blue-900">{selectedDay.nutrition.totals.proteins}</div>
                                                            <div className="text-[9px] text-blue-500 font-medium">gram</div>
                                                        </div>
                                                        <div className="bg-amber-50/80 border border-amber-200/70 p-3 rounded-xl text-center">
                                                            <div className="text-[10px] font-bold text-amber-600 uppercase">Lemak</div>
                                                            <div className="text-lg font-black text-amber-900">{selectedDay.nutrition.totals.fat}</div>
                                                            <div className="text-[9px] text-amber-500 font-medium">gram</div>
                                                        </div>
                                                        <div className="bg-teal-50/80 border border-teal-200/70 p-3 rounded-xl text-center">
                                                            <div className="text-[10px] font-bold text-teal-600 uppercase">Karbo</div>
                                                            <div className="text-lg font-black text-teal-900">{selectedDay.nutrition.totals.carbohydrate}</div>
                                                            <div className="text-[9px] text-teal-500 font-medium">gram</div>
                                                        </div>
                                                    </div>

                                                    <div className={`px-4 py-2.5 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 ${
                                                        selectedDay.nutrition.is_balanced 
                                                            ? "bg-emerald-100/80 text-emerald-900 border border-emerald-300/60" 
                                                            : "bg-rose-100/80 text-rose-900 border border-rose-300/60"
                                                    }`}>
                                                        {selectedDay.nutrition.is_balanced ? (
                                                            <>
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                                                <span>Komposisi Gizi Seimbang Sesuai Juknis BGN</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <AlertTriangle className="w-4 h-4 text-rose-700" />
                                                                <span>Porsi Sayuran Hanya {selectedDay.nutrition.sayur_percentage}% (Ambang batas wajib min. 30%)</span>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="bg-slate-800 text-white font-bold">
                                                                    <th className="py-2 px-3 text-left">Bahan Baku</th>
                                                                    <th className="py-2 px-3 text-right">Berat (g)</th>
                                                                    <th className="py-2 px-3 text-right text-orange-300">Kalori</th>
                                                                    <th className="py-2 px-3 text-right text-blue-300">Protein</th>
                                                                    <th className="py-2 px-3 text-right text-amber-300">Lemak</th>
                                                                    <th className="py-2 px-3 text-right text-teal-300">Karbo</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {selectedDay.nutrition.ingredients.map((ing, idx) => (
                                                                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                                                        <td className="py-1.5 px-3 font-semibold text-slate-800">{ing.name}</td>
                                                                        <td className="py-1.5 px-3 text-right font-mono text-slate-600">{ing.weight_gram}</td>
                                                                        <td className="py-1.5 px-3 text-right font-mono text-orange-700 font-semibold">{ing.calories}</td>
                                                                        <td className="py-1.5 px-3 text-right font-mono text-blue-700 font-semibold">{ing.proteins}</td>
                                                                        <td className="py-1.5 px-3 text-right font-mono text-amber-700 font-semibold">{ing.fat}</td>
                                                                        <td className="py-1.5 px-3 text-right font-mono text-teal-700 font-semibold">{ing.carbohydrate}</td>
                                                                    </tr>
                                                                ))}
                                                                <tr className="bg-slate-900 text-white font-bold">
                                                                    <td className="py-2 px-3">TOTAL PER PORSI</td>
                                                                    <td className="py-2 px-3 text-right font-mono">{selectedDay.nutrition.totals.total_gram}g</td>
                                                                    <td className="py-2 px-3 text-right font-mono text-orange-300">{selectedDay.nutrition.totals.calories}</td>
                                                                    <td className="py-2 px-3 text-right font-mono text-blue-300">{selectedDay.nutrition.totals.proteins}</td>
                                                                    <td className="py-2 px-3 text-right font-mono text-amber-300">{selectedDay.nutrition.totals.fat}</td>
                                                                    <td className="py-2 px-3 text-right font-mono text-teal-300">{selectedDay.nutrition.totals.carbohydrate}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs italic">
                                                    Belum ada resep & database TKPI yang terasosiasi dengan menu ini.
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Side: Delivery & Beneficiaries */}
                                        <div className="space-y-5">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                                    <Truck className="w-4 h-4 text-blue-600" /> Realisasi Pengiriman Hari Ini
                                                </h4>
                                                {selectedDay.deliveries.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {selectedDay.deliveries.map((del_item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center bg-blue-50/60 border border-blue-100 rounded-xl px-3.5 py-2.5 text-xs">
                                                                <span className="font-semibold text-slate-800 flex items-center gap-2">
                                                                    <School className="w-4 h-4 text-blue-600" /> {del_item.school_name}
                                                                </span>
                                                                <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                                                                    {del_item.portions_sent} porsi
                                                                </span>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between bg-blue-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm">
                                                            <span>Total Seluruh Sekolah</span>
                                                            <span className="font-mono text-sm">{selectedDay.total_portions} porsi</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                                                        Belum ada pencatatan penyerahan fisik pada tanggal ini
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                                    <Users className="w-4 h-4 text-emerald-600" /> Master Kuota Penerima Manfaat
                                                </h4>
                                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-800 text-white font-bold">
                                                                <th className="py-2 px-3 text-left">Sekolah Sasaran</th>
                                                                <th className="py-2 px-3 text-left">Tipe</th>
                                                                <th className="py-2 px-3 text-right">Target / Hari</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {calendarData.beneficiaries.map((b, idx) => (
                                                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                                                    <td className="py-2 px-3 font-semibold text-slate-800">{b.school_name}</td>
                                                                    <td className="py-2 px-3 text-slate-500">{b.beneficiary_type}</td>
                                                                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">{b.target_portions}</td>
                                                                </tr>
                                                            ))}
                                                            {calendarData.beneficiaries.length === 0 && (
                                                                <tr><td colSpan={3} className="py-4 text-center text-slate-400 italic">Belum ada data penerima manfaat</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Monthly Summary Table (Official Government Nutrition Report) */}
                            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden">
                                <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-transparent">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600">
                                            <TrendingUp className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-800 text-base">Rekapitulasi Nutrisi Bulanan — Format Laporan Dinas</h2>
                                            <p className="text-xs text-slate-500 font-medium">Bahan pertanggungjawaban audit kepatuhan gizi program MBG</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider font-bold">
                                                <th className="py-3 px-3 text-left sticky left-0 bg-slate-800 z-10">Tgl</th>
                                                <th className="py-3 px-3 text-left">Hari</th>
                                                <th className="py-3 px-3 text-left min-w-[140px]">Menu Sajian</th>
                                                <th className="py-3 px-3 text-right">Porsi</th>
                                                <th className="py-3 px-3 text-right text-orange-300">Kalori</th>
                                                <th className="py-3 px-3 text-right text-blue-300">Protein</th>
                                                <th className="py-3 px-3 text-right text-amber-300">Lemak</th>
                                                <th className="py-3 px-3 text-right text-teal-300">Karbo</th>
                                                <th className="py-3 px-3 text-right">Berat (g)</th>
                                                <th className="py-3 px-3 text-center">Sayur %</th>
                                                <th className="py-3 px-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calendarData.days.filter(d => d.is_weekday).map((day, i) => {
                                                const n = day.nutrition;
                                                return (
                                                    <tr 
                                                        key={day.date} 
                                                        className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${
                                                            !day.has_menu ? "opacity-50" : ""
                                                        } ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                                                        onClick={() => {
                                                            setSelectedDay(day);
                                                            setIsEditingMenu(false);
                                                            setSearchMenuText(day.menu_name || "");
                                                            setSelectedMenuId(day.menu_id || null);
                                                        }}
                                                    >
                                                        <td className="py-2 px-3 font-bold text-slate-800 sticky left-0 bg-inherit z-10">{day.day}</td>
                                                        <td className="py-2 px-3 text-slate-500">{day.day_name}</td>
                                                        <td className="py-2 px-3 font-semibold text-slate-800 truncate max-w-[180px]">{day.menu_name || "—"}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">{day.total_portions || "—"}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-orange-700 font-semibold">{n?.totals.calories ?? "—"}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-blue-700 font-semibold">{n?.totals.proteins ?? "—"}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-amber-700 font-semibold">{n?.totals.fat ?? "—"}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-teal-700 font-semibold">{n?.totals.carbohydrate ?? "—"}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-slate-600">{n?.totals.total_gram ?? "—"}</td>
                                                        <td className="py-2 px-3 text-center font-bold">
                                                            {n ? (
                                                                <span className={n.sayur_percentage >= 30 ? "text-emerald-700" : "text-rose-600"}>
                                                                    {n.sayur_percentage}%
                                                                </span>
                                                            ) : "—"}
                                                        </td>
                                                        <td className="py-2 px-3 text-center">
                                                            {!day.has_menu ? <span className="text-slate-300">—</span> :
                                                                n?.is_balanced ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">Lolos BGN</span> :
                                                                    n ? <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">Perlu Revisi</span> :
                                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">Belum Ada</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white font-bold text-xs">
                                                <td className="py-3 px-3 uppercase tracking-wider" colSpan={3}>RATA-RATA / TOTAL BULAN INI</td>
                                                <td className="py-3 px-3 text-right font-mono">{calendarData.monthly_summary.total_portions.toLocaleString("id-ID")}</td>
                                                {(() => {
                                                    const daysWithNut = calendarData.days.filter(d => d.nutrition);
                                                    const count = daysWithNut.length || 1;
                                                    const avgCal = Math.round(daysWithNut.reduce((s, d) => s + (d.nutrition?.totals.calories || 0), 0) / count);
                                                    const avgPro = Math.round(daysWithNut.reduce((s, d) => s + (d.nutrition?.totals.proteins || 0), 0) / count * 10) / 10;
                                                    const avgFat = Math.round(daysWithNut.reduce((s, d) => s + (d.nutrition?.totals.fat || 0), 0) / count * 10) / 10;
                                                    const avgCarb = Math.round(daysWithNut.reduce((s, d) => s + (d.nutrition?.totals.carbohydrate || 0), 0) / count * 10) / 10;
                                                    const avgGram = Math.round(daysWithNut.reduce((s, d) => s + (d.nutrition?.totals.total_gram || 0), 0) / count);
                                                    const avgSayur = Math.round(daysWithNut.reduce((s, d) => s + (d.nutrition?.sayur_percentage || 0), 0) / count * 10) / 10;
                                                    return (
                                                        <>
                                                            <td className="py-3 px-3 text-right font-mono text-orange-300">{avgCal}</td>
                                                            <td className="py-3 px-3 text-right font-mono text-blue-300">{avgPro}</td>
                                                            <td className="py-3 px-3 text-right font-mono text-amber-300">{avgFat}</td>
                                                            <td className="py-3 px-3 text-right font-mono text-teal-300">{avgCarb}</td>
                                                            <td className="py-3 px-3 text-right font-mono">{avgGram}g</td>
                                                            <td className="py-3 px-3 text-center font-mono">{avgSayur}%</td>
                                                        </>
                                                    );
                                                })()}
                                                <td className="py-3 px-3 text-center text-emerald-400 font-mono">
                                                    {calendarData.days.filter(d => d.nutrition?.is_balanced).length}/{calendarData.days.filter(d => d.nutrition).length} Lolos
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

