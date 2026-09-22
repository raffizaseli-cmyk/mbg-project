"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { BaseModal } from "@/components/ui/BaseModal";
import {
    Landmark, Banknote, TrendingDown, Wallet, UtensilsCrossed,
    ArrowRightLeft, Plus, Pencil, AlertTriangle, CheckCircle2,
    Search, Download, BookOpen, BarChart3, ChevronRight,
    CalendarDays, Receipt, CircleDollarSign, Undo2, PieChart
} from "lucide-react";

/* ─── Helpers ─── */
const fmtRp = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return "Rp 0";
    return "Rp " + Math.round(n).toLocaleString("id-ID");
};

const MONTHS = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/* ─── Shared Styled Input ─── */
const GlassInput = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
        <input {...props} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" />
    </div>
);

const GlassSelect = ({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
        <select {...props} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all">
            {children}
        </select>
    </div>
);

const GlassTextarea = ({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
        <textarea {...props} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" />
    </div>
);

/* ─── Types ─── */
interface JuknisBreakdown { realisasi: string; target: string; label: string; pct: number; over_budget: boolean; }
interface KasBalance { id: string; name: string; type: string; balance: string; }
interface Disbursement { id: string; date: string; amount: string; reference_number: string | null; notes: string | null; }

interface BudgetSummary {
    year: number; month: number; pagu_amount: string; total_disbursed: string;
    total_spent: string; sisa_anggaran: string; pct_terpakai: number; total_porsi: number;
    avg_harga_porsi: string; kas_balances: KasBalance[];
    juknis_breakdown: Record<string, JuknisBreakdown>;
    disbursements: Disbursement[]; fund_return: any;
}

/* ─── StatCard Component ─── */
function StatCard({ icon: Icon, label, value, accent }: {
    icon: any; label: string; value: string;
    accent: "amber" | "emerald" | "orange" | "slate" | "blue";
}) {
    const accentMap = {
        amber:   { bg: "bg-amber-50/80",   border: "border-amber-200/80",  iconBg: "bg-amber-100",  iconColor: "text-amber-700",  valColor: "text-amber-900" },
        emerald: { bg: "bg-emerald-50/80", border: "border-emerald-200/80",iconBg: "bg-emerald-100",iconColor: "text-emerald-700",valColor: "text-emerald-900" },
        orange:  { bg: "bg-orange-50/80",  border: "border-orange-200/80", iconBg: "bg-orange-100", iconColor: "text-orange-700", valColor: "text-orange-900" },
        slate:   { bg: "bg-slate-50/80",   border: "border-slate-200/80",  iconBg: "bg-slate-100",  iconColor: "text-slate-700",  valColor: "text-slate-900" },
        blue:    { bg: "bg-blue-50/80",    border: "border-blue-200/80",   iconBg: "bg-blue-100",   iconColor: "text-blue-700",   valColor: "text-blue-900" },
    };
    const a = accentMap[accent];
    return (
        <div className={`bg-white/85 backdrop-blur-xl rounded-2xl border ${a.border} p-5 shadow-xs hover:shadow-md transition-all duration-200`}>
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 ${a.iconBg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-4.5 h-4.5 ${a.iconColor}`} />
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-xl font-extrabold ${a.valColor}`}>{value}</p>
        </div>
    );
}

/* ─── Overview Tab ─── */
function OverviewTab() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [data, setData] = useState<BudgetSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const [ledger, setLedger] = useState<any[]>([]);
    const [activeKas, setActiveKas] = useState<string | null>(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    const [showPagu, setShowPagu] = useState(false);
    const [showCair, setShowCair] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [showReturn, setShowReturn] = useState(false);
    const [showKasModal, setShowKasModal] = useState(false);

    const [paguAmount, setPaguAmount] = useState("");
    const [paguNotes, setPaguNotes] = useState("");
    const [cairDate, setCairDate] = useState(now.toISOString().split("T")[0]);
    const [cairAmount, setCairAmount] = useState("");
    const [cairRef, setCairRef] = useState("");
    const [cairNotes, setCairNotes] = useState("");
    const [tfFrom, setTfFrom] = useState("");
    const [tfTo, setTfTo] = useState("");
    const [tfAmount, setTfAmount] = useState("");
    const [tfDate, setTfDate] = useState(now.toISOString().split("T")[0]);
    const [tfNotes, setTfNotes] = useState("");
    const [retAmount, setRetAmount] = useState("");
    const [retDate, setRetDate] = useState(now.toISOString().split("T")[0]);
    const [retRef, setRetRef] = useState("");
    const [kasName, setKasName] = useState("");
    const [kasType, setKasType] = useState("kas_kecil");
    const [kasBal, setKasBal] = useState("0");
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiGet(`/budget/summary?year=${year}&month=${month}`);
            setData(res?.data || null);
            if (res?.data?.kas_balances?.length > 0 && !activeKas) {
                setActiveKas(res.data.kas_balances[0].id);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [year, month, activeKas]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const fetchLedger = useCallback(async () => {
        if (!activeKas) return;
        setLedgerLoading(true);
        try {
            const startDate = new Date(year, month - 1, 1).toLocaleDateString('en-CA');
            const endDate = new Date(year, month, 0).toLocaleDateString('en-CA');
            const res = await apiGet(`/budget/ledger?kas_account_id=${activeKas}&start_date=${startDate}&end_date=${endDate}&limit=20`);
            setLedger(res?.data?.entries || []);
        } catch (e) { console.error(e); }
        setLedgerLoading(false);
    }, [year, month, activeKas]);

    useEffect(() => { fetchLedger(); }, [fetchLedger]);

    const savePagu = async () => {
        if (!paguAmount) return;
        setSaving(true);
        try {
            await apiPost("/budget/pagu", { year, month, pagu_amount: parseFloat(paguAmount), notes: paguNotes || null });
            setShowPagu(false); fetchData();
        } catch (e: any) { alert(e?.response?.data?.detail || "Gagal"); }
        setSaving(false);
    };

    const saveCair = async () => {
        if (!cairAmount) return;
        setSaving(true);
        try {
            await apiPost("/budget/disbursement", {
                year, month, disbursement_date: cairDate,
                amount: parseFloat(cairAmount),
                reference_number: cairRef || null, notes: cairNotes || null,
            });
            setShowCair(false); setCairAmount(""); setCairRef(""); setCairNotes(""); fetchData();
        } catch (e: any) { alert(e?.response?.data?.detail || "Gagal"); }
        setSaving(false);
    };

    const saveTransfer = async () => {
        if (!tfFrom || !tfTo || !tfAmount) return;
        setSaving(true);
        try {
            await apiPost("/budget/fund-transfer", {
                from_kas_account_id: tfFrom, to_kas_account_id: tfTo,
                amount: parseFloat(tfAmount), transfer_date: tfDate, notes: tfNotes || null,
            });
            setShowTransfer(false); setTfAmount(""); setTfNotes(""); fetchData();
        } catch (e: any) { alert(e?.response?.data?.detail || "Gagal"); }
        setSaving(false);
    };

    const saveReturn = async () => {
        if (!retAmount) return;
        setSaving(true);
        try {
            await apiPost("/budget/fund-return", {
                year, month, amount: parseFloat(retAmount),
                return_date: retDate, reference_number: retRef || null,
            });
            setShowReturn(false); setRetAmount(""); setRetRef(""); fetchData();
        } catch (e: any) { alert(e?.response?.data?.detail || "Gagal"); }
        setSaving(false);
    };

    const saveKas = async () => {
        if (!kasName) return;
        setSaving(true);
        try {
            await apiPost("/budget/kas-accounts", { name: kasName, type: kasType, initial_balance: parseFloat(kasBal) || 0 });
            setShowKasModal(false); setKasName(""); setKasBal("0"); fetchData();
        } catch (e: any) { alert(e?.response?.data?.detail || "Gagal"); }
        setSaving(false);
    };

    const sisa = data ? parseFloat(data.sisa_anggaran) : 0;
    const hasSisa = sisa > 0 && !data?.fund_return;

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Periode Anggaran:</span>
                    <span className="font-extrabold text-slate-900 text-sm">{MONTHS[month]} {year}</span>
                </div>
                <div className="flex gap-2.5">
                    <select value={month} onChange={e => setMonth(Number(e.target.value))}
                        className="bg-white/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs cursor-pointer">
                        {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))}
                        className="bg-white/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs cursor-pointer">
                        {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-[3px] border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
            ) : data ? (
                <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <StatCard icon={Landmark}          label="Pagu Anggaran" value={fmtRp(data.pagu_amount)}     accent="amber" />
                        <StatCard icon={Banknote}          label="Dana Cair"     value={fmtRp(data.total_disbursed)} accent="emerald" />
                        <StatCard icon={TrendingDown}      label="Total Terpakai" value={fmtRp(data.total_spent)}    accent="orange" />
                        <StatCard icon={Wallet}            label="Sisa Anggaran" value={fmtRp(data.sisa_anggaran)}   accent="slate" />
                        <StatCard icon={UtensilsCrossed}   label="Total Porsi"   value={data.total_porsi.toLocaleString("id-ID")} accent="blue" />
                    </div>

                    {/* Two Column: Pagu & Kas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Pagu & Pencairan */}
                        <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-slate-200/80 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center justify-center">
                                        <CircleDollarSign className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <h2 className="font-bold text-slate-900 text-sm sm:text-base">Pagu & Pencairan Dana</h2>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setPaguAmount(data.pagu_amount !== "0" ? data.pagu_amount : ""); setShowPagu(true); }}
                                        className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 font-bold border border-amber-200 transition-all flex items-center gap-1.5 cursor-pointer">
                                        {parseFloat(data.pagu_amount) > 0 ? <><Pencil className="w-3 h-3" /> Edit Pagu</> : <><AlertTriangle className="w-3 h-3" /> Set Pagu</>}
                                    </button>
                                    <button onClick={() => setShowCair(true)}
                                        className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 font-bold border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer">
                                        <Plus className="w-3 h-3" /> Pencairan
                                    </button>
                                </div>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 font-medium">Pagu Anggaran Disetujui:</span>
                                    <span className="font-bold text-slate-900">{fmtRp(data.pagu_amount)}</span>
                                </div>
                                {data.disbursements.length > 0 ? (
                                    <div className="space-y-2">
                                        {data.disbursements.map(d => (
                                            <div key={d.id} className="flex justify-between items-center bg-emerald-50/60 border border-emerald-200/70 rounded-xl px-4 py-2.5 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Receipt className="w-4 h-4 text-emerald-600" />
                                                    <span className="text-emerald-900 font-semibold">{d.date} {d.reference_number ? `(Ref: ${d.reference_number})` : ""}</span>
                                                </div>
                                                <span className="font-extrabold text-emerald-800">{fmtRp(d.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between text-sm font-bold pt-3 border-t border-slate-100">
                                            <span className="text-slate-700">Total Dana Dicairkan</span>
                                            <span className="text-emerald-700 font-extrabold">{fmtRp(data.total_disbursed)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-slate-400 text-xs italic py-2">Belum ada pencairan dana tercatat bulan ini.</p>
                                )}
                            </div>
                        </div>

                        {/* Saldo Kas */}
                        <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-slate-200/80 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-cyan-50 border border-cyan-200/60 rounded-xl flex items-center justify-center">
                                        <Landmark className="w-4 h-4 text-cyan-600" />
                                    </div>
                                    <h2 className="font-bold text-slate-900 text-sm sm:text-base">Saldo Rekening Kas</h2>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowTransfer(true)}
                                        className="text-xs px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-xl hover:bg-cyan-100 font-bold border border-cyan-200 transition-all flex items-center gap-1.5 cursor-pointer">
                                        <ArrowRightLeft className="w-3 h-3" /> Mutasi
                                    </button>
                                    <button onClick={() => setShowKasModal(true)}
                                        className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-bold border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer">
                                        <Plus className="w-3 h-3" /> Tambah Kas
                                    </button>
                                </div>
                            </div>
                            <div className="p-5">
                                {data.kas_balances.length > 0 ? (
                                    <div className="space-y-2">
                                        {data.kas_balances.map(k => (
                                            <div key={k.id} className="flex justify-between items-center bg-cyan-50/60 border border-cyan-200/70 rounded-xl px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <Wallet className="w-4 h-4 text-cyan-600" />
                                                    <span className="text-cyan-950 font-bold text-sm">{k.name}</span>
                                                </div>
                                                <span className="font-extrabold text-cyan-900 text-sm">{fmtRp(k.balance)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-400 text-xs italic py-2">Belum ada kas terdaftar. Tambahkan kas (VA Bank, Kas Kecil).</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Realisasi vs Budget Keseluruhan */}
                    <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-slate-200/80 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-2.5 mb-5">
                            <div className="w-8 h-8 bg-amber-50 border border-amber-200/60 rounded-xl flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-amber-600" />
                            </div>
                            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Realisasi Pos Anggaran vs Juknis BGN</h2>
                        </div>
                        <div className="space-y-5">
                            {Object.values(data.juknis_breakdown).filter((bd: any) => parseFloat(bd.target) > 0 || parseFloat(bd.realisasi) > 0).map((bd: any, idx) => {
                                const barPct = Math.min(bd.pct, 150);
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between text-xs sm:text-sm mb-2">
                                            <span className="font-bold text-slate-800">{bd.label}</span>
                                            <span className={bd.over_budget ? "text-rose-600 font-extrabold" : "text-slate-600 font-semibold"}>
                                                {fmtRp(bd.realisasi)} / {fmtRp(bd.target)} — {bd.pct}%
                                            </span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${bd.over_budget ? "bg-rose-500" : bd.pct > 90 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                style={{ width: `${Math.min(barPct, 100)}%` }}
                                            />
                                        </div>
                                        {bd.over_budget && (
                                            <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Peringatan: Melebihi plafon alokasi belanja juknis!
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Fund Return / Sisa Dana */}
                    {hasSisa && (
                        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
                            <p className="text-amber-900 font-extrabold text-base sm:text-lg flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-amber-600" /> Sisa Dana Berjalan: {fmtRp(data.sisa_anggaran)}
                            </p>
                            <p className="text-amber-800/80 text-xs sm:text-sm mt-1 font-medium">
                                Sisa saldo ini direkapitulasi saat tutup buku bulanan. Jika terdapat kelebihan wajib disetorkan kembali ke Kas Negara.
                            </p>
                            <button onClick={() => { setRetAmount(data.sisa_anggaran); setShowReturn(true); }}
                                className="mt-4 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer">
                                <Undo2 className="w-4 h-4" /> Catat Pengembalian (Tutup Buku)
                            </button>
                        </div>
                    )}
                    {data.fund_return && (
                        <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-5">
                            <p className="text-emerald-900 font-bold flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Sisa Dana Telah Disetor ke Kas Negara: {fmtRp(data.fund_return.amount)}
                            </p>
                            <p className="text-emerald-800 text-xs mt-1 font-medium">Tanggal Setor: {data.fund_return.return_date} | No. Referensi: {data.fund_return.reference_number || "-"}</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-16 text-slate-400 text-sm">Tidak ada data anggaran untuk periode ini.</div>
            )}

            {/* ─── Modals ─── */}
            <BaseModal isOpen={showPagu} onClose={() => setShowPagu(false)} title="Set Pagu Anggaran BGN" maxWidth="max-w-md">
                <p className="text-xs text-slate-500 mb-4">Pagu anggaran resmi untuk bulan {MONTHS[month]} {year}</p>
                <div className="space-y-4">
                    <GlassInput label="Nominal Pagu (Rp)" type="number" value={paguAmount} onChange={e => setPaguAmount(e.target.value)} placeholder="Contoh: 150000000" />
                    <GlassInput label="Catatan Tambahan (opsional)" type="text" value={paguNotes} onChange={e => setPaguNotes(e.target.value)} placeholder="Nomor DIPA / SK Pagu..." />
                </div>
                <div className="flex gap-3 pt-5 border-t border-slate-100 mt-4">
                    <button onClick={() => setShowPagu(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Batal</button>
                    <button onClick={savePagu} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-600/20 disabled:opacity-50 transition-all cursor-pointer">
                        {saving ? "Menyimpan..." : "Simpan Pagu"}
                    </button>
                </div>
            </BaseModal>

            <BaseModal isOpen={showCair} onClose={() => setShowCair(false)} title="Catat Pencairan Dana Termin" maxWidth="max-w-md">
                <div className="space-y-4 pt-1">
                    <GlassInput label="Tanggal Pencairan" type="date" value={cairDate} onChange={e => setCairDate(e.target.value)} />
                    <GlassInput label="Nominal Pencairan (Rp)" type="number" value={cairAmount} onChange={e => setCairAmount(e.target.value)} placeholder="Nominal dana cair" />
                    <GlassInput label="No. SP2D / Referensi Bank" type="text" value={cairRef} onChange={e => setCairRef(e.target.value)} placeholder="SP2D-2026-001" />
                    <GlassTextarea label="Catatan Tambahan" value={cairNotes} onChange={e => setCairNotes(e.target.value)} rows={2} />
                </div>
                <div className="flex gap-3 pt-5 border-t border-slate-100 mt-4">
                    <button onClick={() => setShowCair(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Batal</button>
                    <button onClick={saveCair} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer">
                        {saving ? "Menyimpan..." : "Simpan Pencairan"}
                    </button>
                </div>
            </BaseModal>

            <BaseModal isOpen={showTransfer && !!data} onClose={() => setShowTransfer(false)} title="Mutasi Dana Antar Kas" maxWidth="max-w-md">
                {data && (
                    <>
                        <div className="space-y-4 pt-1">
                            <GlassSelect label="Kas Sumber (Asal)" value={tfFrom} onChange={e => setTfFrom(e.target.value)}>
                                <option value="">Pilih kas asal</option>
                                {data.kas_balances.map(k => <option key={k.id} value={k.id}>{k.name} ({fmtRp(k.balance)})</option>)}
                            </GlassSelect>
                            <GlassSelect label="Kas Tujuan" value={tfTo} onChange={e => setTfTo(e.target.value)}>
                                <option value="">Pilih kas tujuan</option>
                                {data.kas_balances.filter(k => k.id !== tfFrom).map(k => <option key={k.id} value={k.id}>{k.name} ({fmtRp(k.balance)})</option>)}
                            </GlassSelect>
                            <GlassInput label="Nominal Mutasi (Rp)" type="number" value={tfAmount} onChange={e => setTfAmount(e.target.value)} placeholder="Nominal transfer" />
                            <GlassInput label="Tanggal Mutasi" type="date" value={tfDate} onChange={e => setTfDate(e.target.value)} />
                        </div>
                        <div className="flex gap-3 pt-5 border-t border-slate-100 mt-4">
                            <button onClick={() => setShowTransfer(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Batal</button>
                            <button onClick={saveTransfer} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-cyan-600/20 disabled:opacity-50 transition-all cursor-pointer">
                                {saving ? "Memproses..." : "Transfer Dana"}
                            </button>
                        </div>
                    </>
                )}
            </BaseModal>

            <BaseModal isOpen={showReturn} onClose={() => setShowReturn(false)} title="Pengembalian Sisa ke Kas Negara" maxWidth="max-w-md">
                <p className="text-xs text-slate-500 mb-4">Setoran sisa saldo anggaran periode {MONTHS[month]} {year}</p>
                <div className="space-y-4">
                    <GlassInput label="Nominal Setoran (Rp)" type="number" value={retAmount} onChange={e => setRetAmount(e.target.value)} />
                    <GlassInput label="Tanggal Penyetoran" type="date" value={retDate} onChange={e => setRetDate(e.target.value)} />
                    <GlassInput label="Nomor Bukti Setor / BPN" type="text" value={retRef} onChange={e => setRetRef(e.target.value)} placeholder="Contoh: NTPN-2026-999" />
                </div>
                <div className="flex gap-3 pt-5 border-t border-slate-100 mt-4">
                    <button onClick={() => setShowReturn(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Batal</button>
                    <button onClick={saveReturn} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer">
                        {saving ? "Memproses..." : "Catat Setoran"}
                    </button>
                </div>
            </BaseModal>

            <BaseModal isOpen={showKasModal} onClose={() => setShowKasModal(false)} title="Tambah Akun Kas Baru" maxWidth="max-w-md">
                <div className="space-y-4 pt-1">
                    <GlassInput label="Nama Rekening Kas" type="text" value={kasName} onChange={e => setKasName(e.target.value)} placeholder="Contoh: Kas Operasional Dapur" />
                    <GlassSelect label="Tipe Akun" value={kasType} onChange={e => setKasType(e.target.value)}>
                        <option value="va_bank">Rekening Bank / VA</option>
                        <option value="kas_kecil">Kas Kecil (Petty Cash)</option>
                        <option value="rekening_lain">Rekening Lain</option>
                    </GlassSelect>
                    <GlassInput label="Saldo Awal (Rp)" type="number" value={kasBal} onChange={e => setKasBal(e.target.value)} />
                </div>
                <div className="flex gap-3 pt-5 border-t border-slate-100 mt-4">
                    <button onClick={() => setShowKasModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Batal</button>
                    <button onClick={saveKas} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all cursor-pointer">
                        {saving ? "Menyimpan..." : "Tambah Kas"}
                    </button>
                </div>
            </BaseModal>
        </div>
    );
}

/* ─── Buku Kas Tab ─── */
type KasAccount = { id: string; name: string };
type LedgerEntry = { id: string; entry_date: string; description: string; entry_type: "debit" | "credit"; amount: number; balance_after: number; reference_type: string; };

function BukuKasTab() {
    const [pageState, setPageState] = useState<"loading" | "ready" | "error">("loading");
    const [kasAccounts, setKasAccounts] = useState<KasAccount[]>([]);
    const [accountId, setAccountId] = useState("");

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        apiGet("/budget/kas-accounts").then(res => {
            if (!mounted) return;
            if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
                setKasAccounts(res.data);
                setAccountId(res.data[0].id);
                setPageState("ready");
            } else {
                setKasAccounts([]);
                setPageState("ready");
            }
        }).catch(e => {
            if (!mounted) return;
            console.error(e);
            setPageState("error");
        });
        return () => { mounted = false; };
    }, []);

    const fetchLedger = useCallback(async () => {
        if (!accountId) return;
        setLedgerLoading(true);
        try {
            const res = await apiGet(`/budget/ledger?kas_account_id=${accountId}&start_date=${startDate}&end_date=${endDate}&limit=500`);
            setEntries(res?.data?.entries || []);
        } catch (e) {
            console.error(e);
        }
        setLedgerLoading(false);
    }, [accountId, startDate, endDate]);

    useEffect(() => {
        if (pageState === "ready" && accountId) fetchLedger();
    }, [pageState, accountId, fetchLedger]);

    const getBadge = (refType: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            disbursement:  { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", label: "Pencairan" },
            transfer:      { bg: "bg-cyan-50 border-cyan-200",    text: "text-cyan-800",   label: "Mutasi" },
            expense:       { bg: "bg-rose-50 border-rose-200",    text: "text-rose-800",   label: "Belanja" },
            payroll:       { bg: "bg-blue-50 border-blue-200", text: "text-blue-800", label: "Honor Staf" },
            return_to_gov: { bg: "bg-slate-100 border-slate-200", text: "text-slate-800",  label: "Kas Negara" },
            income:        { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", label: "Penerimaan" },
        };
        const b = badges[refType] || { bg: "bg-slate-100 border-slate-200", text: "text-slate-700", label: refType };
        return <span className={`${b.bg} ${b.text} text-xs px-2.5 py-0.5 rounded-full font-bold border`}>{b.label}</span>;
    };

    const exportCSV = () => {
        const headers = ["Tanggal", "Keterangan", "Jenis", "Masuk", "Keluar", "Saldo"];
        const rows = entries.map(e => [
            e.entry_date, `"${e.description.replace(/"/g, '""')}"`, e.reference_type,
            e.entry_type === "debit" ? e.amount : "", e.entry_type === "credit" ? e.amount : "", e.balance_after
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.href = encodedUri;
        link.download = `buku_kas_${accountId}_${startDate}_${endDate}.csv`;
        document.body.appendChild(link); link.click(); link.remove();
    };

    if (pageState === "loading") {
        return <div className="flex justify-center py-20"><div className="w-10 h-10 border-[3px] border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>;
    }

    if (pageState === "error") {
        return <div className="text-center py-16 text-rose-600 font-medium">Gagal memuat akun kas. Coba segarkan halaman.</div>;
    }

    return (
        <div className="space-y-5">
            {/* Filters */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-slate-200/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <GlassSelect label="Pilih Akun Kas" value={accountId} onChange={e => setAccountId(e.target.value)}>
                            <optgroup label="Tersedia">
                                {kasAccounts.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                            </optgroup>
                        </GlassSelect>
                    </div>
                    <div className="flex-1">
                        <GlassInput label="Dari Tanggal" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="flex-1">
                        <GlassInput label="Sampai Tanggal" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchLedger} className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-600/20 flex items-center gap-2 transition-all cursor-pointer">
                            <Search className="w-4 h-4" /> Cari
                        </button>
                        <button onClick={exportCSV} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer">
                            <Download className="w-4 h-4 text-emerald-600" /> Ekspor CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-slate-200/80 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="p-4">Tanggal</th>
                                <th className="p-4">Keterangan Transaksi</th>
                                <th className="p-4 min-w-[130px]">Kategori</th>
                                <th className="p-4 text-right">Debet (Masuk)</th>
                                <th className="p-4 text-right">Kredit (Keluar)</th>
                                <th className="p-4 text-right">Saldo Akhir</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {kasAccounts.length === 0 ? (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">Tidak ada rekening kas yang tersedia.</td></tr>
                            ) : ledgerLoading ? (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-500 italic">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                        Memuat riwayat transaksi kas...
                                    </div>
                                </td></tr>
                            ) : entries.length > 0 ? (
                                entries.map(l => {
                                    const isDebit = l.entry_type === "debit";
                                    return (
                                        <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-4 text-slate-600 font-medium whitespace-nowrap">{new Date(l.entry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric'})}</td>
                                            <td className="p-4 font-bold text-slate-900">{l.description}</td>
                                            <td className="p-4">{getBadge(l.reference_type)}</td>
                                            <td className="p-4 text-right font-bold">{isDebit && <span className="text-emerald-700">+{fmtRp(l.amount)}</span>}</td>
                                            <td className="p-4 text-right font-bold">{!isDebit && <span className="text-rose-700">-{fmtRp(l.amount)}</span>}</td>
                                            <td className="p-4 text-right font-extrabold text-slate-900">{fmtRp(l.balance_after)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">Tidak ada transaksi ditemukan pada rentang tanggal tersebut.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/* ─── Layout Shell ─── */
function AnggaranTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "overview";

    const setTab = (tab: string) => {
        router.push(`/anggaran?tab=${tab}`);
    };

    const tabs = [
        { key: "overview", label: "Ringkasan Pagu & Alokasi", desc: "Statistik Realisasi Juknis", icon: BarChart3 },
        { key: "buku-kas", label: "Buku Kas & Mutasi", desc: "Rekening Bank & Kas Kecil", icon: BookOpen },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-fade-in">
            {/* Header */}
            <div className="pt-1">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                        Pengawasan Pagu BGN & Arus Kas
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-500">Akuntabilitas Negara</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    Pagu Anggaran & Buku Kas
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">
                    Monitoring penyerapan dana pagu, pencairan termin, pembagian alokasi juknis 70:30, dan mutasi kas bank.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="sticky top-0 z-20 pt-1 pb-2 backdrop-blur-md">
                <div className="flex gap-2.5 bg-white/85 backdrop-blur-xl rounded-2xl p-2 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] w-fit">
                    {tabs.map(t => {
                        const active = activeTab === t.key;
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                                    active
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
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

            <div className="transition-all duration-200">
                {activeTab === "overview" && <OverviewTab />}
                {activeTab === "buku-kas" && <BukuKasTab />}
            </div>
        </div>
    );
}

export default function AnggaranPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-400 text-sm">Memuat modul anggaran...</div>}>
            <AnggaranTabs />
        </Suspense>
    );
}
