"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import {
    ShieldCheck,
    Thermometer,
    FlaskConical,
    UtensilsCrossed,
    AlertTriangle,
    FileCheck,
    Plus,
    X,
    CheckCircle2,
    Clock,
    MapPin,
    Users,
    Syringe,
    ChevronDown,
    ExternalLink,
    Star,
    Sparkles,
    Calendar
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Tab = "hygiene" | "temperature" | "samples" | "waste" | "incidents" | "slhs";

const TABS: { key: Tab; label: string; desc: string; icon: any; activeClass: string; badgeColor: string }[] = [
    { key: "hygiene",     label: "Higiene Dapur",   desc: "Checklist Sanitasi",       icon: ShieldCheck,     activeClass: "bg-emerald-600 text-white shadow-md shadow-emerald-500/25", badgeColor: "emerald" },
    { key: "temperature", label: "Monitoring Suhu", desc: "Chiller & Freezer",        icon: Thermometer,     activeClass: "bg-cyan-600 text-white shadow-md shadow-cyan-500/25",       badgeColor: "cyan" },
    { key: "samples",     label: "Bank Sampel",     desc: "Uji Organoleptik 24-48 Jam", icon: FlaskConical,    activeClass: "bg-blue-600 text-white shadow-md shadow-blue-500/25",   badgeColor: "blue" },
    { key: "waste",       label: "Sisa Makanan",    desc: "Metode Comstock Siswa",    icon: UtensilsCrossed, activeClass: "bg-amber-600 text-white shadow-md shadow-amber-500/25",     badgeColor: "amber" },
    { key: "incidents",   label: "Log Insiden",     desc: "Tanggap Darurat Medis",    icon: AlertTriangle,   activeClass: "bg-rose-600 text-white shadow-md shadow-rose-500/25",       badgeColor: "rose" },
    { key: "slhs",        label: "Sertifikasi SLHS",desc: "Dokumen Dinkes & Laik",    icon: FileCheck,       activeClass: "bg-blue-600 text-white shadow-md shadow-blue-500/25",   badgeColor: "blue" },
];

const HYGIENE_AREAS = [
    "Kebersihan Lantai & Dinding",
    "Suhu Penyimpanan (Chiller/Freezer)",
    "Kebersihan Peralatan Masak",
    "Atribut Personel (Masker/Apron/Hairnet)",
    "Kualitas Air Bersih",
    "Kebersihan Area Penyimpanan",
    "Kondisi Tempat Sampah",
];

const TEMP_AREAS = ["gudang_kering", "chiller", "freezer"] as const;
const TEMP_LIMITS: Record<string, { min: number; max: number }> = {
    gudang_kering: { min: 0, max: 25 },
    chiller: { min: 0, max: 5 },
    freezer: { min: -30, max: -18 },
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
};

/* ─── Shared UI Components ─── */
const GlassInput = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
        <input {...props} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
    </div>
);

