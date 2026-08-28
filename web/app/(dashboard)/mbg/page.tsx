"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";

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
            alert("Menu berhasil disimpan!");
            setIsEditingMenu(false);
            fetchCalendar();
        } catch (e) {
            alert("Gagal menyimpan menu.");
        }
        setIsSavingMenu(false);
    };

    const totalPortions = summaries.reduce((s, d) => s + (d.total_portions || 0), 0);
    const totalGross = totalPortions * pricePerPortion;

    // Nutrition color helpers
    const calBg = (day: CalendarDay) => {
        if (!day.is_weekday) return "bg-gray-100 opacity-50";
        if (!day.has_menu) return "bg-white border-dashed";
        if (day.nutrition?.is_balanced) return "bg-emerald-50 border-emerald-200";
        if (day.nutrition && !day.nutrition.is_balanced) return "bg-red-50 border-red-200";
        return "bg-amber-50 border-amber-200";
    };

    return (
        <div className="space-y-6 sm:space-y-8 animate-in mt-2">
            <PageHeader title="MBG — Penyerahan & Nutrisi" subtitle={`${MONTHS_FULL[bulan]} ${tahun}`} />

            {/* Filter + Tab Toggle */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-white p-5 flex flex-wrap gap-4 items-end overflow-visible z-20 relative">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Bulan</label>
                    <select value={bulan} onChange={e => { setBulan(Number(e.target.value)); }}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        {MONTHS_FULL.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Tahun</label>
                    <input type="number" value={tahun} onChange={e => setTahun(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24" />
                </div>
                <button onClick={() => { fetchData(); if (tabMode === "nutrisi") fetchCalendar(); }} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                    🔍 Terapkan
                </button>
                <div className="ml-auto flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
                    <button onClick={() => setTabMode("penyerahan")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tabMode === "penyerahan" ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
                        📋 Riwayat Penyerahan
                    </button>
                    <button onClick={() => setTabMode("nutrisi")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tabMode === "nutrisi" ? "bg-white shadow text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}>
                        📅 Jadwal Menu & Kalender
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {monthly && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Total Porsi" value={`${monthly.mbg?.total_portions?.toLocaleString("id-ID")} porsi`} icon="🍱" />
                    <StatCard title="Hari Kirim" value={`${monthly.mbg?.total_delivery_days} hari`} icon="📅" />
                    <StatCard title="Tagihan Terbentuk" value={formatRp(monthly.mbg?.revenue_gross)} icon="💰" />
                    <StatCard title="Rata-rata/Hari" value={`${monthly.mbg?.avg_portions_per_day} porsi`} icon="📊" />
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                💡 Input penyerahan MBG via Telegram Bot <code className="bg-blue-100 px-1 rounded">/serah</code>
                &nbsp;— web hanya untuk monitoring dan download laporan
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB: Penyerahan */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {tabMode === "penyerahan" && (
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden mt-2 relative z-10">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-800">📋 Riwayat Penyerahan ({summaries.length} hari)</h2>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : summaries.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p className="text-3xl mb-2">📭</p>
                            <p>Belum ada penyerahan di bulan ini</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {["Tanggal", "Menu", "Sekolah", "Total Porsi", "Gross", "PDF"].map(h => (
                                                <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summaries.map((s, i) => {
                                            const gross = s.total_portions * pricePerPortion;
                                            const isExp = expanded[s.date];
                                            const d = new Date(s.date);
                                            return (
                                                <>
                                                    <tr key={s.date} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}
                                                        onClick={() => setExpanded(e => ({ ...e, [s.date]: !e[s.date] }))}>
                                                        <td className="px-4 py-2.5 font-medium">
                                                            {isExp ? "▼" : "▶"}&nbsp;
                                                            {d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-600">{s.menu_name || "—"}</td>
                                                        <td className="px-4 py-2.5 text-center">{s.schools_count || (s.deliveries?.length ?? "—")}</td>
                                                        <td className="px-4 py-2.5 font-semibold">{s.total_portions.toLocaleString("id-ID")}</td>
                                                        <td className="px-4 py-2.5 text-right">{formatRp(gross)}</td>
                                                        <td className="px-4 py-2.5">
                                                            {s.pdf_draft_url
                                                                ? <a href={s.pdf_draft_url} target="_blank" rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:underline text-xs" onClick={e => e.stopPropagation()}>📄 Download</a>
                                                                : <span className="text-gray-300">—</span>}
                                                        </td>
                                                    </tr>
                                                    {isExp && s.deliveries && s.deliveries.map((school, si) => (
                                                        <tr key={`${s.date}-${si}`} className="bg-blue-50/40 border-b border-blue-50">
                                                            <td className="px-4 py-1.5 pl-10 text-xs text-gray-500 italic" colSpan={3}>
                                                                🏫 {school.school_name}
                                                            </td>
                                                            <td className="px-4 py-1.5 text-xs text-center">{school.portions_sent}</td>
                                                            <td colSpan={1} />
                                                            <td className="px-4 py-1.5 text-xs text-gray-400">{school.status}</td>
                                                        </tr>
                                                    ))}
                                                </>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                        <tr>
                                            <td className="px-4 py-2.5 font-bold" colSpan={3}>TOTAL</td>
                                            <td className="px-4 py-2.5 font-bold">{totalPortions.toLocaleString("id-ID")}</td>
                                            <td className="px-4 py-2.5 font-bold text-right">{formatRp(totalGross)}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB: Kalender Nutrisi */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {tabMode === "nutrisi" && (
                <>
                    {calLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : !calendarData ? (
                        <div className="text-center py-12 text-gray-400">Data tidak tersedia</div>
                    ) : (
                        <>
                            {/* Calendar Grid */}
                            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-white p-5">
                                <h2 className="font-bold text-gray-800 text-lg mb-4">📅 Kalender Nutrisi — {MONTHS_FULL[bulan]} {tahun}</h2>
                                <div className="grid grid-cols-7 gap-1.5 mb-2">
                                    {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(h => (
                                        <div key={h} className="text-center text-xs font-bold text-gray-400 uppercase py-1">{h}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {/* Empty cells for days before the 1st */}
                                    {Array.from({ length: new Date(tahun, bulan - 1, 1).getDay() === 0 ? 6 : new Date(tahun, bulan - 1, 1).getDay() - 1 }).map((_, i) => (
                                        <div key={`empty-${i}`} className="h-28" />
                                    ))}
                                    {calendarData.days.map(day => (
                                        <div key={day.date}
                                            className={`h-28 rounded-xl border p-1.5 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${calBg(day)} ${selectedDay?.date === day.date ? "ring-2 ring-blue-500 shadow-lg" : ""}`}
                                            onClick={() => {
                                                setSelectedDay(selectedDay?.date === day.date ? null : day);
                                                setIsEditingMenu(false);
                                                setSearchMenuText(day.menu_name || "");
                                                setSelectedMenuId(day.menu_id || null);
                                            }}>
                                            <div className="flex justify-between items-start">
                                                <span className={`text-xs font-bold ${day.is_weekday ? "text-gray-700" : "text-gray-400"}`}>{day.day}</span>
                                                {day.has_delivery && <span className="text-[9px] bg-blue-600 text-white px-1 rounded font-bold">{day.total_portions}</span>}
                                            </div>
                                            {day.has_menu && (
                                                <p className="text-[10px] font-medium text-gray-700 mt-0.5 leading-tight line-clamp-2">{day.menu_name}</p>
                                            )}
                                            {day.nutrition && (
                                                <div className="mt-auto pt-0.5">
                                                    <div className="text-[8px] font-bold text-orange-600">{day.nutrition.totals.calories} kkal</div>
                                                    <div className="flex gap-1">
                                                        <span className="text-[7px] text-blue-600">P:{day.nutrition.totals.proteins}g</span>
                                                        <span className="text-[7px] text-yellow-600">L:{day.nutrition.totals.fat}g</span>
                                                        <span className="text-[7px] text-teal-600">K:{day.nutrition.totals.carbohydrate}g</span>
                                                    </div>
                                                    {!day.nutrition.is_balanced && <span className="text-[7px] text-red-600 font-bold">⚠️ Sayur {day.nutrition.sayur_percentage}%</span>}
                                                </div>
                                            )}
                                            {!day.has_menu && day.is_weekday && (
                                                <p className="text-[9px] text-gray-400 italic mt-1">Belum ada menu</p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className="flex gap-4 mt-4 text-[10px] font-medium text-gray-500">
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> Gizi Seimbang</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Sayur &lt;30%</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Belum Ada Nutrisi</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" /> Libur</span>
                                </div>
                            </div>

                            {/* Selected Day Detail */}
                            {selectedDay && (
                                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white p-5 animate-in">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-gray-900">
                                            📊 Detail — {selectedDay.day_name}, {new Date(selectedDay.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                        </h3>
                                        <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        {/* Left: Nutrition */}
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-bold text-gray-700">🍽 Menu: <span className="text-emerald-700">{selectedDay.menu_name || "(Belum diset)"}</span></h4>
                                                {!selectedDay.has_delivery && selectedDay.is_weekday && (
                                                    <button onClick={() => {
                                                        setIsEditingMenu(!isEditingMenu);
                                                        setSearchMenuText(selectedDay.menu_name || "");
                                                        setSelectedMenuId(selectedDay.menu_id || null);
                                                    }} className="text-xs text-blue-600 hover:text-blue-800 font-bold border border-blue-200 bg-blue-50 px-2 py-1 rounded">
                                                        {isEditingMenu ? "Batal Edit" : "✏️ Atur Menu"}
                                                    </button>
                                                )}
                                            </div>

                                            {isEditingMenu && (
                                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 animate-in fade-in slide-in-from-top-2">
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Cari / Ketik Nama Menu</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            list="menus-list"
                                                            value={searchMenuText}
                                                            onChange={e => {
                                                                setSearchMenuText(e.target.value);
                                                                const found = menus.find(m => m.name.toLowerCase() === e.target.value.toLowerCase());
                                                                setSelectedMenuId(found ? found.id : null);
                                                            }}
                                                            placeholder="Ketik untuk mencari menu..."
                                                            className="w-full text-sm border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                                                        />
                                                        <datalist id="menus-list">
                                                            {menus.map(m => (
                                                                <option key={m.id} value={m.name} />
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                    <button 
                                                        onClick={handleSaveMenu} 
                                                        disabled={!searchMenuText.trim() || isSavingMenu}
                                                        className="w-full bg-blue-600 text-white font-bold py-1.5 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">
                                                        {isSavingMenu ? "Menyimpan..." : "💾 Simpan Menu Hari Ini"}
                                                    </button>
                                                </div>
                                            )}

                                            {selectedDay.nutrition ? (
                                                <>
                                                    <div className="grid grid-cols-4 gap-2 mb-4">
                                                        <div className="bg-orange-50 border border-orange-100 p-2 rounded-xl text-center">
                                                            <div className="text-[9px] font-bold text-orange-600 uppercase">Kalori</div>
                                                            <div className="text-sm font-black text-orange-800">{selectedDay.nutrition.totals.calories}</div>
                                                            <div className="text-[8px] text-orange-500">kkal</div>
                                                        </div>
                                                        <div className="bg-blue-50 border border-blue-100 p-2 rounded-xl text-center">
                                                            <div className="text-[9px] font-bold text-blue-600 uppercase">Protein</div>
                                                            <div className="text-sm font-black text-blue-800">{selectedDay.nutrition.totals.proteins}</div>
                                                            <div className="text-[8px] text-blue-500">gram</div>
                                                        </div>
                                                        <div className="bg-yellow-50 border border-yellow-100 p-2 rounded-xl text-center">
                                                            <div className="text-[9px] font-bold text-yellow-600 uppercase">Lemak</div>
                                                            <div className="text-sm font-black text-yellow-800">{selectedDay.nutrition.totals.fat}</div>
                                                            <div className="text-[8px] text-yellow-500">gram</div>
                                                        </div>
                                                        <div className="bg-teal-50 border border-teal-100 p-2 rounded-xl text-center">
                                                            <div className="text-[9px] font-bold text-teal-600 uppercase">Karbo</div>
                                                            <div className="text-sm font-black text-teal-800">{selectedDay.nutrition.totals.carbohydrate}</div>
                                                            <div className="text-[8px] text-teal-500">gram</div>
                                                        </div>
                                                    </div>
                                                    <div className={`px-3 py-2 rounded-xl text-xs font-bold text-center mb-3 ${selectedDay.nutrition.is_balanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                                        {selectedDay.nutrition.is_balanced ? "✅ Gizi Seimbang" : `⚠️ Sayur Hanya ${selectedDay.nutrition.sayur_percentage}% (Min 30%)`}
                                                    </div>
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-700 text-white">
                                                                <th className="py-1.5 px-2 text-left">Bahan</th>
                                                                <th className="py-1.5 px-2 text-right">g</th>
                                                                <th className="py-1.5 px-2 text-right">Kal</th>
                                                                <th className="py-1.5 px-2 text-right">Pro</th>
                                                                <th className="py-1.5 px-2 text-right">Lem</th>
                                                                <th className="py-1.5 px-2 text-right">Kar</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedDay.nutrition.ingredients.map((ing, idx) => (
                                                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                                    <td className="py-1 px-2 font-medium">{ing.name}</td>
                                                                    <td className="py-1 px-2 text-right font-mono">{ing.weight_gram}</td>
                                                                    <td className="py-1 px-2 text-right font-mono text-orange-700">{ing.calories}</td>
                                                                    <td className="py-1 px-2 text-right font-mono text-blue-700">{ing.proteins}</td>
                                                                    <td className="py-1 px-2 text-right font-mono text-yellow-700">{ing.fat}</td>
                                                                    <td className="py-1 px-2 text-right font-mono text-teal-700">{ing.carbohydrate}</td>
                                                                </tr>
                                                            ))}
                                                            <tr className="bg-slate-700 text-white font-bold">
                                                                <td className="py-1.5 px-2">TOTAL</td>
                                                                <td className="py-1.5 px-2 text-right">{selectedDay.nutrition.totals.total_gram}g</td>
                                                                <td className="py-1.5 px-2 text-right">{selectedDay.nutrition.totals.calories}</td>
                                                                <td className="py-1.5 px-2 text-right">{selectedDay.nutrition.totals.proteins}</td>
                                                                <td className="py-1.5 px-2 text-right">{selectedDay.nutrition.totals.fat}</td>
                                                                <td className="py-1.5 px-2 text-right">{selectedDay.nutrition.totals.carbohydrate}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">Belum ada data nutrisi untuk menu ini</p>
                                            )}
                                        </div>

                                        {/* Right: Delivery & Penerima Manfaat */}
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-700 mb-3">🏫 Penyerahan Hari Ini</h4>
                                            {selectedDay.deliveries.length > 0 ? (
                                                <div className="space-y-1.5 mb-4">
                                                    {selectedDay.deliveries.map((del_item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-blue-50 rounded-lg px-3 py-2 text-xs">
                                                            <span className="font-medium text-gray-800">🏫 {del_item.school_name}</span>
                                                            <span className="font-bold text-blue-700">{del_item.portions_sent} porsi</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between bg-blue-700 text-white rounded-lg px-3 py-2 text-xs font-bold">
                                                        <span>Total</span>
                                                        <span>{selectedDay.total_portions} porsi</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-400 italic mb-4">Belum ada delivery hari ini</p>
                                            )}

                                            <h4 className="text-sm font-bold text-gray-700 mb-2">👥 Penerima Manfaat</h4>
                                            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-700 text-white">
                                                            <th className="py-1.5 px-2 text-left">Sekolah</th>
                                                            <th className="py-1.5 px-2 text-left">Jenis</th>
                                                            <th className="py-1.5 px-2 text-right">Target/Hari</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {calendarData.beneficiaries.map((b, idx) => (
                                                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                                <td className="py-1 px-2 font-medium">{b.school_name}</td>
                                                                <td className="py-1 px-2 text-gray-600">{b.beneficiary_type}</td>
                                                                <td className="py-1 px-2 text-right font-bold">{b.target_portions}</td>
                                                            </tr>
                                                        ))}
                                                        {calendarData.beneficiaries.length === 0 && (
                                                            <tr><td colSpan={3} className="py-3 text-center text-gray-400 italic">Belum ada data penerima manfaat</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Monthly Summary Table (For Government Report) */}
                            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <h2 className="font-bold text-gray-800">📊 Rekap Nutrisi Bulanan — Laporan Pemerintah</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider">
                                                <th className="py-2.5 px-2 text-left sticky left-0 bg-slate-800 z-10">Tgl</th>
                                                <th className="py-2.5 px-2 text-left">Hari</th>
                                                <th className="py-2.5 px-2 text-left min-w-[120px]">Menu</th>
                                                <th className="py-2.5 px-2 text-right">Porsi</th>
                                                <th className="py-2.5 px-2 text-right text-orange-300">Kalori</th>
                                                <th className="py-2.5 px-2 text-right text-blue-300">Protein</th>
                                                <th className="py-2.5 px-2 text-right text-yellow-300">Lemak</th>
                                                <th className="py-2.5 px-2 text-right text-teal-300">Karbo</th>
                                                <th className="py-2.5 px-2 text-right">Berat(g)</th>
                                                <th className="py-2.5 px-2 text-center">Sayur%</th>
                                                <th className="py-2.5 px-2 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calendarData.days.filter(d => d.is_weekday).map((day, i) => {
                                                const n = day.nutrition;
                                                return (
                                                    <tr key={day.date} className={`border-t border-gray-100 ${!day.has_menu ? "opacity-40" : ""} ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/30 transition-colors cursor-pointer`}
                                                        onClick={() => {
                                                            setSelectedDay(day);
                                                            setIsEditingMenu(false);
                                                            setSearchMenuText(day.menu_name || "");
                                                            setSelectedMenuId(day.menu_id || null);
                                                        }}>
                                                        <td className="py-1.5 px-2 font-bold text-gray-700 sticky left-0 bg-inherit z-10">{day.day}</td>
                                                        <td className="py-1.5 px-2 text-gray-500">{day.day_name}</td>
                                                        <td className="py-1.5 px-2 font-medium text-gray-800 truncate max-w-[150px]">{day.menu_name || "—"}</td>
                                                        <td className="py-1.5 px-2 text-right font-mono">{day.total_portions || "—"}</td>
                                                        <td className="py-1.5 px-2 text-right font-mono text-orange-700">{n?.totals.calories ?? "—"}</td>
                                                        <td className="py-1.5 px-2 text-right font-mono text-blue-700">{n?.totals.proteins ?? "—"}</td>
                                                        <td className="py-1.5 px-2 text-right font-mono text-yellow-700">{n?.totals.fat ?? "—"}</td>
                                                        <td className="py-1.5 px-2 text-right font-mono text-teal-700">{n?.totals.carbohydrate ?? "—"}</td>
                                                        <td className="py-1.5 px-2 text-right font-mono text-gray-600">{n?.totals.total_gram ?? "—"}</td>
                                                        <td className="py-1.5 px-2 text-center">{n ? `${n.sayur_percentage}%` : "—"}</td>
                                                        <td className="py-1.5 px-2 text-center">
                                                            {!day.has_menu ? <span className="text-gray-300">—</span> :
                                                                n?.is_balanced ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-bold">✅</span> :
                                                                    n ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-bold">⚠️</span> :
                                                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold">?</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-800 text-white font-bold text-xs">
                                                <td className="py-2 px-2" colSpan={3}>RATA-RATA / TOTAL</td>
                                                <td className="py-2 px-2 text-right">{calendarData.monthly_summary.total_portions}</td>
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
                                                            <td className="py-2 px-2 text-right text-orange-300">{avgCal}</td>
                                                            <td className="py-2 px-2 text-right text-blue-300">{avgPro}</td>
                                                            <td className="py-2 px-2 text-right text-yellow-300">{avgFat}</td>
                                                            <td className="py-2 px-2 text-right text-teal-300">{avgCarb}</td>
                                                            <td className="py-2 px-2 text-right">{avgGram}g</td>
                                                            <td className="py-2 px-2 text-center">{avgSayur}%</td>
                                                        </>
                                                    );
                                                })()}
                                                <td className="py-2 px-2 text-center">
                                                    {calendarData.days.filter(d => d.nutrition?.is_balanced).length}/{calendarData.days.filter(d => d.nutrition).length}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Penerima Manfaat Full Table */}
                            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <h2 className="font-bold text-gray-800">👥 Data Penerima Manfaat — {MONTHS_FULL[bulan]} {tahun}</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-800 text-white text-xs uppercase tracking-wider">
                                                <th className="py-2.5 px-3 text-left">No</th>
                                                <th className="py-2.5 px-3 text-left">Sekolah</th>
                                                <th className="py-2.5 px-3 text-left">Tipe Alokasi</th>
                                                <th className="py-2.5 px-3 text-left">Jenis Penerima</th>
                                                <th className="py-2.5 px-3 text-right">Porsi Target/Hari</th>
                                                <th className="py-2.5 px-3 text-right">Total Terkirim</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calendarData.beneficiaries.map((b, idx) => {
                                                // Calculate total delivered for this school
                                                const totalDelivered = calendarData.days.reduce((sum, day) => {
                                                    const schoolDel = day.deliveries.find(d => d.school_name === b.school_name);
                                                    return sum + (schoolDel?.portions_sent || 0);
                                                }, 0);
                                                return (
                                                    <tr key={idx} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                                                        <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                                                        <td className="py-2 px-3 font-semibold text-gray-800">{b.school_name}</td>
                                                        <td className="py-2 px-3 text-gray-600">{b.school_level === "paud_tk" ? "Rp 8.000 (PAUD/TK)" : "Rp 10.000 (SD/SMP/SMA)"}</td>
                                                        <td className="py-2 px-3 text-gray-600">{b.beneficiary_type}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold">{b.target_portions}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">{totalDelivered.toLocaleString("id-ID")}</td>
                                                    </tr>
                                                );
                                            })}
                                            {calendarData.beneficiaries.length === 0 && (
                                                <tr><td colSpan={6} className="py-6 text-center text-gray-400 italic">Belum ada data penerima manfaat. Konfigurasi di menu Settings → Penerima Manfaat</td></tr>
                                            )}
                                        </tbody>
                                        {calendarData.beneficiaries.length > 0 && (
                                            <tfoot>
                                                <tr className="bg-slate-800 text-white font-bold">
                                                    <td className="py-2 px-3" colSpan={4}>TOTAL</td>
                                                    <td className="py-2 px-3 text-right">{calendarData.beneficiaries.reduce((s, b) => s + b.target_portions, 0)}</td>
                                                    <td className="py-2 px-3 text-right">{calendarData.monthly_summary.total_portions.toLocaleString("id-ID")}</td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
