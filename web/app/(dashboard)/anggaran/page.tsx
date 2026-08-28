"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { BaseModal } from "@/components/ui/BaseModal";

/* ─── Helpers ─── */
const fmtRp = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return "Rp 0";
    return "Rp " + Math.round(n).toLocaleString("id-ID");
};

const MONTHS = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

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
                from_account_id: tfFrom, to_account_id: tfTo,
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
            setShowReturn(false); fetchData();
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
            <div className="flex justify-end gap-2 mb-4">
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                    {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                    {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : data ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: "Pagu Anggaran", value: fmtRp(data.pagu_amount), icon: "🏛️", color: "blue" },
                            { label: "Dana Cair", value: fmtRp(data.total_disbursed), icon: "💰", color: "green" },
                            { label: "Total Terpakai", value: fmtRp(data.total_spent), icon: "💸", color: "orange" },
                            { label: "Sisa Anggaran", value: fmtRp(data.sisa_anggaran), icon: "⏳", color: "gray" },
                            { label: "Total Porsi", value: data.total_porsi.toLocaleString("id-ID"), icon: "🍱", color: "purple" },
                        ].map(card => (
                            <div key={card.label} className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border p-5 ${card.color === "red" ? "border-red-200 bg-red-50/50" : "border-white"}`}>
                                <p className="text-xs text-gray-500 mb-1">{card.icon} {card.label}</p>
                                <p className={`text-lg font-bold ${card.color === "red" ? "text-red-700" : "text-gray-900"}`}>{card.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="font-bold text-gray-900">💰 Pagu & Pencairan Dana</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => { setPaguAmount(data.pagu_amount !== "0" ? data.pagu_amount : ""); setShowPagu(true); }}
                                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">
                                        {parseFloat(data.pagu_amount) > 0 ? "✏️ Edit Pagu" : "⚠️ Set Pagu"}
                                    </button>
                                    <button onClick={() => setShowCair(true)}
                                        className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium">
                                        + Catat Pencairan
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between text-sm mb-3">
                                    <span className="text-gray-500">Pagu bulan ini:</span>
                                    <span className="font-bold">{fmtRp(data.pagu_amount)}</span>
                                </div>
                                {data.disbursements.length > 0 ? (
                                    <div className="space-y-2">
                                        {data.disbursements.map(d => (
                                            <div key={d.id} className="flex justify-between items-center bg-green-50 rounded-lg px-3 py-2 text-sm">
                                                <span className="text-green-800">{d.date} {d.reference_number ? `(Ref: ${d.reference_number})` : ""}</span>
                                                <span className="font-bold text-green-900">{fmtRp(d.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                                            <span>Total Cair</span>
                                            <span className="text-green-700">{fmtRp(data.total_disbursed)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-400 text-sm italic">Belum ada pencairan bulan ini</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="font-bold text-gray-900">🏦 Saldo Kas</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowTransfer(true)}
                                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">
                                        ↔️ Transfer Antar Kas
                                    </button>
                                    <button onClick={() => setShowKasModal(true)}
                                        className="text-xs px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 font-medium">
                                        + Tambah Kas
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                {data.kas_balances.length > 0 ? (
                                    <div className="space-y-2">
                                        {data.kas_balances.map(k => (
                                            <div key={k.id} className="flex justify-between items-center bg-blue-50 rounded-lg px-4 py-3">
                                                <span className="text-blue-800 font-medium">{k.name}</span>
                                                <span className="font-bold text-blue-900">{fmtRp(k.balance)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 text-sm italic">Belum ada kas. Tambahkan kas (VA Bank, Kas Kecil).</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-white p-6">
                        <h2 className="font-bold text-gray-900 mb-4">📊 Realisasi vs Budget Keseluruhan (Bulan Ini)</h2>
                        <div className="space-y-4">
                            {Object.values(data.juknis_breakdown).filter((bd: any) => parseFloat(bd.target) > 0 || parseFloat(bd.realisasi) > 0).map((bd: any, idx) => {
                                const barPct = Math.min(bd.pct, 150);
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-gray-700">{bd.label}</span>
                                            <span className={bd.over_budget ? "text-red-600 font-bold" : "text-gray-600"}>
                                                {fmtRp(bd.realisasi)} / {fmtRp(bd.target)} — {bd.pct}%
                                            </span>
                                        </div>
                                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${bd.over_budget ? "bg-red-500" : bd.pct > 90 ? "bg-yellow-400" : "bg-green-500"}`}
                                                style={{ width: `${Math.min(barPct, 100)}%` }}
                                            />
                                        </div>
                                        {bd.over_budget && <p className="text-xs text-red-500 mt-1">⚠️ Melebihi target alokasi!</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {hasSisa && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                            <p className="text-orange-800 font-bold text-lg">💡 Sisa Dana Berjalan: {fmtRp(data.sisa_anggaran)}</p>
                            <p className="text-orange-600 text-sm mt-1">Sisa dana ini direkap di akhir periode (Jika ada kelebihan wajib dikembalikan ke Kas Negara).</p>
                            <button onClick={() => { setRetAmount(data.sisa_anggaran); setShowReturn(true); }}
                                className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
                                📤 Catat Pengembalian (Tutup Bulan)
                            </button>
                        </div>
                    )}
                    {data.fund_return && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <p className="text-green-800 font-bold">✅ Dana sudah dikembalikan: {fmtRp(data.fund_return.amount)}</p>
                            <p className="text-green-600 text-sm">Tanggal: {data.fund_return.return_date} | Ref: {data.fund_return.reference_number || "-"}</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-12 text-gray-400">Tidak ada data anggaran</div>
            )}

            <BaseModal isOpen={showPagu} onClose={() => setShowPagu(false)} title="🏛️ Set Pagu Anggaran" maxWidth="max-w-md">
                        <p className="text-sm text-gray-500 mb-3">Pagu untuk {MONTHS[month]} {year}</p>
                        <div className="space-y-3">
                            <input type="number" value={paguAmount} onChange={e => setPaguAmount(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" placeholder="Nominal pagu (Rp)" />
                            <input type="text" value={paguNotes} onChange={e => setPaguNotes(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" placeholder="Catatan (opsional)" />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setShowPagu(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Batal</button>
                            <button onClick={savePagu} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                                {saving ? "Menyimpan..." : "✅ Simpan"}
                            </button>
                        </div>
            </BaseModal>
            
            <BaseModal isOpen={showCair} onClose={() => setShowCair(false)} title="💰 Catat Pencairan Dana" maxWidth="max-w-md">
                        <div className="space-y-3">
                            <div><label className="block text-xs text-gray-500 mb-1">Tanggal Cair</label><input type="date" value={cairDate} onChange={e => setCairDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Nominal</label><input type="number" value={cairAmount} onChange={e => setCairAmount(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" placeholder="Nominal pencairan" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">No. Referensi</label><input type="text" value={cairRef} onChange={e => setCairRef(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" placeholder="TRF001" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Catatan</label><textarea value={cairNotes} onChange={e => setCairNotes(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" rows={2} /></div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setShowCair(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Batal</button>
                            <button onClick={saveCair} disabled={saving} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                                {saving ? "Menyimpan..." : "✅ Simpan"}
                            </button>
                        </div>
            </BaseModal>

            <BaseModal isOpen={showTransfer && !!data} onClose={() => setShowTransfer(false)} title="↔️ Transfer Dana Antar Kas" maxWidth="max-w-md">
                {data && (
                    <>
                        <div className="space-y-3">
                            <div><label className="block text-xs text-gray-500 mb-1">Dari Kas</label>
                            <select value={tfFrom} onChange={e => setTfFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm">
                                <option value="">Pilih kas asal</option>
                                {data.kas_balances.map(k => <option key={k.id} value={k.id}>{k.name} ({fmtRp(k.balance)})</option>)}
                            </select></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Ke Kas</label>
                            <select value={tfTo} onChange={e => setTfTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm">
                                <option value="">Pilih kas tujuan</option>
                                {data.kas_balances.filter(k => k.id !== tfFrom).map(k => <option key={k.id} value={k.id}>{k.name} ({fmtRp(k.balance)})</option>)}
                            </select></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Nominal</label><input type="number" value={tfAmount} onChange={e => setTfAmount(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" placeholder="Nominal transfer" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Tanggal</label><input type="date" value={tfDate} onChange={e => setTfDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" /></div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setShowTransfer(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Batal</button>
                            <button onClick={saveTransfer} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                                {saving ? "Memproses..." : "✅ Transfer"}
                            </button>
                        </div>
                    </>
                )}
            </BaseModal>

            <BaseModal isOpen={showReturn} onClose={() => setShowReturn(false)} title="📤 Catat Pengembalian ke Kas Negara" maxWidth="max-w-md">
                        <p className="text-sm text-gray-500 mb-3">Bulan: {MONTHS[month]} {year}</p>
                        <div className="space-y-3">
                            <div><label className="block text-xs text-gray-500 mb-1">Nominal</label><input type="number" value={retAmount} onChange={e => setRetAmount(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Tanggal Setor</label><input type="date" value={retDate} onChange={e => setRetDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">No. Bukti</label><input type="text" value={retRef} onChange={e => setRetRef(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" placeholder="Nomor bukti setor" /></div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setShowReturn(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Batal</button>
                            <button onClick={saveReturn} disabled={saving} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                                {saving ? "Memproses..." : "✅ Catat Pengembalian"}
                            </button>
                        </div>
            </BaseModal>

            <BaseModal isOpen={showKasModal} onClose={() => setShowKasModal(false)} title="🏦 Tambah Kas Baru" maxWidth="max-w-md">
                        <div className="space-y-3">
                            <div><label className="block text-xs text-gray-500 mb-1">Nama Kas</label><input type="text" value={kasName} onChange={e => setKasName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" placeholder="VA Bank / Kas Kecil" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Tipe</label>
                            <select value={kasType} onChange={e => setKasType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm">
                                <option value="va_bank">VA Bank</option>
                                <option value="kas_kecil">Kas Kecil</option>
                                <option value="rekening_lain">Rekening Lain</option>
                            </select></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Saldo Awal</label><input type="number" value={kasBal} onChange={e => setKasBal(e.target.value)} className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" /></div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setShowKasModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Batal</button>
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
        switch (refType) {
            case "disbursement": return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">🟡 Pencairan</span>;
            case "transfer": return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">🔵 Transfer</span>;
            case "expense": return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">🔴 Pengeluaran</span>;
            case "payroll": return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">🟣 Gaji</span>;
            case "return_to_gov": return <span className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">⚫ Kembali Negara</span>;
            case "income": return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">🟢 Pemasukan</span>;
            default: return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">{refType}</span>;
        }
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
        return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (pageState === "error") {
        return <div className="text-center py-12 text-red-500">Gagal memuat akun kas. Coba segarkan halaman.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-white p-5 relative z-20">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Pilih Akun Kas</label>
                        <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                            <optgroup label="Tersedia">
                                {kasAccounts.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                            </optgroup>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Dari</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Sampai</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchLedger} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                            🔍 Cari
                        </button>
                        <button onClick={exportCSV} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                            📥 CSV
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden mt-2 relative z-10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100/50 text-xs text-gray-500 uppercase tracking-wider">
                                <th className="p-4 font-medium">Tanggal</th>
                                <th className="p-4 font-medium">Keterangan</th>
                                <th className="p-4 font-medium min-w-[130px]">Jenis</th>
                                <th className="p-4 font-medium text-right">Masuk</th>
                                <th className="p-4 font-medium text-right">Keluar</th>
                                <th className="p-4 font-medium text-right bg-blue-50/30">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/50 text-sm">
                            {kasAccounts.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Tidak ada kas yang tersedia. Silakan buat kas terlebih dahulu.</td></tr>
                            ) : ledgerLoading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Memuat riwayat transaksi...</td></tr>
                            ) : entries.length > 0 ? (
                                entries.map(l => {
                                    const isDebit = l.entry_type === "debit";
                                    return (
                                        <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 text-gray-500 whitespace-nowrap">{new Date(l.entry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric'})}</td>
                                            <td className="p-4 font-medium text-gray-800">{l.description}</td>
                                            <td className="p-4">{getBadge(l.reference_type)}</td>
                                            <td className="p-4 text-right">{isDebit && <span className="text-green-600 font-medium">+{fmtRp(l.amount)}</span>}</td>
                                            <td className="p-4 text-right">{!isDebit && <span className="text-red-500 font-medium">-{fmtRp(l.amount)}</span>}</td>
                                            <td className="p-4 text-right bg-blue-50/10 font-bold text-gray-800">{fmtRp(l.balance_after)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Tidak ada transaksi ditemukan pada filter tersebut.</td></tr>
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

    return (
        <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto pb-20 animate-in">
            <PageHeader title="📊 Keuangan & Anggaran" subtitle="Pantau realisasi anggaran dan riwayat kas" />

            <div className="border-b border-gray-200/50 sticky top-0 lg:-top-4 bg-gray-50/80 backdrop-blur-md z-10 mb-4 mt-2">
                <div className="flex space-x-8 px-2">
                    <button onClick={() => setTab("overview")}
                        className={`px-4 py-3 font-semibold border-b-[3px] transition-all duration-200 ${
                            activeTab === "overview" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                        }`}>
                        📊 Overview
                    </button>
                    <button onClick={() => setTab("buku-kas")}
                        className={`px-4 py-3 font-semibold border-b-[3px] transition-all duration-200 ${
                            activeTab === "buku-kas" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                        }`}>
                        📒 Buku Kas Lengkap
                    </button>
                </div>
            </div>

            <div className="mt-4">
                {activeTab === "overview" && <OverviewTab />}
                {activeTab === "buku-kas" && <BukuKasTab />}
            </div>
        </div>
    );
}

export default function AnggaranPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Memuat anggaran...</div>}>
            <AnggaranTabs />
        </Suspense>
    );
}