const GlassSelect = ({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
        <select {...props} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
            {children}
        </select>
    </div>
);

const SectionCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white/85 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] overflow-hidden ${className}`}>
        {children}
    </div>
);

const SectionHeader = ({ icon: Icon, title, actions }: { icon: any; title: string; actions?: React.ReactNode }) => (
    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 border border-blue-200/60 rounded-xl flex items-center justify-center text-blue-600">
                <Icon className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">{title}</h2>
        </div>
        {actions}
    </div>
);

const SaveBtn = ({ onClick, disabled, saving, label = "Simpan", colorClass = "bg-emerald-600 hover:bg-emerald-700" }: { onClick: () => void; disabled?: boolean; saving: boolean; label?: string; colorClass?: string }) => (
    <button onClick={onClick} disabled={disabled || saving}
        className={`w-full py-2.5 ${colorClass} text-white rounded-xl text-sm font-bold shadow-sm hover:shadow-md disabled:opacity-50 transition-all cursor-pointer`}>
        {saving ? "Menyimpan Data..." : label}
    </button>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function CompliancePage() {
    const [tab, setTab] = useState<Tab>("hygiene");
    const [alertCounts, setAlertCounts] = useState({ temp: 0, sample: 0, incident: 0 });

    useEffect(() => {
        const now = new Date();
        Promise.allSettled([
            apiGet("/compliance/temperature", { log_date: today() }),
            apiGet("/compliance/food-samples"),
            apiGet("/compliance/incidents", { month: now.getMonth() + 1, year: now.getFullYear() }),
        ]).then(([tempR, smpR, incR]) => {
            setAlertCounts({
                temp: tempR.status === "fulfilled" ? (tempR.value?.anomalies ?? 0) : 0,
                sample: smpR.status === "fulfilled" ? (smpR.value?.alerts_count ?? 0) : 0,
                incident: incR.status === "fulfilled" ? (incR.value?.data?.filter((i: any) => i.status === "investigasi")?.length ?? 0) : 0,
            });
        });
    }, []);

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-20">
            {/* Header */}
            <div className="pt-1">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                        Standar Mutu & Higienitas MBG
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-500">Audit Kelaikan BGN</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    Operasional, Sanitasi & Compliance
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">
                    Pantau standar higienitas dapur, uji suhu penyimpanan bahan, bank sampel makanan, dan kepatuhan SLHS harian.
                </p>
            </div>

            {/* Alert Banner */}
            {(alertCounts.temp + alertCounts.incident) > 0 && (
                <div className="bg-rose-50/90 border border-rose-200/90 rounded-2xl p-4 text-sm space-y-1.5 shadow-xs text-rose-900">
                    {alertCounts.temp > 0 && (
                        <p className="flex items-center gap-2 font-bold text-rose-800">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            {alertCounts.temp} anomali suhu terdeteksi pada penyimpanan hari ini!
                        </p>
                    )}
                    {alertCounts.incident > 0 && (
                        <p className="flex items-center gap-2 font-semibold text-rose-700">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                            {alertCounts.incident} insiden operasional sedang dalam investigasi aktif.
                        </p>
                    )}
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="sticky top-0 z-20 pt-1 pb-2 backdrop-blur-md">
                <div className="flex gap-2.5 bg-white/85 backdrop-blur-xl rounded-2xl p-2 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar">
                    {TABS.map((t) => {
                        const active = tab === t.key;
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                                    active
                                        ? t.activeClass
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                                }`}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                }`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <div>{t.label}</div>
                                    <div className={`text-xs font-normal hidden sm:block ${active ? "text-white/80" : "text-slate-400"}`}>
                                        {t.desc}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div className="transition-all duration-200">
                {tab === "hygiene" && <HygieneTab />}
                {tab === "temperature" && <TemperatureTab />}
                {tab === "samples" && <SamplesTab />}
                {tab === "waste" && <WasteTab />}
                {tab === "incidents" && <IncidentsTab />}
                {tab === "slhs" && <SLHSTab />}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 1: Hygiene
   ═══════════════════════════════════════════════════════════════════════════ */
function HygieneTab() {
    const [checks, setChecks] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [items, setItems] = useState(HYGIENE_AREAS.map((a) => ({ area: a, status: "baik", catatan: "" })));
    const [checkDate, setCheckDate] = useState(today());
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const now = new Date();
        apiGet("/compliance/hygiene", { month: now.getMonth() + 1, year: now.getFullYear() })
            .then((d) => setChecks(d?.data || []))
            .catch(() => {});
    }, []);

    const submit = async () => {
        setLoading(true);
        try {
            const res = await apiPost("/compliance/hygiene", { check_date: checkDate, items, notes });
            setChecks([res.data, ...checks]);
            setShowForm(false);
            setItems(HYGIENE_AREAS.map((a) => ({ area: a, status: "baik", catatan: "" })));
            setNotes("");
        } catch { }
        setLoading(false);
    };

    const statusBadge = (s: string) => {
        if (s === "baik") return <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">✓ Standar Baik</span>;
        if (s === "perlu_perbaikan") return <span className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200 font-bold">⚠ Perlu Perbaikan</span>;
        return <span className="px-2.5 py-1 rounded-full text-xs bg-rose-50 text-rose-700 border border-rose-200 font-bold">✗ Tidak Layak</span>;
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Checklist Higiene Dapur</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Pemeriksaan harian sanitasi area dapur dan atribut kebersihan personel.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className={`text-xs px-4 py-2.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${showForm ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20"}`}>
                    {showForm ? <><X className="w-3.5 h-3.5" /> Batal</> : <><Plus className="w-3.5 h-3.5" /> Checklist Baru</>}
                </button>
            </div>

            {showForm && (
                <SectionCard>
                    <div className="p-6 space-y-4">
                        <GlassInput label="Tanggal Pemeriksaan" type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
                        <div className="space-y-3 pt-2">
                            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">Item Penilaian Higienitas</label>
                            {items.map((item, idx) => (
                                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                                    <p className="text-sm font-bold text-slate-900">{item.area}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <GlassSelect label="Kondisi Fisik" value={item.status} onChange={(e) => { const n = [...items]; n[idx].status = e.target.value; setItems(n); }}>
                                            <option value="baik">✓ Memenuhi Standar (Baik)</option>
                                            <option value="perlu_perbaikan">⚠ Perlu Perbaikan</option>
                                            <option value="tidak_layak">✗ Tidak Layak</option>
                                        </GlassSelect>
                                        <GlassInput label="Catatan Tambahan (opsional)" placeholder="Catatan kebersihan..." value={item.catatan}
                                            onChange={(e) => { const n = [...items]; n[idx].catatan = e.target.value; setItems(n); }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <GlassInput label="Catatan Umum Supervisor" placeholder="Evaluasi harian kebersihan dapur..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                        <SaveBtn onClick={submit} saving={loading} label="Simpan Checklist Higiene" />
                    </div>
                </SectionCard>
            )}

            <div className="grid gap-4">
                {checks.map((c) => (
                    <SectionCard key={c.id}>
                        <div className="p-5 sm:p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="font-extrabold text-slate-900 text-base">{fmtDate(c.check_date)}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Inspeksi Harian Dapur MBG</p>
                                </div>
                                {statusBadge(c.overall_status)}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {(c.items || []).map((item: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-xs sm:text-sm border border-slate-200/60">
                                        <span>{item.status === "baik" ? "✅" : "⚠️"}</span>
                                        <span className="truncate font-medium text-slate-800">{item.area}</span>
                                    </div>
                                ))}
                            </div>
                            {c.notes && (
                                <p className="mt-3 text-xs sm:text-sm text-cyan-900 bg-cyan-50 border border-cyan-200 p-3 rounded-xl font-medium">
                                    📝 <strong>Catatan:</strong> {c.notes}
                                </p>
                            )}
                        </div>
                    </SectionCard>
                ))}

                {checks.length === 0 && (
                    <div className="bg-white/85 p-12 text-center rounded-3xl border border-slate-200/80 text-slate-400 text-sm">
                        <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        Belum ada riwayat checklist higiene untuk bulan ini.
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2: Temperature
   ═══════════════════════════════════════════════════════════════════════════ */
function TemperatureTab() {
    const [logs, setLogs] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ log_date: today(), log_time: "08:00", area: "chiller", temperature: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        apiGet("/compliance/temperature", { log_date: today() })
            .then((d) => setLogs(d?.data || []))
            .catch(() => {});
    }, []);

    const submit = async () => {
        setLoading(true);
        try {
            const res = await apiPost("/compliance/temperature", { ...form, temperature: parseFloat(form.temperature) });
            setLogs([res.data, ...logs]);
            setShowForm(false);
            setForm({ log_date: today(), log_time: "08:00", area: "chiller", temperature: "" });
        } catch { }
        setLoading(false);
    };

    const anomalies = logs.filter((l) => !l.is_normal);

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Monitoring Suhu Penyimpanan</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Pastikan chiller dan freezer berada dalam rentang aman standar pangan BGN.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className={`text-xs px-4 py-2.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${showForm ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-600/20"}`}>
                    {showForm ? <><X className="w-3.5 h-3.5" /> Batal</> : <><Plus className="w-3.5 h-3.5" /> Catat Suhu</>}
                </button>
            </div>

            {showForm && (
                <SectionCard>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <GlassInput label="Tanggal" type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} />
                            <GlassInput label="Jam Pengukuran" type="time" value={form.log_time} onChange={(e) => setForm({ ...form, log_time: e.target.value })} />
                        </div>
                        <GlassSelect label="Area Penyimpanan" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                            {TEMP_AREAS.map((a) => <option key={a} value={a}>{a.toUpperCase()} ({TEMP_LIMITS[a].min}°C s/d {TEMP_LIMITS[a].max}°C)</option>)}
                        </GlassSelect>
                        <GlassInput label="Suhu Terukur (°C)" type="number" step="0.1" placeholder="Contoh: 3.5" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
                        <SaveBtn onClick={submit} saving={loading} label="Simpan Catatan Suhu" colorClass="from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500" />
                    </div>
                </SectionCard>
            )}

            {anomalies.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-xs">
                    <h3 className="font-bold text-rose-800 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" /> Peringatan Anomali Suhu Terdeteksi
                    </h3>
                    <ul className="text-xs sm:text-sm text-rose-700 space-y-1">
                        {anomalies.map((a, i) => <li key={i}>• {a.area.toUpperCase()}: <strong>{a.temperature}°C</strong> pada jam {a.log_time} (di luar ambang batas standar)</li>)}
                    </ul>
                </div>
            )}

            <SectionCard>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3.5">Jam Pengukuran</th>
                                <th className="px-4 py-3.5">Area Fasilitas</th>
                                <th className="px-4 py-3.5 text-right">Suhu (°C)</th>
                                <th className="px-4 py-3.5 text-center">Kondisi Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-slate-700">{l.log_time}</td>
                                    <td className="px-4 py-3 text-slate-900 font-bold uppercase">{l.area}</td>
                                    <td className="text-right px-4 py-3 font-mono font-bold text-slate-900">{l.temperature}°C</td>
                                    <td className="text-center px-4 py-3">
                                        {l.is_normal ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Normal
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Anomali
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {logs.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Belum ada catatan log suhu hari ini.</p>}
            </SectionCard>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 3: Food Samples
   ═══════════════════════════════════════════════════════════════════════════ */
function SamplesTab() {
    const [samples, setSamples] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ sample_date: today(), menu_name: "", taken_at: "08:00", weight_gram: 50, storage_temp: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        apiGet("/compliance/food-samples")
            .then((d) => { setSamples(d?.data || []); setAlerts(d?.alerts || []); })
            .catch(() => {});
    }, []);

    const submit = async () => {
        setLoading(true);
        try {
            const res = await apiPost("/compliance/food-samples", {
                ...form, weight_gram: parseFloat(String(form.weight_gram)),
                storage_temp: form.storage_temp ? parseFloat(form.storage_temp) : null
            });
            setSamples([res.data, ...samples]);
            setShowForm(false);
        } catch { }
        setLoading(false);
    };

    const dispose = async (id: string) => {
        try {
            await apiPatch(`/compliance/food-samples/${id}/dispose`, { reason: "normal_disposal" });
            setSamples(samples.map((s) => s.id === id ? { ...s, status: "dibuang" } : s));
        } catch { }
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Bank Sampel Makanan Siap Santap</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Penyimpanan sampel hidangan harian selama 24-48 jam untuk jaminan mutu dan keamanan.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className={`text-xs px-4 py-2.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${showForm ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm border-blue-600"}`}>
                    {showForm ? <><X className="w-3.5 h-3.5" /> Batal</> : <><Plus className="w-3.5 h-3.5" /> Ambil Sampel</>}
                </button>
            </div>

            {showForm && (
                <SectionCard>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <GlassInput label="Tanggal Pengambilan" type="date" value={form.sample_date} onChange={(e) => setForm({ ...form, sample_date: e.target.value })} />
                            <GlassInput label="Jam Pengambilan" type="time" value={form.taken_at} onChange={(e) => setForm({ ...form, taken_at: e.target.value })} />
                        </div>
                        <GlassInput label="Nama Menu Hidangan" placeholder="Contoh: Sayur Sop Ayam Bakar Madu" value={form.menu_name} onChange={(e) => setForm({ ...form, menu_name: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                            <GlassInput label="Berat Sampel (gram)" type="number" value={String(form.weight_gram)} onChange={(e) => setForm({ ...form, weight_gram: parseFloat(e.target.value) })} />
                            <GlassInput label="Suhu Freezer Sampel (°C, opsional)" type="number" step="0.1" value={form.storage_temp} onChange={(e) => setForm({ ...form, storage_temp: e.target.value })} />
                        </div>
                        <SaveBtn onClick={submit} saving={loading} label="Simpan ke Bank Sampel" colorClass="bg-blue-600 hover:bg-blue-700" />
                    </div>
                </SectionCard>
            )}

            <div className="grid gap-3">
                {samples.map((s) => (
                    <SectionCard key={s.id} className={s.status === "dibuang" ? "opacity-60 bg-slate-50" : ""}>
                        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-900 text-base">{s.sample_code}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-600">
                                        {s.weight_gram} gram
                                    </span>
                                </div>
                                <p className="text-sm font-bold text-blue-700 mt-0.5">{s.menu_name}</p>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Waktu Ambil: {fmtDate(s.sample_date)} jam {s.taken_at}
                                </p>
                            </div>
                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                    s.hours_remaining && s.hours_remaining > 4 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : s.hours_remaining && s.hours_remaining > 0 ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>
                                    {s.hours_remaining ? (s.hours_remaining > 0 ? `⏱ Sisa ${s.hours_remaining.toFixed(1)} Jam` : "❌ Kedaluwarsa") : s.status}
                                </span>
                                {s.status === "disimpan" && (
                                    <button onClick={() => dispose(s.id)} className="text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors cursor-pointer">
                                        🗑️ Musnahkan Sampel
                                    </button>
                                )}
                            </div>
                        </div>
                    </SectionCard>
                ))}
                {samples.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Belum ada sampel tersimpan di bank sampel.</p>}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 4: Food Waste
   ═══════════════════════════════════════════════════════════════════════════ */
function WasteTab() {
    const [reports, setReports] = useState<any[]>([]);
    const [targets, setTargets] = useState<any[]>([]);
    const [targetDate, setTargetDate] = useState(today());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
    const [form, setForm] = useState({ portions_consumed: "", comstock_score: 3, waste_reason: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        apiGet("/compliance/food-waste", { month, year })
            .then((d) => setReports(d?.data || []))
            .catch(() => {});
    }, [month, year]);

    useEffect(() => {
        apiGet("/compliance/food-waste-targets", { target_date: targetDate })
            .then((d) => setTargets(d?.data || []))
            .catch(() => {});
    }, [targetDate]);

    const submit = async (target: any) => {
        setLoading(true);
        try {
            const res = await apiPost("/compliance/food-waste", {
                school_id: target.school_id,
                report_date: targetDate,
                portions_sent: target.portions_sent,
                portions_consumed: parseInt(form.portions_consumed),
                comstock_score: form.comstock_score,
                waste_reason: form.waste_reason,
            });
            setTargets(targets.map(t => t.school_id === target.school_id ? { ...t, is_reported: true, report_id: res.data.id } : t));
            setReports([{ ...res.data, schools: { name: target.school_name } }, ...reports]);
            setActiveSchoolId(null);
            setForm({ portions_consumed: "", comstock_score: 3, waste_reason: "" });
        } catch (e: any) {
            alert(e.response?.data?.detail || "Gagal menyimpan laporan sisa makanan.");
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            {/* Input Section */}
            <SectionCard>
                <div className="p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Input Laporan Sisa Makanan (Comstock)</h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Pilih sekolah sasaran untuk mencatat daya konsumsi siswa.</p>
                        </div>
                        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {targets.map(t => (
                            <div key={t.school_id} className={`border rounded-2xl p-4 flex flex-col transition-all ${t.is_reported ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-slate-200/80 shadow-xs"}`}>
                                <div className="mb-2">
                                    <h3 className="font-bold text-slate-900 truncate text-sm">{t.school_name}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-1">{t.menu_name || "Menu reguler"}</p>
                                    <div className="text-xs text-slate-600 mt-1.5 font-medium">Kirim: <span className="font-bold text-slate-900">{t.portions_sent} porsi</span></div>
                                </div>

                                <div className="mt-auto pt-3">
                                    {t.is_reported ? (
                                        <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sudah Dilaporkan
                                        </div>
                                    ) : activeSchoolId === t.school_id ? (
                                        <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                            <GlassInput label="Porsi Dikonsumsi" type="number" placeholder="Contoh: 90" value={form.portions_consumed} onChange={(e) => setForm({ ...form, portions_consumed: e.target.value })} />
                                            <GlassSelect label="Skor Visual Comstock" value={String(form.comstock_score)}
                                                onChange={(e) => {
                                                    const score = +e.target.value;
                                                    let sisa_pct = 0;
                                                    if (score === 1) sisa_pct = 0;
                                                    else if (score === 2) sisa_pct = 0.125;
                                                    else if (score === 3) sisa_pct = 0.375;
                                                    else if (score === 4) sisa_pct = 0.625;
                                                    else if (score === 5) sisa_pct = 0.875;
                                                    const consumed = Math.round(t.portions_sent * (1 - sisa_pct));
                                                    setForm({ ...form, comstock_score: score, portions_consumed: consumed.toString() });
                                                }}>
                                                <option value={1}>1 ⭐ Habis Total (0% sisa)</option>
                                                <option value={2}>2 ⭐ Sisa Sedikit (&lt;25%)</option>
                                                <option value={3}>3 ⭐ Sisa Sedang (25-50%)</option>
                                                <option value={4}>4 ⭐ Sisa Banyak (50-75%)</option>
                                                <option value={5}>5 ⭐ Hampir Utuh (&gt;75%)</option>
                                            </GlassSelect>
                                            <GlassInput label="Alasan Sisa Makanan" placeholder="Contoh: Lauk pedas, porsi terlalu kenyang" value={form.waste_reason} onChange={(e) => setForm({ ...form, waste_reason: e.target.value })} />
                                            <div className="flex gap-2 pt-1">
                                                <button onClick={() => setActiveSchoolId(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer">Batal</button>
                                                <button onClick={() => submit(t)} disabled={loading} className="flex-1 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-500 shadow-xs transition-all cursor-pointer">Kirim</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => { setActiveSchoolId(t.school_id); setForm({ portions_consumed: t.portions_sent.toString(), comstock_score: 1, waste_reason: "" }); }}
                                            className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold border border-amber-200 transition-all cursor-pointer">
                                            📝 Laporkan Sisa Makanan
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {targets.length === 0 && (
                            <div className="col-span-full py-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-sm">
                                Tidak ada jadwal pengiriman sekolah untuk tanggal ini.
                            </div>
                        )}
                    </div>
                </div>
            </SectionCard>

            {/* Monthly History */}
            <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-slate-900">Riwayat Laporan Bulanan</h2>
                <div className="flex gap-2 items-center text-xs">
                    <select value={month} onChange={(e) => setMonth(+e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none cursor-pointer">
                        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i).toLocaleDateString("id-ID", { month: "long" })}</option>)}
                    </select>
                    <select value={year} onChange={(e) => setYear(+e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none cursor-pointer">
                        <option value={2025}>2025</option><option value={2026}>2026</option>
                    </select>
                </div>
            </div>

            <SectionCard>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3.5">Tanggal</th>
                                <th className="px-4 py-3.5">Sekolah Binaan</th>
                                <th className="px-4 py-3.5 text-right">Kirim</th>
                                <th className="px-4 py-3.5 text-right">Konsumsi</th>
                                <th className="px-4 py-3.5 text-right">Sisa</th>
                                <th className="px-4 py-3.5 text-right">% Sisa</th>
                                <th className="px-4 py-3.5 text-center">Skor Comstock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reports.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">{fmtDate(r.report_date)}</td>
                                    <td className="px-4 py-3 font-bold text-slate-900">{r.schools?.name || r.school_id}</td>
                                    <td className="text-right px-4 py-3 text-slate-700">{r.portions_sent}</td>
                                    <td className="text-right px-4 py-3 font-bold text-slate-900">{r.portions_consumed}</td>
                                    <td className="text-right px-4 py-3 text-amber-700 font-bold">{Math.max(0, r.portions_sent - r.portions_consumed)}</td>
                                    <td className="text-right px-4 py-3">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${r.waste_pct > 20 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                                            {r.waste_pct}%
                                        </span>
                                    </td>
                                    <td className="text-center px-4 py-3"><span className="text-base" title={`Skor ${r.comstock_score}`}>{"⭐".repeat(r.comstock_score)}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {reports.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Belum ada riwayat laporan sisa makanan untuk bulan ini.</p>}
                </div>
            </SectionCard>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 5: Incidents
   ═══════════════════════════════════════════════════════════════════════════ */
function IncidentsTab() {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ school_id: "", incident_time: new Date().toISOString().substring(0, 16), location: "", victim_count: "", symptoms: [""], first_action: "", sample_secured: false });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const now = new Date();
        apiGet("/compliance/incidents", { month: now.getMonth() + 1, year: now.getFullYear() })
            .then((d) => setIncidents(d?.data || []))
            .catch(() => {});
    }, []);

    const submit = async () => {
        setLoading(true);
        try {
            const res = await apiPost("/compliance/incidents", {
                ...form,
                victim_count: parseInt(form.victim_count),
                symptoms: form.symptoms.filter(Boolean),
            });
            setIncidents([res.data, ...incidents]);
            setShowForm(false);
        } catch { }
        setLoading(false);
    };

    const pending = incidents.filter((i) => i.status === "investigasi").length;

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Manajemen Insiden & Tanggap Darurat</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Pencatatan cepat kejadian tidak diinginkan (KLB, keracunan, alergi) untuk investigasi resmi BGN.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className={`text-xs px-4 py-2.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${showForm ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-md shadow-rose-600/20"}`}>
                    {showForm ? <><X className="w-3.5 h-3.5" /> Batal</> : <><Plus className="w-3.5 h-3.5" /> Laporkan Insiden</>}
                </button>
            </div>

            {showForm && (
                <SectionCard>
                    <div className="p-6 space-y-4">
                        <GlassInput label="ID Sekolah / Lokasi (opsional)" placeholder="Contoh: SDN 01 Rawamangun" value={form.school_id} onChange={(e) => setForm({ ...form, school_id: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                            <GlassInput label="Waktu Kejadian" type="datetime-local" value={form.incident_time} onChange={(e) => setForm({ ...form, incident_time: e.target.value })} />
                            <GlassInput label="Perkiraan Jumlah Korban" type="number" placeholder="Contoh: 3" value={form.victim_count} onChange={(e) => setForm({ ...form, victim_count: e.target.value })} />
                        </div>
                        <GlassInput label="Lokasi Spesifik" placeholder="Ruang kelas, UKS, kantin..." value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gejala yang Timbul</label>
                            {form.symptoms.map((s, idx) => (
                                <input key={idx} placeholder="Contoh: mual, muntah, pusing, diare" value={s}
                                    onChange={(e) => { const n = [...form.symptoms]; n[idx] = e.target.value; setForm({ ...form, symptoms: n }); }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 mb-2" />
                            ))}
                            <button onClick={() => setForm({ ...form, symptoms: [...form.symptoms, ""] })} className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer">
                                <Plus className="w-3.5 h-3.5" /> Tambah gejala lain
                            </button>
                        </div>
                        <GlassInput label="Tindakan Pertolongan Pertama" placeholder="Dibawa ke Puskesmas terdekat, minum air kelapa..." value={form.first_action} onChange={(e) => setForm({ ...form, first_action: e.target.value })} />
                        <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer pt-1">
                            <input type="checkbox" checked={form.sample_secured} onChange={(e) => setForm({ ...form, sample_secured: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                            Sampel makanan dan muntahan telah diamankan di chiller/freezer
                        </label>
                        <SaveBtn onClick={submit} saving={loading} label="Kirim Laporan Insiden" colorClass="from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500" />
                    </div>
                </SectionCard>
            )}

            {pending > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-xs">
                    <p className="font-bold text-rose-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" /> {pending} insiden saat ini memerlukan tindak lanjut investigasi laboratorium.
                    </p>
                </div>
            )}

            <div className="grid gap-3">
                {incidents.map((inc) => (
                    <SectionCard key={inc.id} className={inc.status === "investigasi" ? "border-rose-300 bg-rose-50/40" : ""}>
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="font-extrabold text-slate-900 text-base">{inc.incident_code}</p>
                                    <p className="text-xs text-slate-500 font-medium">{fmtDate((inc.incident_time || "").substring(0, 10))}</p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                    inc.status === "investigasi" ? "bg-rose-100 text-rose-800 border-rose-200"
                                    : inc.status === "selesai" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}>{inc.status.toUpperCase()}</span>
                            </div>
                            <div className="text-xs sm:text-sm space-y-1.5 text-slate-700 font-medium">
                                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> <strong className="text-slate-900">Lokasi:</strong> {inc.location}</p>
                                <p className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /> <strong className="text-slate-900">Korban:</strong> {inc.victim_count} orang</p>
                                <p className="flex items-center gap-2"><Syringe className="w-4 h-4 text-slate-400" /> <strong className="text-slate-900">Gejala:</strong> {(inc.symptoms || []).join(", ") || "—"}</p>
                                <p className="flex items-center gap-2"><FlaskConical className="w-4 h-4 text-slate-400" /> <strong className="text-slate-900">Sampel:</strong> {inc.sample_secured ? "✓ Telah Diamankan" : "✗ Belum"}</p>
                            </div>
                        </div>
                    </SectionCard>
                ))}
                {incidents.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Tidak ada laporan insiden tercatat.</p>}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 6: SLHS
   ═══════════════════════════════════════════════════════════════════════════ */
function SLHSTab() {
    const [docs, setDocs] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ cert_number: "", issued_date: "", expires_date: "", label_expires: "", file_url: "", notes: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        apiGet("/compliance/slhs").then((d) => setDocs(d?.data || [])).catch(() => {});
    }, []);

    const submit = async () => {
        setLoading(true);
        try {
            const body: any = { cert_number: form.cert_number, issued_date: form.issued_date, expires_date: form.expires_date };
            if (form.label_expires) body.label_expires = form.label_expires;
            if (form.file_url) body.file_url = form.file_url;
            if (form.notes) body.notes = form.notes;
            const res = await apiPost("/compliance/slhs", body);
            setDocs([res.data, ...docs]);
            setShowForm(false);
        } catch { }
        setLoading(false);
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Sertifikat Laik Higiene Sanitasi (SLHS)</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Pantau masa berlaku sertifikasi resmi dari Dinas Kesehatan / BGN.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className={`text-xs px-4 py-2.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${showForm ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm border-blue-600"}`}>
                    {showForm ? <><X className="w-3.5 h-3.5" /> Batal</> : <><Plus className="w-3.5 h-3.5" /> Sertifikat Baru</>}
                </button>
            </div>

            {showForm && (
                <SectionCard>
                    <div className="p-6 space-y-4">
                        <GlassInput label="Nomor Sertifikat SLHS" placeholder="Contoh: 440/123/SLHS-DINKES/2026" value={form.cert_number} onChange={(e) => setForm({ ...form, cert_number: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                            <GlassInput label="Tanggal Penerbitan" type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} />
                            <GlassInput label="Tanggal Kedaluwarsa" type="date" value={form.expires_date} onChange={(e) => setForm({ ...form, expires_date: e.target.value })} />
                        </div>
                        <GlassInput label="Tanggal Label Habis (opsional)" type="date" value={form.label_expires} onChange={(e) => setForm({ ...form, label_expires: e.target.value })} />
                        <GlassInput label="URL Dokumen / Scan PDF (opsional)" placeholder="https://..." value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} />
                        <GlassInput label="Catatan Tambahan (opsional)" placeholder="Catatan auditor Dinas Kesehatan..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        <SaveBtn onClick={submit} saving={loading} label="Simpan Dokumen SLHS" colorClass="bg-blue-600 hover:bg-blue-700" />
                    </div>
                </SectionCard>
            )}

            <div className="grid gap-3">
                {docs.map((s) => {
                    const daysLeft = s.days_until_expiry ?? Math.ceil((new Date(s.expires_date).getTime() - Date.now()) / 86400000);
                    const isExpiring = daysLeft <= 90;
                    return (
                        <SectionCard key={s.id} className={isExpiring ? "border-amber-300 bg-amber-50/30" : ""}>
                            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <p className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                                        <FileCheck className="w-5 h-5 text-blue-600" /> {s.cert_number}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                                        <span>Terbit: {fmtDate(s.issued_date)}</span>
                                        <span>•</span>
                                        <span>Kedaluwarsa: {fmtDate(s.expires_date)}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                        daysLeft <= 30
                                            ? "bg-rose-50 text-rose-700 border-rose-200"
                                            : daysLeft <= 90
                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${daysLeft <= 30 ? "bg-rose-500" : daysLeft <= 90 ? "bg-amber-500" : "bg-emerald-500"}`} />
                                        {daysLeft > 0 ? `Sisa ${daysLeft} Hari` : "Sudah Kedaluwarsa"}
                                    </span>
                                </div>
                            </div>
                        </SectionCard>
                    );
                })}
                {docs.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Belum ada berkas dokumen SLHS terdaftar.</p>}
            </div>
        </div>
    );
}
