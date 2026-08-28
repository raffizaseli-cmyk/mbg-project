"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { BaseModal } from "@/components/ui/BaseModal";
import Link from "next/link";

/* ─── Harga Part ─── */
function formatRp(val: number | string): string {
    const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
        .format(n).replace("IDR", "Rp");
}

interface PriceItem {
    product_id: string;
    product_name: string;
    unit: string;
    avg_price_30d: string;
    avg_price_90d: string;
    change_pct: number;
    trend: "naik" | "turun" | "stabil";
    cheapest_supplier: string;
    cheapest_price: string;
    last_purchase: string;
}

interface AISummary {
    summary?: string;
    alerts?: Array<{ level: string; bahan: string; pesan: string; rekomendasi: string }>;
    opportunities?: Array<{ bahan: string; pesan: string; estimasi_hemat: string }>;
}

function TrendBadge({ pct, trend }: { pct: number; trend: string }) {
    if (trend === "naik" && pct > 5) return (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">🔴 +{pct.toFixed(1)}%</span>
    );
    if (trend === "naik") return (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">🟡 +{pct.toFixed(1)}%</span>
    );
    if (trend === "turun") return (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">🟢 {pct.toFixed(1)}%</span>
    );
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">⚪ {pct.toFixed(1)}%</span>
    );
}

