"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { BaseModal } from "@/components/ui/BaseModal";

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
        <div className="space-y-5">
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard title="Total Tagihan (Porsi) Bulan Ini" value={formatRp(data.total_all)} icon="💰" />
                    <StatCard title="Jumlah Pengiriman" value={`${data.count} Kali`} icon="📦" />
                </div>
            )}

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-white p-5 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Bulan</label>
                    <select value={bulan} onChange={e => setBulan(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        {MONTHS_FULL.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Tahun</label>
                    <input type="number" value={tahun} onChange={e => setTahun(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24" />
                </div>
                <button onClick={fetchData} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">🔍 Cari</button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                💡 List di bawah adalah riwayat hak tagih dari setiap pengiriman MBG. 
                Nilai di bawah dihitung otomatis (Porsi × Harga Juknis Rp 10rb/8rb).
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden mt-2">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 space-y-2">
                        <p className="text-3xl">📭</p>
                        <p>Belum ada data pengiriman bulan ini</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {["Tanggal Pengiriman", "Debitur / Program", "Estimasi Hak Tagih (Bahan)"].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((r, i) => {
                                    const amount = parseFloat(r.amount || "0");
                                    return (
                                        <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap font-mono">{r.created_at}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">{r.debtor_name}</td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-700">{formatRp(amount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-blue-50/50 border-t-2 border-blue-100 font-bold">
                                <tr>
                                    <td colSpan={2} className="px-4 py-4 text-blue-800 uppercase tracking-wider text-xs">Total Seluruh Piutang (Bahan)</td>
                                    <td className="px-4 py-4 text-right text-blue-900 text-lg">{formatRp(parseFloat(data?.total_all || "0"))}</td>
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
        <div className="space-y-5">
            {data && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Total Hutang" value={formatRp(data.total_all)} icon="💸" />
                    <StatCard title="Sudah Lunas" value={formatRp(data.total_paid)} icon="✅" />
                    <StatCard title="Belum Lunas" value={formatRp(data.total_outstanding)} icon="📋" />
                    <StatCard title="Terlambat" value={formatRp(data.total_overdue)} icon="⚠️" />
                </div>
            )}

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-white p-5 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        <option value="all">Semua</option>
                        <option value="unpaid">Belum Lunas</option>
                        <option value="paid">Lunas</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs text-gray-500 mb-1">Supplier</label>
                    <input value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
                        placeholder="Cari supplier..."
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full" />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Bulan Transaksi</label>
                    <select value={bulan} onChange={e => setBulan(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                        {MONTHS_FULL.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Tahun</label>
                    <input type="number" value={tahun} onChange={e => setTahun(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24" />
                </div>
                <button onClick={fetchData} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">🔍 Cari</button>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-white overflow-hidden mt-2">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 space-y-2">
                        <p className="text-3xl">✅</p>
                        <p>Tidak ada hutang untuk filter ini</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {["Tanggal", "Supplier", "Total Bayar", "Jatuh Tempo", "Status", "Terlambat", "Aksi"].map(h => (
                                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((p, i) => {
                                    const due = p.due_date
                                        ? new Date(p.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })
                                        : "—";
                                    return (
                                        <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                            <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{p.created_at}</td>
                                            <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[140px] truncate">{p.supplier_name}</td>
                                            <td className="px-4 py-2.5 text-right font-bold">{formatRp(p.total_bayar)}</td>
                                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">{due}</td>
                                            <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                                            <td className="px-4 py-2.5">
                                                {p.days_overdue > 0
                                                    ? <span className="text-red-500 font-semibold text-xs">{p.days_overdue} hari</span>
                                                    : <span className="text-gray-300 text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {p.status === "unpaid" ? (
                                                    <button onClick={() => setConfirmModal({ payable: p })}
                                                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 whitespace-nowrap">
                                                        ✅ Tandai Lunas
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">✅ Lunas</span>
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

            <BaseModal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} title="Konfirmasi Pelunasan" maxWidth="max-w-sm">
                {confirmModal && (
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm">
                            Tandai hutang ke <strong>{confirmModal.payable.supplier_name}</strong> sebesar{" "}
                            <strong>{formatRp(confirmModal.payable.amount)}</strong> sebagai <strong>LUNAS</strong>?
                        </p>
                        <p className="text-xs text-gray-400">
                            Tindakan ini akan mencatat arus kas keluar dan tidak dapat dibatalkan.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} disabled={paying}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 text-sm cursor-pointer">
                                Batalkan
                            </button>
                            <button onClick={handleMarkPaid} disabled={paying}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-60 cursor-pointer">
                                {paying ? "⏳..." : "✅ Ya, Tandai Lunas"}
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
        <div className="max-w-6xl mx-auto pb-20 mt-0">
            <PageHeader title="💳 Piutang & Hutang" />

            {/* Tab Navigation */}
            <div className="border-b border-gray-200/50 sticky top-0 lg:-top-4 bg-gray-50/80 backdrop-blur-md z-10 mb-2 mt-2">
                <div className="flex space-x-8 px-2">
                    <button
                        onClick={() => setTab("piutang")}
                        className={`px-4 py-3 font-semibold border-b-[3px] transition-all duration-200 ${
                            activeTab === "piutang" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                        }`}
                    >
                        💰 Piutang Pemerintah
                    </button>
                    <button
                        onClick={() => setTab("hutang")}
                        className={`px-4 py-3 font-semibold border-b-[3px] transition-all duration-200 ${
                            activeTab === "hutang" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                        }`}
                    >
                        💸 Hutang Supplier
                    </button>
                </div>
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
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Memuat data keuangan...</div>}>
            <KeuanganTabs />
        </Suspense>
    );
}
