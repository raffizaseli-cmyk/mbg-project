"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { BaseModal } from "@/components/ui/BaseModal";
import { 
    Wallet, 
    CreditCard, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    Truck, 
    Search, 
    Building2, 
    Coins, 
    Receipt, 
    Calendar,
    ArrowUpRight,
    Sparkles,
    ShieldCheck,
    Check
} from "lucide-react";

function formatRp(val: string | number): string {
    const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
        .format(n).replace("IDR", "Rp");
}

const MONTHS_FULL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/* ─── Piutang Part ─── */
interface Receivable {
    id: string;
    debtor_name: string;
    amount: string;
    created_at: string;
    status: string;
}
interface ReceivableSummary {
    total_all: string;
    count: number;
    receivables: Receivable[];
}

function PiutangTab() {
    const now = new Date();
    const [bulan, setBulan] = useState(now.getMonth() + 1);
    const [tahun, setTahun] = useState(now.getFullYear());
    const [data, setData] = useState<ReceivableSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (bulan && tahun) { params.month = bulan; params.year = tahun; }
            const r = await apiGet("/reports/receivables", params);
            setData(r?.data ?? null);
        } catch { }
        setLoading(false);
    }, [bulan, tahun]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const sorted = [...(data?.receivables ?? [])].sort((a, b) => 
        b.created_at.localeCompare(a.created_at)
    );

    return (
        <div className="space-y-6">
            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <StatCard 
                        title="Total Hak Tagih (Pemerintah)" 
                        value={formatRp(data.total_all)} 
                        icon={<Coins className="w-5 h-5 text-blue-600" />} 
                        accentColor="blue"
                        subtitle={`Berdasarkan tarif juknis alokasi porsi ${MONTHS_FULL[bulan]} ${tahun}`}
                    />
                    <StatCard 
                        title="Frekuensi Pengiriman MBG" 
                        value={`${data.count} Kali Kirim`} 
                        icon={<Truck className="w-5 h-5 text-emerald-600" />} 
                        accentColor="emerald"
                        subtitle="Distribusi terverifikasi berita acara"
                    />
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-white p-5 flex flex-wrap gap-4 items-end relative z-20">
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
                    onClick={fetchData} 
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                    <Search className="w-4 h-4" /> Cari Tagihan
                </button>
            </div>

            {/* Smart Banner */}
            <div className="rounded-2xl border border-blue-200/60 bg-blue-50/80 p-4.5 flex items-start gap-3.5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <span className="font-bold text-blue-900">Penghitungan Hak Tagih Otomatis:</span> Setiap pengiriman yang telah diverifikasi otomatis mengkalkulasi hak klaim restitusi SPPG (Porsi Terkirim × Plafon Juknis Bahan Makanan Rp 10.000 / Rp 8.000). Dokumen klaim dicocokkan langsung dengan Rekening Kas Virtual SPPG.
                </div>
            </div>

            {/* Receivables Table */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden relative z-10">
                <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-transparent">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                            <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 text-base">Daftar Piutang Penyaluran MBG</h2>
                            <p className="text-xs text-slate-500 font-medium">Buku pembantu hak tagih atas alokasi porsi resmi</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-medium">Menghitung akumulasi hak tagih...</p>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 space-y-3">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">
                            📭
                        </div>
                        <p className="font-semibold text-slate-600 text-sm">Belum ada catatan hak tagih di periode ini</p>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">Data akan otomatis terbit saat penyerahan porsi MBG dilaporkan.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="text-left px-6 py-3.5">Tanggal Penyerahan</th>
                                    <th className="text-left px-5 py-3.5">Debitur / Entitas Program</th>
                                    <th className="text-right px-6 py-3.5">Estimasi Hak Tagih Bahan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sorted.map((r, i) => {
                                    const amount = parseFloat(r.amount || "0");
                                    return (
                                        <tr key={r.id} className={`hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}>
                                            <td className="px-6 py-3.5 text-slate-600 text-xs font-mono font-medium">
                                                {r.created_at}
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold text-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                    {r.debtor_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5 text-right font-mono font-bold text-blue-700 text-base">
                                                {formatRp(amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-blue-50/50 border-t-2 border-blue-200/80 font-bold">
                                <tr>
                                    <td colSpan={2} className="px-6 py-4.5 text-blue-900 uppercase tracking-wider text-xs">
                                        Total Seluruh Piutang Hak Tagih (Bahan Makanan)
                                    </td>
                                    <td className="px-6 py-4.5 text-right font-mono text-lg text-blue-950">
                                        {formatRp(parseFloat(data?.total_all || "0"))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Hutang Part ─── */
interface Payable {
    id: string;
    supplier_name: string;
    amount: string;
    total_bayar: string;
    due_date?: string;
    created_at: string;
    status: string;
    days_overdue: number;
}
interface PayableSummary {
    total_outstanding: string;
    total_all: string;
    total_paid: string;
    total_overdue: string;
    count: number;
    payables: Payable[];
}
interface ConfirmModal {
    payable: Payable;
}

function HutangTab() {
    const now = new Date();
    const [status, setStatus] = useState("unpaid");
    const [supplierSearch, setSupplierSearch] = useState("");
    const [bulan, setBulan] = useState(now.getMonth() + 1);
    const [tahun, setTahun] = useState(now.getFullYear());
    const [data, setData] = useState<PayableSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);
    const [paying, setPaying] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { status };
            if (supplierSearch.trim()) params.supplier = supplierSearch.trim();
            if (bulan && tahun) { params.month = bulan; params.year = tahun; }
            const r = await apiGet("/reports/payables", params);
            setData(r?.data ?? null);
        } catch { }
        setLoading(false);
    }, [status, supplierSearch, bulan, tahun]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleMarkPaid = async () => {
        if (!confirmModal) return;
        setPaying(true);
        try {
            await apiPatch(`/payables/${confirmModal.payable.id}/mark-paid`);
            setConfirmModal(null);
            fetchData();
        } catch {
            alert("Gagal menandai lunas. Pastikan akun Anda memiliki akses.");
        }
        setPaying(false);
    };

    const sorted = [...(data?.payables ?? [])].sort((a, b) => {
        if (b.days_overdue !== a.days_overdue) return b.days_overdue - a.days_overdue;
        return (a.due_date ?? "").localeCompare(b.due_date ?? "");
    });

    return (
        <div className="space-y-6">
            {data && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    <StatCard 
                        title="Total Kewajiban Hutang" 
                        value={formatRp(data.total_all)} 
                        icon={<CreditCard className="w-5 h-5 text-blue-600" />} 
                        accentColor="blue"
                        subtitle="Kewajiban pengadaan bahan"
                    />
                    <StatCard 
                        title="Sudah Terlunasi" 
                        value={formatRp(data.total_paid)} 
                        icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} 
                        accentColor="emerald"
                        subtitle="Tercatat di arus kas keluar"
                    />
                    <StatCard 
                        title="Sisa Belum Lunas" 
                        value={formatRp(data.total_outstanding)} 
                        icon={<Clock className="w-5 h-5 text-amber-600" />} 
                        accentColor="amber"
                        subtitle="Jatuh tempo berjalan"
                    />
                    <StatCard 
                        title="Hutang Jatuh Tempo" 
                        value={formatRp(data.total_overdue)} 
                        icon={<AlertTriangle className="w-5 h-5 text-rose-600" />} 
                        accentColor="rose"
                        subtitle="Melewati batas tempo bayar"
                    />
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-white p-5 flex flex-wrap gap-4 items-end relative z-20">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status Pelunasan</label>
                    <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value)}
                        className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    >
                        <option value="all">Semua Status</option>
                        <option value="unpaid">Belum Lunas (Outstanding)</option>
                        <option value="paid">Lunas (Paid)</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Supplier / Mitra Pangan</label>
                    <div className="relative">
                        <input 
                            value={supplierSearch} 
                            onChange={e => setSupplierSearch(e.target.value)}
                            placeholder="Cari nama supplier / vendor..."
                            className="border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-sm font-medium w-full bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Bulan Nota</label>
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
                        className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium w-24 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                    />
                </div>
                <button 
                    onClick={fetchData} 
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                    <Search className="w-4 h-4" /> Cari
                </button>
            </div>

            {/* Payables Table */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden relative z-10">
                <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-transparent">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 text-base">Buku Hutang Usaha Supplier</h2>
                            <p className="text-xs text-slate-500 font-medium">Monitoring invoice tagihan vendor logistik & bahan baku dapur</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-medium">Memuat data hutang supplier...</p>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 space-y-3">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl border border-emerald-100">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <p className="font-semibold text-slate-700 text-sm">Tidak ada invoice hutang untuk kriteria filter ini</p>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">Semua kewajiban telah terlunasi atau tidak ada tagihan terdaftar.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="text-left px-5 py-3.5">Tanggal Nota</th>
                                    <th className="text-left px-5 py-3.5">Supplier Mitra</th>
                                    <th className="text-right px-5 py-3.5">Total Tagihan</th>
                                    <th className="text-left px-4 py-3.5">Jatuh Tempo</th>
                                    <th className="text-center px-4 py-3.5">Status</th>
                                    <th className="text-center px-4 py-3.5">Keterlambatan</th>
                                    <th className="text-center px-5 py-3.5">Aksi Pelunasan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sorted.map((p, i) => {
                                    const due = p.due_date
                                        ? new Date(p.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                                        : "—";
                                    return (
                                        <tr key={p.id} className={`hover:bg-blue-50/20 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}>
                                            <td className="px-5 py-3.5 text-slate-600 text-xs font-mono font-medium">
                                                {p.created_at}
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold text-slate-800 max-w-[180px] truncate">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                                                    <span title={p.supplier_name}>{p.supplier_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                                                {formatRp(p.total_bayar)}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-600 text-xs font-medium">
                                                {due}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <StatusBadge status={p.status} />
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                {p.days_overdue > 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                        <AlertTriangle className="w-3 h-3" /> {p.days_overdue} hari
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                {p.status === "unpaid" ? (
                                                    <button 
                                                        onClick={() => setConfirmModal({ payable: p })}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Tandai Lunas
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Terbayar
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Konfirmasi Pelunasan */}
            <BaseModal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} title="Konfirmasi Pelunasan Hutang" maxWidth="max-w-md">
                {confirmModal && (
                    <div className="space-y-4">
                        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Detail Kewajiban</p>
                            <p className="text-sm font-semibold text-slate-800">
                                Supplier: <strong>{confirmModal.payable.supplier_name}</strong>
                            </p>
                            <p className="text-lg font-bold text-emerald-700 font-mono">
                                {formatRp(confirmModal.payable.total_bayar || confirmModal.payable.amount)}
                            </p>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            ⚠️ Konfirmasi ini akan mencatat transaksi pengeluaran kas di buku kas operasional dan mengubah status invoice menjadi <strong>LUNAS</strong>.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setConfirmModal(null)} 
                                disabled={paying}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-all cursor-pointer"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleMarkPaid} 
                                disabled={paying}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm shadow-sm shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                {paying ? "Memproses..." : "Ya, Tandai Lunas"}
                            </button>
                        </div>
                    </div>
                )}
            </BaseModal>
        </div>
    );
}

/* ─── Layout Shell ─── */
function KeuanganTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "piutang";

    const setTab = (tab: string) => {
        router.push(`/keuangan?tab=${tab}`);
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in mt-2 space-y-6">
            <PageHeader 
                title="Buku Piutang & Hutang Usaha" 
                subtitle="Rekonsiliasi Hak Tagih Pemerintah & Manajemen Kewajiban Finansial Mitra Pangan"
                actions={
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        Audit Finansial Siap
                    </span>
                }
            />

            {/* Segmented Top Tab Navigation */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-1.5 border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex gap-2">
                <button
                    onClick={() => setTab("piutang")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        activeTab === "piutang" 
                            ? "bg-blue-600 text-white shadow-md" 
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                >
                    <Coins className="w-4 h-4" /> Piutang Pemerintah (MBG)
                </button>
                <button
                    onClick={() => setTab("hutang")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        activeTab === "hutang" 
                            ? "bg-slate-700 text-white shadow-md" 
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                    }`}
                >
                    <CreditCard className="w-4 h-4" /> Hutang Supplier Mitra
                </button>
            </div>

            {/* Content */}
            <div className="mt-4">
                {activeTab === "piutang" && <PiutangTab />}
                {activeTab === "hutang" && <HutangTab />}
            </div>
        </div>
    );
}

export default function KeuanganPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Memuat data keuangan SPPG...</div>}>
            <KeuanganTabs />
        </Suspense>
    );
}