function HargaTab() {
    const router = useRouter();
    const [items, setItems] = useState<PriceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
    const [aiLoading, setAiLoading] = useState(true);

    useEffect(() => {
        apiGet("/price-tracking/overview").then(r => {
            setItems(r?.data?.items ?? []);
        }).catch(() => { }).finally(() => setLoading(false));

        apiGet("/price-tracking/ai-insights").then(r => {
            setAiSummary(r?.data ?? null);
        }).catch(() => { }).finally(() => setAiLoading(false));
    }, []);

    const highAlert = aiSummary?.alerts?.find(a => a.level === "high");

    return (
        <div className="space-y-5">

            {!aiLoading && (
                <div className={`rounded-xl p-4 border ${highAlert ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"}`}>
                    {highAlert ? (
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-red-800">🔴 Alert: {highAlert.pesan}</p>
                            {aiSummary?.summary && <p className="text-xs text-red-700">{aiSummary.summary}</p>}
                        </div>
                    ) : aiSummary?.summary ? (
                        <p className="text-sm text-blue-800">{aiSummary.summary}</p>
                    ) : (
                        <p className="text-sm text-blue-600">Analisis AI belum tersedia. Data muncul setelah ada transaksi terkonfirmasi.</p>
                    )}
                </div>
            )}

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden mt-2">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 space-y-2">
                        <p className="text-4xl">📊</p>
                        <p className="font-medium text-gray-600">Belum ada data harga</p>
                        <p className="text-sm">Data muncul setelah ada nota belanja yang dikonfirmasi.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {["Bahan", "Satuan", "Rata-rata 30 Hari", "Rata-rata 90 Hari", "Perubahan", "Trend", "Supplier Termurah", "Terakhir Beli"].map(h => (
                                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={item.product_id}
                                        onClick={() => router.push(`/insights/track/${item.product_id}`)}
                                        className={`border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                        <td className="px-4 py-2.5">
                                            <span className="font-medium text-blue-700 hover:underline">
                                                {item.product_name} →
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500">{item.unit}</td>
                                        <td className="px-4 py-2.5 font-semibold">{formatRp(item.avg_price_30d)}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{formatRp(item.avg_price_90d)}</td>
                                        <td className="px-4 py-2.5">
                                            <TrendBadge pct={item.change_pct} trend={item.trend} />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`text-xs font-medium ${item.trend === "naik" ? "text-red-600" : item.trend === "turun" ? "text-green-600" : "text-gray-500"}`}>
                                                {item.trend === "naik" ? "↗ Naik" : item.trend === "turun" ? "↘ Turun" : "→ Stabil"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-700">
                                            <span className="text-xs">{item.cheapest_supplier}</span>
                                            {parseFloat(item.cheapest_price) > 0 && (
                                                <span className="ml-1 text-green-700 text-xs">({formatRp(item.cheapest_price)})</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-400 text-xs">{item.last_purchase || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                            💡 Klik baris bahan untuk melihat grafik harga & perbandingan supplier
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Jadwal Part ─── */
interface TimelineEvent {
    id?: string;
    time: string;
    activity: string;
    school_id: string | null;
    school_name: string | null;
    type: "prep" | "cook" | "cook_done" | "depart" | "arrive" | string;
}

interface DaySchedule {
    date: string;
    day_name: string;
    is_holiday: boolean;
    holiday_name: string | null;
    menu_name?: string | null;
    menu_id?: string | null;
    has_menu?: boolean;
    timeline: TimelineEvent[];
    total_portions: number;
    cook_duration_minutes?: number;
    ai_notes?: string | null;
}

interface MasterSchool {
    school_id: string;
    school_name: string;
    default_portions: number;
    target_arrival: string;
    travel_minutes: number;
    delivery_window_minutes: number;
    depart_time: string;
    done_at_school: string;
}

interface MasterData {
    id: string;
    name: string;
    prep_start_time: string;
    cook_start_time: string;
    cook_end_time: string;
    cook_minutes_per_100: number;
    cook_duration_minutes: number;
    total_portions: number;
    schools: MasterSchool[];
}

interface WeekData {
    week_start: string;
    days: DaySchedule[];
    has_schedule?: boolean;
    source?: string;
    from_ai?: boolean;
    ai_notes?: string;
}

const eventIcon = (type: string) => {
    switch (type) {
        case "prep": return "🥬";
        case "cook": return "🍳";
        case "cook_done": return "✅";
        case "depart": return "🚗";
        case "arrive": return "📍";
        default: return "📋";
    }
};

const eventColor = (type: string) => {
    switch (type) {
        case "prep": return "border-l-4 border-l-green-400 bg-green-50/60";
        case "cook": return "border-l-4 border-l-orange-400 bg-orange-50/60";
        case "cook_done": return "border-l-4 border-l-emerald-400 bg-emerald-50/60";
        case "depart": return "border-l-4 border-l-blue-400 bg-blue-50/60";
        case "arrive": return "border-l-4 border-l-purple-400 bg-purple-50/60";
        default: return "border-l-4 border-l-gray-300 bg-gray-50/60";
    }
};

function formatDuration(m: number): string {
    if (!m || m <= 0) return "-";
    const h = Math.floor(m / 60);
    const mins = m % 60;
    if (h === 0) return `${mins}m`;
    return mins > 0 ? `${h}j ${mins}m` : `${h}j`;
}

function JadwalTab() {
    const [master, setMaster] = useState<MasterData | null>(null);
    const [weekData, setWeekData] = useState<WeekData | null>(null);
    const [draftData, setDraftData] = useState<WeekData | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [approving, setApproving] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);
    const [toast, setToast] = useState("");
    
    // States for Edit Day Feature
    const [editingDay, setEditingDay] = useState<DaySchedule | null>(null);
    const [editTimeline, setEditTimeline] = useState<TimelineEvent[]>([]);
    const [savingEdit, setSavingEdit] = useState(false);

    // States for Master Schedule Setup
    const [showMasterModal, setShowMasterModal] = useState(false);
    const [masterForm, setMasterForm] = useState<{ prep_start_time: string; cook_start_time: string; cook_minutes_per_100: number; schools: any[] }>({ prep_start_time: "05:00", cook_start_time: "06:00", cook_minutes_per_100: 30, schools: [] });
    const [savingMaster, setSavingMaster] = useState(false);

    const getMonday = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
        return d.toISOString().split("T")[0];
    };

    const fetchMaster = useCallback(async () => {
        try {
            const res = await apiGet("/schedules/master");
            setMaster(res?.data || null);
        } catch { setMaster(null); }
    }, []);

    const fetchWeek = useCallback(async (ws: string) => {
        try {
            const res = await apiGet(`/schedules/week?week_start=${ws}`);
            setWeekData(res?.data || null);
        } catch { setWeekData(null); }
    }, []);

    useEffect(() => {
        setLoading(true);
        const ws = getMonday(weekOffset);
        Promise.all([fetchMaster(), fetchWeek(ws)]).finally(() => setLoading(false));
    }, [weekOffset, fetchMaster, fetchWeek]);

    const handleLoadMaster = async () => {
        setGenerating(true);
        try {
            const ws = getMonday(weekOffset);
            const res = await apiPost("/schedules/load-master", { week_start: ws });
            setDraftData(res?.data || null);
            setToast("✅ Timeline dari master berhasil dimuat");
        } catch (e: any) {
            setToast("❌ " + (e?.message || "Gagal load master"));
        }
        setGenerating(false);
    };

    const handleSaveMaster = async () => {
        setSavingMaster(true);
        try {
            await apiPost("/schedules/master", {
                name: "Jadwal Utama MBG",
                prep_start_time: masterForm.prep_start_time,
                cook_start_time: masterForm.cook_start_time,
                cook_minutes_per_100: masterForm.cook_minutes_per_100,
                schools: masterForm.schools || []
            });
            setShowMasterModal(false);
            setToast("✅ Master Schedule berhasil dikonfigurasi!");
            fetchMaster();
        } catch (e: any) {
            setToast("❌ Gagal menyimpan: " + (e?.message || ""));
        }
        setSavingMaster(false);
    };

    const handleAiDraft = async () => {
        setGenerating(true);
        try {
            const ws = getMonday(weekOffset);
            const res = await apiGet(`/schedules/ai-draft?week_start=${ws}`);
            setDraftData(res?.data || null);
            setToast(res?.data?.from_ai ? "🤖 AI draft berhasil!" : "📋 Menggunakan master (AI tidak tersedia)");
        } catch (e: any) {
            setToast("❌ " + (e?.message || "Gagal generate"));
        }
        setGenerating(false);
    };

    const handleApprove = async () => {
        if (!draftData) return;
        setApproving(true);
        try {
            await apiPost("/schedules/approve-draft", {
                week_start: draftData.week_start,
                days: draftData.days,
            });
            setToast("✅ Jadwal berhasil di-approve!");
            setDraftData(null);
            fetchWeek(getMonday(weekOffset));
        } catch (e: any) {
            setToast("❌ " + (e?.message || "Gagal approve"));
        }
        setApproving(false);
    };

    const handleSaveEdit = async () => {
        if (!editingDay) return;
        setSavingEdit(true);
        if (draftData) {
             const newDays = draftData.days.map(d => {
                 if(d.date === editingDay.date) {
                     return { 
                         ...d, 
                         timeline: editTimeline
                     }
                 }
                 return d;
             });
             setDraftData({...draftData, days: newDays});
             setEditingDay(null);
             setToast(`✅ Draft timeline hari ${editingDay.day_name} diupdate`);
        } else {
             try {
                const updates = editTimeline.map(t => ({ id: t.id, time: t.time })).filter(u => u.id);
                if (updates.length > 0) {
                    await apiPost("/schedules/update-timeline", { updates });
                    setToast(`✅ Timeline hari ${editingDay.day_name} berhasil disimpan`);
                    fetchWeek(getMonday(weekOffset));
                } else {
                    setToast("✅ Tidak ada jadwal valid untuk diupdate (draft belum diapprove)");
                }
                setEditingDay(null);
             } catch (e: any) {
                setToast("❌ Gagal update timeline: " + (e?.message || ""));
             }
        }
        setSavingEdit(false);
    };

    const displayData = draftData || weekData;
    const isDraft = !!draftData;
    const hasSchedule = weekData?.has_schedule;

    if (loading) {
        return (
            <div className="p-6 flex justify-center items-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 max-w-sm animate-[fadeIn_0.3s]">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">{toast}</span>
                        <button onClick={() => setToast("")} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                </div>
            )}

            <div>
                <h1 className="text-2xl font-bold text-gray-800">📅 AI Jadwal Operasional</h1>
                <p className="text-gray-500 text-sm mt-1">Timeline harian: persiapan → masak → pengiriman</p>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6">
                {!master ? (
                    <div className="text-center py-4">
                        <p className="text-amber-600 font-semibold text-lg mb-2">⚠️ Master Schedule Belum Di-setup</p>
                        <p className="text-gray-500 text-sm mb-4">Setup jadwal waktu operasional sekali, dipakai otomatis tiap minggu</p>
                        <button onClick={() => setShowMasterModal(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 mx-auto transition shadow-sm">
                            ⚙️ Setup Terlebih Dahulu
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                                ✅ Jadwal Master Aktif
                            </h2>
                            <button onClick={() => {
                                setMasterForm({
                                    prep_start_time: master?.prep_start_time || "05:00",
                                    cook_start_time: master?.cook_start_time || "06:00",
                                    cook_minutes_per_100: master?.cook_minutes_per_100 || 30,
                                    schools: master?.schools || [],
                                });
                                setShowMasterModal(true);
                            }} className="text-sm px-3 py-1.5 border border-purple-200 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 font-medium">
                                ✏️ Edit
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="bg-green-50 rounded-xl p-3">
                                <span className="text-gray-500 text-xs">🥬 Persiapan</span>
                                <p className="font-bold text-lg">{master.prep_start_time}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-3">
                                <span className="text-gray-500 text-xs">🍳 Mulai Masak</span>
                                <p className="font-bold text-lg">{master.cook_start_time}</p>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-3">
                                <span className="text-gray-500 text-xs">✅ Selesai Masak</span>
                                <p className="font-bold text-lg">{master.cook_end_time}</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3">
                                <span className="text-gray-500 text-xs">📊 Total</span>
                                <p className="font-bold text-lg">{master.total_portions?.toLocaleString("id-ID")} porsi</p>
                            </div>
                        </div>
                        {master.schools.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                                {master.schools.map(s => (
                                    <div key={s.school_id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                                        <span>🚗</span>
                                        <span className="font-medium flex-shrink-0">{s.school_name}</span>
                                        <span className="text-gray-400">|</span>
                                        <span className="text-gray-600 text-xs">
                                            berangkat {s.depart_time} → tiba {s.target_arrival} → selesai {s.done_at_school}
                                        </span>
                                        <span className="text-xs text-gray-400 ml-auto">({s.default_portions} porsi)</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                {[0, 1].map(offset => (
                    <button key={offset}
                        onClick={() => { setWeekOffset(offset); setDraftData(null); }}
                        className={`px-4 py-2 rounded-xl font-medium text-sm transition ${weekOffset === offset ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                        {offset === 0 ? "Minggu Ini" : "Minggu Depan"}
                    </button>
                ))}
                <span className="text-sm text-gray-400 ml-auto">
                    {getMonday(weekOffset)} — {(() => {
                        const d = new Date(getMonday(weekOffset));
                        d.setDate(d.getDate() + 5);
                        return d.toISOString().split("T")[0];
                    })()}
                </span>
            </div>

            {isDraft && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-amber-800 text-sm font-medium">
                        📝 Draft belum disimpan — {draftData?.source === "ai" ? "dari AI" : "dari Master"}
                    </span>
                    <button onClick={handleApprove} disabled={approving}
                        className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                        {approving ? "Menyimpan..." : "✅ Approve"}
                    </button>
                </div>
            )}

            {!hasSchedule && !isDraft && (
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-white p-6 text-center">
                    <p className="text-gray-500 mb-4">Belum ada jadwal untuk {weekOffset === 0 ? "minggu ini" : "minggu depan"}</p>
                    <div className="flex justify-center gap-3 flex-wrap">
                        <button onClick={handleLoadMaster} disabled={generating || !master}
                            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                            {generating ? "⏳..." : "📋 Load dari Master"}
                        </button>
                        <button onClick={handleAiDraft} disabled={generating}
                            className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 transition">
                            {generating ? "⏳..." : "🤖 Generate AI Draft"}
                        </button>
                    </div>
                </div>
            )}

            {displayData && displayData.days && displayData.days.length > 0 && (
                <div className="space-y-4">
                    {displayData.days.map(day => (
                        <div key={day.date} className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] overflow-hidden border ${day.is_holiday ? "border-red-200" : "border-white"}`}>
                            <div className={`px-5 py-3 ${day.is_holiday ? "bg-red-50" : "bg-gradient-to-r from-blue-50 to-indigo-50/30"}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-bold text-gray-800">{day.day_name}</span>
                                        <span className="text-gray-500 text-sm ml-2">{day.date}</span>
                                        {day.is_holiday && <span className="ml-2 text-red-600 text-sm font-medium">🎌 {day.holiday_name}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!day.is_holiday && day.total_portions > 0 && (
                                            <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full text-sm">
                                                {day.total_portions.toLocaleString("id-ID")} porsi
                                            </span>
                                        )}
                                        {!day.is_holiday && (
                                            <button onClick={() => { setEditingDay(day); setEditTimeline([...day.timeline]); }} className="text-gray-400 hover:text-blue-600 bg-white shadow-sm border border-gray-100 px-2 py-1 rounded text-xs transition">
                                                ✏️ Edit Jam
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {!day.is_holiday && (
                                    <div className="mt-1">
                                        {day.has_menu && day.menu_name ? (
                                            <span className="text-sm text-indigo-700 font-medium">🍽️ Menu: {day.menu_name}</span>
                                        ) : (
                                            <span className="text-sm text-amber-600">⚠️ Menu belum diatur — set via Telegram /menu</span>
                                        )}
                                        {day.cook_duration_minutes && day.cook_duration_minutes > 0 && (
                                            <span className="text-xs text-gray-400 ml-3">⏱️ Estimasi masak: {formatDuration(day.cook_duration_minutes)}</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {day.is_holiday ? (
                                <div className="px-5 py-4 text-center text-gray-400 text-sm">Libur — tidak ada jadwal</div>
                            ) : day.timeline.length === 0 ? (
                                <div className="px-5 py-4 text-center text-gray-400 text-sm">Tidak ada kegiatan</div>
                            ) : (
                                <div className="px-4 py-3 space-y-1.5">
                                    {day.timeline.map((evt, idx) => (
                                        <div key={idx} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${eventColor(evt.type)}`}>
                                            <span className="text-lg">{eventIcon(evt.type)}</span>
                                            <span className="font-mono font-bold text-gray-700 w-14 text-sm">{evt.time}</span>
                                            <span className="text-sm text-gray-800 flex-1">{evt.activity}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {day.ai_notes && (
                                <div className="px-5 py-2 bg-yellow-50 border-t border-yellow-100 text-xs text-yellow-700">
                                    🤖 {day.ai_notes}
                                </div>
                            )}
                        </div>
                    ))}

                    {isDraft && (
                        <div className="text-center pt-2">
                            <button onClick={handleApprove} disabled={approving}
                                className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 shadow-lg transition">
                                {approving ? "⏳ Menyimpan..." : "✅ Approve Jadwal Minggu Ini"}
                            </button>
                        </div>
                    )}

                    {hasSchedule && !isDraft && (
                        <div className="flex justify-center gap-3 pt-2">
                            <button onClick={handleLoadMaster} disabled={generating || !master}
                                className="text-blue-600 border border-blue-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-50 disabled:opacity-50">
                                🔄 Regenerate dari Master
                            </button>
                            <button onClick={handleAiDraft} disabled={generating}
                                className="text-purple-600 border border-purple-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-50 disabled:opacity-50">
                                🤖 Regenerate AI Draft
                            </button>
                        </div>
                    )}
                </div>
            )}

            {displayData?.ai_notes && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-800">
                    🤖 <strong>Catatan AI:</strong> {displayData.ai_notes}
                </div>
            )}

            <BaseModal isOpen={!!editingDay} onClose={() => setEditingDay(null)} title="✏️ Edit Jam Operasional" maxWidth="max-w-lg">
                {editingDay && (
                    <>
                        <p className="text-gray-500 text-sm mb-4">{editingDay.day_name}, {editingDay.date}</p>
                        
                        <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {editTimeline.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center">Belum ada kegiatan untuk diedit</p>
                            ) : (
                                editTimeline.map((evt, idx) => (
                                    <div key={idx} className="flex gap-4 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                        <input type="time" 
                                            className="border-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 px-2 text-sm font-mono w-28 bg-gray-50"
                                            value={evt.time} 
                                            onChange={e => {
                                                const newT = [...editTimeline];
                                                newT[idx].time = e.target.value;
                                                setEditTimeline(newT);
                                            }} />
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-base leading-none">{eventIcon(evt.type)}</span>
                                            <span className="text-sm text-gray-700 font-medium truncate" title={evt.activity}>{evt.activity}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setEditingDay(null)} disabled={savingEdit} className="px-5 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl text-sm font-semibold transition">Batal</button>
                            <button onClick={handleSaveEdit} disabled={savingEdit || editTimeline.length === 0} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-md transition">
                                {savingEdit ? "Menyimpan..." : "Simpan Jadwal"}
                            </button>
                        </div>
                    </>
                )}
            </BaseModal>

            <BaseModal isOpen={showMasterModal} onClose={() => setShowMasterModal(false)} title="Konfigurasi Master Jadwal" maxWidth="max-w-md">
                        <p className="text-sm text-gray-500 mb-6">Waktu acuan ini akan dipakai AI sebagai titik tumpu (Baseline) setiap minggu beroperasi, sebelum mendistribusikan waktu porsi sekolah.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Mulai Persiapan Bahan (Prep)</label>
                                <input type="time" value={masterForm.prep_start_time} onChange={e => setMasterForm({ ...masterForm, prep_start_time: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Mulai Masak Eksekusi Panci (Cook)</label>
                                <input type="time" value={masterForm.cook_start_time} onChange={e => setMasterForm({ ...masterForm, cook_start_time: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Total Waktu masak / 100 Porsi (Menit)</label>
                                <input type="number" min={1} value={masterForm.cook_minutes_per_100} onChange={e => setMasterForm({ ...masterForm, cook_minutes_per_100: parseInt(e.target.value) || 30 })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50" />
                            </div>
                            <div className="pt-2">
                                <h4 className="text-sm font-bold text-gray-800 mb-2 border-b pb-2">Pengaturan Waktu Tiap Sekolah</h4>
                                {masterForm.schools?.length === 0 ? (
                                    <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100 italic">
                                        Data sekolah belum terkonfigurasi. Klik "Simpan Konfigurasi Master" pertama kali, sistem akan mengisi sekolah secara otomatis. Anda bisa ✏️ Edit lagi untuk mengatur waktu per-sekolah.
                                    </p>
                                ) : (
                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {masterForm.schools?.map((s, idx) => (
                                            <div key={s.school_id} className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
                                                <div className="font-semibold text-sm text-gray-800 mb-2 truncate" title={s.school_name}>{s.school_name}</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Target Tiba</label>
                                                        <input type="time" value={s.target_arrival}
                                                            onChange={e => {
                                                                const nw = [...(masterForm.schools || [])];
                                                                nw[idx].target_arrival = e.target.value;
                                                                setMasterForm({ ...masterForm, schools: nw });
                                                            }}
                                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Perjalanan (Min)</label>
                                                        <input type="number" min={5} value={s.travel_minutes}
                                                            onChange={e => {
                                                                const nw = [...(masterForm.schools || [])];
                                                                nw[idx].travel_minutes = parseInt(e.target.value) || 30;
                                                                setMasterForm({ ...masterForm, schools: nw });
                                                            }}
                                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5">
                            <button onClick={() => setShowMasterModal(false)} disabled={savingMaster} className="px-5 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold">Batal</button>
                            <button onClick={handleSaveMaster} disabled={savingMaster} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
                                {savingMaster ? "Menyimpan..." : "Simpan Konfigurasi Master"}
                            </button>
                        </div>
            </BaseModal>
        </div>
    );
}

/* ─── Layout Shell ─── */
function InsightsTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "harga";

    const setTab = (tab: string) => {
        router.push(`/insights?tab=${tab}`);
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-in mt-2">
            <PageHeader title="📈 Insights & AI Analisis" />

            <div className="border-b border-gray-200/50 sticky top-0 lg:-top-4 bg-gray-50/80 backdrop-blur-md z-10 pt-2 mb-2 mt-4">
                <div className="flex space-x-8 px-2">
                    <button
                        onClick={() => setTab("harga")}
                        className={`px-4 py-3 font-semibold border-b-[3px] transition-all duration-200 ${
                            activeTab === "harga" ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                        }`}
                    >
                        📈 Track Harga
                    </button>
                    <button
                        onClick={() => setTab("jadwal")}
                        className={`px-4 py-3 font-semibold border-b-[3px] transition-all duration-200 ${
                            activeTab === "jadwal" ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                        }`}
                    >
                        📅 AI Jadwal
                    </button>
                </div>
            </div>

            <div className="mt-4">
                {activeTab === "harga" && <HargaTab />}
                {activeTab === "jadwal" && <JadwalTab />}
            </div>
        </div>
    );
}

export default function InsightsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Memuat analisis data...</div>}>
            <InsightsTabs />
        </Suspense>
    );
}
