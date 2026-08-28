"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { BaseModal } from "@/components/ui/BaseModal";

interface Transaction {
    id: string;
    date: string;
    nama_toko: string;
    total: string;
    status: string;
    payment_method: string;

    items_count?: number;
    juknis_category?: string;
    created_at: string;
}

interface MonthlyData {
    expenses: { total: string; count: number; hutang_outstanding: string };
    excel_status: string;
    period_label: string;
    year: number;
    month: number;
}

function formatRp(val: string | number): string {
    const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
        .format(n).replace("IDR", "Rp");
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const MONTHS_FULL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function PembukuanPage() {
    const now = new Date();
    const [bulan, setBulan] = useState(now.getMonth() + 1);
    const [tahun, setTahun] = useState(now.getFullYear());
    const [status, setStatus] = useState("all");
    const [supplier, setSupplier] = useState("");
    const [juknisCat, setJuknisCat] = useState("all");
    const [page, setPage] = useState(0);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [monthly, setMonthly] = useState<MonthlyData | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [excelLoading, setExcelLoading] = useState(false);
    const [legalDocs, setLegalDocs] = useState<any[]>([]);
    const [bapLoading, setBapLoading] = useState(false);
    
    const [error, setError] = useState<string | null>(null);
    const [stalCount, setStalCount] = useState(0); // nota processing > 24 jam

    const [showOpsModal, setShowOpsModal] = useState(false);
    const [opsForm, setOpsForm] = useState({ name: "", amount: "", cost_date: "", is_recurring: false, notes: "" });
    const [opsSaving, setOpsSaving] = useState(false);

    // Confirmation Modal State
    const [confirmModalTrx, setConfirmModalTrx] = useState<Transaction | null>(null);
    const [confirmPaymentMethod, setConfirmPaymentMethod] = useState("cash");
    const [confirmNotes, setConfirmNotes] = useState("");
    const [confirmSubmitting, setConfirmSubmitting] = useState(false);

    // Delete Modal State
    const [deleteModalTrx, setDeleteModalTrx] = useState<Transaction | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    const LIMIT = 50;

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: any = { limit: LIMIT, offset: page * LIMIT };
            if (status !== "all") params.status = status;
            if (supplier.trim()) params.supplier = supplier.trim();
            // Date range: bulan/tahun
            const first = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
            const lastDay = new Date(tahun, bulan, 0).getDate();
            const last = `${tahun}-${String(bulan).padStart(2, "0")}-${lastDay}`;
            params.date_from = first;
            params.date_to = last;

            const [trxResp, mResp, legalResp] = await Promise.all([
                apiGet("/transactions", params),
                apiGet("/reports/monthly", { year: tahun, month: bulan }),
                apiGet("/legal/documents", { year: tahun, month: bulan })
            ]);

            const items = trxResp?.data?.items ?? trxResp?.data ?? [];
            setTransactions(items);
            setTotalCount(trxResp?.data?.total ?? items.length);
            setMonthly(mResp?.data ?? null);
            setLegalDocs(legalResp?.data ?? []);

            // Stale nota: processing > 24 jam
            const yesterday = new Date(Date.now() - 86_400_000).toISOString();
            const stale = items.filter(
                (t: Transaction) => t.status === "processing" && t.created_at < yesterday
            );
            setStalCount(stale.length);
        } catch (e: any) {
            setError("Gagal memuat data transaksi.");
        } finally {
            setLoading(false);
        }
    }, [bulan, tahun, status, supplier, page]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleGenerateExcel = async () => {
        setExcelLoading(true);
        try {
            const res = await apiPost("/legal/excel-dinas/generate", { year: tahun, month: bulan });
            if (res?.success === false) {
                alert(res.error || "Gagal generate Excel.");
            }
            fetchData();
        } catch (e: any) {
            const detail = e?.response?.data?.detail || e?.message || "Gagal generate Excel. Coba lagi.";
            alert(`Error: ${detail}`);
        } finally {
            setExcelLoading(false);
        }
    };




    const handleGenerateBAP = async () => {
        setBapLoading(true);
        try {
            const res = await apiPost("/legal/bap/generate", { year: tahun, month: bulan });
            if (!res.success) {
                alert(res.error || "BAP tidak dapat dibuat.");
            }
            fetchData();
        } catch (e: any) {
             alert(e.response?.data?.detail || "Gagal generate BAP.");
        } finally {
            setBapLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await apiPut(`/legal/documents/${id}/status`, { status });
            fetchData();
        } catch {
            alert("Gagal update status.");
        }
    };

    const getDoc = (type: string) => legalDocs.find(d => d.doc_type === type);
    const excelDoc = getDoc("excel_dinas");
    const bapDoc = getDoc("bap");

    const handleSaveOps = async (e: React.FormEvent) => {
        e.preventDefault();
        setOpsSaving(true);
        try {
            await apiPost("/operational", {
                ...opsForm,
                amount: Number(opsForm.amount)
            });
            setShowOpsModal(false);
            setOpsForm({ name: "", amount: "", cost_date: "", is_recurring: false, notes: "" });
            fetchData();
        } catch (e: any) {
            alert(e.message || "Gagal menyimpan biaya operasional");
        } finally {
            setOpsSaving(false);
        }
    };

    const handleKonfirmasi = async (id: string) => {
        try {
            await apiPost(`/transactions/${id}/confirm`);
            fetchData();
        } catch {
            alert("Gagal konfirmasi transaksi.");
        }
    };

    const handleConfirmSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmModalTrx) return;
        setConfirmSubmitting(true);
        try {
            await apiPost(`/transactions/${confirmModalTrx.id}/confirm`, {
                payment_method: confirmPaymentMethod,
                notes: confirmNotes || undefined,
            });
            alert("✅ Transaksi berhasil dikonfirmasi! Stok & Kas telah diperbarui.");
            setConfirmModalTrx(null);
            fetchData();
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Gagal mengonfirmasi transaksi.");
        } finally {
            setConfirmSubmitting(false);
        }
    };

    const handleDeleteSubmit = async () => {
        if (!deleteModalTrx) return;
        setDeleteSubmitting(true);
        try {
            await apiDelete(`/transactions/${deleteModalTrx.id}`);
            alert("✅ Transaksi berhasil dihapus! Stok & Pembukuan telah disesuaikan kembali.");
            setDeleteModalTrx(null);
            fetchData();
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Gagal menghapus transaksi.");
        } finally {
            setDeleteSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8 animate-in mt-2">
            <PageHeader
                title="Pembukuan"
                subtitle={`${MONTHS_FULL[bulan]} ${tahun}`}
                actions={
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowOpsModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 shadow-lg shadow-blue-600/20 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all cursor-pointer ring-1 ring-blue-700"
                        >
                            <span className="text-lg leading-none">+</span> Biaya Operasional
                        </button>
                    </div>
                }
            />

            {/* ─── DOKUMEN LEGAL & EXCEL SECTION ─────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                
                {/* EXCEL DINAS */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 sm:p-8 flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center text-2xl shadow-sm ring-1 ring-green-100">
                                📊
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Excel Dinas {MONTHS[bulan]} {tahun}</h3>
                                <p className="text-sm font-medium text-gray-500 mt-0.5">10 Sheet Laporan Lengkap</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <div className="text-sm flex items-center justify-between py-1">
                            <span className="text-gray-500">Status:</span>
                            <span className={`font-medium ${excelDoc ? "text-green-600" : "text-gray-500"}`}>
                                {excelDoc ? "✅ Siap didownload" : "⚪ Belum digenerate"}
                            </span>
                        </div>
                        {excelDoc && (
                           <div className="text-xs text-gray-400 mt-1">Generated: {new Date(excelDoc.generated_at).toLocaleString("id-ID")}</div>
                        )}
                    </div>
                    
                    <div className="mt-auto flex flex-col gap-2">
                        {excelDoc && (
                            <a href={excelDoc.file_url} target="_blank" rel="noopener noreferrer" className="w-full py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium text-center transition-colors">
                                📥 Download Excel
                            </a>
                        )}
                        <button onClick={handleGenerateExcel} disabled={excelLoading} className="w-full py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50">
                            {excelLoading ? "⏳ Generating..." : excelDoc ? "🔄 Generate Ulang" : "➕ Generate Excel"}
                        </button>
                    </div>
                </div>


                {/* BAP */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 sm:p-8 flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700 pointer-events-none" />

                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center text-2xl shadow-sm ring-1 ring-gray-200">
                                📝
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 tracking-tight">BAP Kas</h3>
                                <p className="text-sm font-medium text-gray-500 mt-0.5">Berita Acara Sisa Kas</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mb-6 relative z-10">
                        <div className="text-sm flex items-center justify-between py-2 border-b border-gray-50">
                            <span className="text-gray-500 font-medium">Status:</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ring-inset ${!bapDoc ? "bg-gray-50 text-gray-400 ring-gray-200" : bapDoc.status === "draft" ? "bg-orange-50 text-orange-600 ring-orange-200" : bapDoc.status === "final" ? "bg-emerald-50 text-emerald-600 ring-emerald-200" : "bg-blue-50 text-blue-600 ring-blue-200"}`}>
                                {!bapDoc ? "⚪ Tidak Ada (N/A)" : bapDoc.status === "draft" ? "📝 Draft (Belum TTD)" : bapDoc.status === "final" ? "✅ Final (Sudah TTD)" : "📤 Submitted"}
                            </span>
                        </div>
                        {!bapDoc && <div className="text-xs text-gray-400 mt-1 italic">Hanya dibuat jika ada pengembalian sisa dana kas ke negara</div>}
                        {bapDoc && (
                           <div className="text-xs text-gray-400 mt-1">Generated: {new Date(bapDoc.generated_at).toLocaleString("id-ID")}</div>
                        )}
                    </div>
                    
                    <div className="mt-auto flex flex-col gap-2">
                        {bapDoc && (
                            <div className="grid grid-cols-2 gap-2">
                                <a href={bapDoc.file_url} target="_blank" rel="noopener noreferrer" className="py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium text-center transition-colors">
                                    📥 Download PDF
                                </a>
                                {bapDoc.status === "draft" ? (
                                    <button onClick={() => handleUpdateStatus(bapDoc.id, "final")} className="py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                                        ✅ Tandai Final
                                    </button>
                                ) : bapDoc.status === "final" ? (
                                    <button onClick={() => handleUpdateStatus(bapDoc.id, "submitted")} className="py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                                        📤 Tandai Submitted
                                    </button>
                                ) : (
                                    <div className="py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium text-center">✔ Submitted</div>
                                )}
                            </div>
                        )}
                        <button onClick={handleGenerateBAP} disabled={bapLoading} title="Hanya akan berhasil jika ada Sisa Kas setelah perhitungan operasional" className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50">
                            {bapLoading ? "⏳ Generating..." : bapDoc ? "🔄 Generate Ulang" : "➕ Generate BAP (Cek Sisa)"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Log Transaksi & Pengeluaran</h2>
                <Link href="/pembukuan/dokumen" className="text-sm text-blue-600 font-bold hover:text-blue-700 transition-colors flex items-center gap-1 group">
                    Kumpulan Dokumen <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
            </div>

            {/* ─── Filter Bar ─────────────────────────────────── */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-5 overflow-visible z-20 relative">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="w-24">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Bulan</label>
                        <select
                            value={bulan}
                            onChange={(e) => { setBulan(Number(e.target.value)); setPage(0); }}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm w-full font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                            {MONTHS_FULL.slice(1).map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-24">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Tahun</label>
                        <input
                            type="number"
                            value={tahun}
                            onChange={(e) => { setTahun(Number(e.target.value)); setPage(0); }}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm w-full font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Status</label>
                        <select
                            value={status}
                            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm w-full font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                            <option value="all">Semua Status</option>
                            <option value="pending_confirm">⏳ Siap Dikonfirmasi</option>
                            <option value="unmapped_hold">⚠️ Pemetaan Tertunda</option>
                            <option value="confirmed">✅ Confirmed</option>
                            <option value="processing">⚙️ Processing</option>
                            <option value="failed">❌ Failed</option>
                        </select>
                    </div>
                    <div className="w-40">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Kategori</label>
                        <select
                            value={juknisCat}
                            onChange={(e) => { setJuknisCat(e.target.value); setPage(0); }}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm w-full font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                            <option value="all">Semua</option>
                            <option value="bahan_pangan">🥦 Bahan Pangan</option>
                            <option value="operasional">⚙️ Operasional</option>
                            <option value="insentif">👷 Insentif</option>
                            <option value="dana_masuk">💰 Dana Masuk</option>
                            <option value="lainnya">📦 Lainnya</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Supplier</label>
                        <input
                            type="text"
                            placeholder="Cari by nama supplier..."
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm w-full font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setPage(0); fetchData(); }}
                            className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 shadow-md shadow-gray-900/10 transition-all active:scale-95"
                        >
                            Cari
                        </button>
                        <button
                            onClick={() => { setBulan(now.getMonth() + 1); setTahun(now.getFullYear()); setStatus("all"); setSupplier(""); setPage(0); }}
                            className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-95"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Summary Cards ──────────────────────────────── */}
            {monthly && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-4">
                    <StatCard title="Total Transaksi" value={`${monthly.expenses.count} nota`} icon="🧾" />
                    <StatCard title="Total Belanja Struk/Kas" value={formatRp(monthly.expenses.total)} subtitle="*Belum termasuk target Gaji/Ops" icon="💸" />
                    <StatCard title="Hutang Outstanding" value={formatRp(monthly.expenses.hutang_outstanding)} icon="📋" />
                    <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 flex flex-col items-center justify-center gap-2 hover:-translate-y-0.5 transition-all">
                        <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-1">Status Laporan</span>
                        {monthly.excel_status === "ready" ? (
                             <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-green-600 flex items-center gap-2 tracking-tight">
                                <span className="bg-emerald-100/50 w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 text-lg">✅</span>
                                Siap Diunduh
                             </span>
                        ) : (
                             <span className="text-lg font-bold text-gray-400 tracking-tight">—</span>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Banner: Nota Siap Dikonfirmasi ────────────────────────── */}
            {transactions.some(t => t.status === "pending_confirm" || t.status === "unmapped_hold") && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">⏳</span>
                        <div>
                            <p className="font-bold text-blue-950">Ada nota yang siap dikonfirmasi pembayarannya!</p>
                            <p className="text-xs text-blue-700">Pilih metode pembayaran (Tunai/Hutang/Transfer) lalu konfirmasi agar stok bahan langsung bertambah ke database.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setStatus("pending_confirm")}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all"
                    >
                        Filter Siap Dikonfirmasi ({transactions.filter(t => t.status === "pending_confirm" || t.status === "unmapped_hold").length})
                    </button>
                </div>
            )}

            {/* ─── Warning: Nota Stale ─────────────────────────── */}
            {stalCount > 0 && (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                    ⚠️ <strong>{stalCount} nota</strong>&nbsp;belum dikonfirmasi lebih dari 24 jam
                </div>
            )}

            {/* ─── Tabel Transaksi ──────────────────────────────── */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden mt-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-gray-400 font-medium">Memuat data...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-12 text-red-500">{error}</div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                        <span className="text-5xl mb-4 grayscale opacity-30">📭</span>
                        <p className="text-lg font-semibold text-gray-900">Tidak ada transaksi</p>
                        <p className="text-sm mt-1">Belum ada nota yang tercatat pada periode ini</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50/50">
                                    <tr className="border-b border-gray-100 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                                        <th className="text-left px-6 py-4 whitespace-nowrap">Tanggal</th>
                                        <th className="text-left px-6 py-4 whitespace-nowrap">Supplier</th>
                                        <th className="text-center px-6 py-4 whitespace-nowrap">Items</th>
                                        <th className="text-right px-6 py-4 whitespace-nowrap">Total</th>
                                        <th className="text-center px-6 py-4 whitespace-nowrap">Kategori</th>
                                        <th className="text-center px-6 py-4 whitespace-nowrap">Status</th>
                                        <th className="text-right px-6 py-4 whitespace-nowrap">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((trx, i) => {
                                        return (
                                            <tr key={trx.id} className={`group hover:bg-gray-50/70 transition-colors ${i !== transactions.length - 1 ? "border-b border-gray-50" : ""}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                                                    {new Date(trx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-gray-900 max-w-[180px] truncate" title={trx.nama_toko}>{trx.nama_toko || "—"}</td>
                                                <td className="px-6 py-4 text-center text-gray-500 font-mono">{trx.items_count ?? "—"}</td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-900 whitespace-nowrap font-mono tracking-tight">{formatRp(trx.total)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {(() => {
                                                        const cat = trx.juknis_category || "lainnya";
                                                        const colors: Record<string, string> = {
                                                            bahan_pangan: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
                                                            operasional: "bg-blue-50 text-blue-700 ring-blue-600/20",
                                                            insentif: "bg-purple-50 text-purple-700 ring-purple-600/20",
                                                            dana_masuk: "bg-amber-50 text-amber-700 ring-amber-600/20",
                                                            lainnya: "bg-gray-50 text-gray-600 ring-gray-600/20",
                                                        };
                                                        const labels: Record<string, string> = {
                                                            bahan_pangan: "Bahan",
                                                            operasional: "Ops",
                                                            insentif: "Insentif",
                                                            dana_masuk: "Dana Masuk",
                                                            lainnya: "Lain",
                                                        };
                                                        return (
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${colors[cat] || colors.lainnya}`}>
                                                                {labels[cat] || cat}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-center"><StatusBadge status={trx.status} /></td>
                                                <td className="px-6 py-4 text-right w-44">
                                                    <div className="flex flex-row-reverse items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Link href={`/pembukuan/${trx.id}`} className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 text-xs font-bold tracking-wide shadow-sm transition-all whitespace-nowrap">Detail</Link>
                                                        {trx.status !== "confirmed" && trx.status !== "failed" && (
                                                            <button
                                                                onClick={() => {
                                                                    setConfirmModalTrx(trx);
                                                                    setConfirmPaymentMethod(trx.payment_method || "cash");
                                                                    setConfirmNotes("");
                                                                }}
                                                                className="inline-flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                                            >
                                                                ✅ Konfirmasi
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setDeleteModalTrx(trx)}
                                                            className="inline-flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                                            title="Hapus / batalkan nota"
                                                        >
                                                            🗑️ Hapus
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
                            <span>{page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, totalCount)} dari {totalCount}</span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 0}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-40"
                                >← Prev</button>
                                <button
                                    disabled={(page + 1) * LIMIT >= totalCount}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-40"
                                >Next →</button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal Biaya Operasional */}
            <BaseModal isOpen={showOpsModal} onClose={() => setShowOpsModal(false)} title="Catat Biaya Operasional" maxWidth="max-w-sm">
                        <form onSubmit={handleSaveOps} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nama Biaya</label>
                                <input required placeholder="Contoh: Beli Gas 3kg" value={opsForm.name} onChange={e => setOpsForm({...opsForm, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Nominal (Rp)</label>
                                <input required type="number" min="0" value={opsForm.amount} onChange={e => setOpsForm({...opsForm, amount: e.target.value})} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Tanggal</label>
                                <input required type="date" value={opsForm.cost_date} onChange={e => setOpsForm({...opsForm, cost_date: e.target.value})} className="w-full p-2 border rounded-lg" />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="is_recurring" checked={opsForm.is_recurring} onChange={e => setOpsForm({...opsForm, is_recurring: e.target.checked})} className="w-4 h-4 rounded text-blue-600" />
                                <label htmlFor="is_recurring" className="text-sm font-medium">Biaya Rutin Bulanan</label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Catatan (Opsional)</label>
                                <textarea value={opsForm.notes} onChange={e => setOpsForm({...opsForm, notes: e.target.value})} className="w-full p-2 border rounded-lg" rows={2} />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowOpsModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium cursor-pointer">Batal</button>
                                <button type="submit" disabled={opsSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer">
                                    {opsSaving ? "Menyimpan..." : "Simpan"}
                                </button>
                            </div>
                        </form>
            </BaseModal>

            {/* ─── MODAL KONFIRMASI PEMBAYARAN & UPDATE STOK ─── */}
            <BaseModal isOpen={!!confirmModalTrx} onClose={() => setConfirmModalTrx(null)} title="✅ Konfirmasi Nota & Update Stok" maxWidth="max-w-md">
                {confirmModalTrx && (<>

                        <div className="rounded-xl bg-gray-50 p-3 text-xs space-y-1 border border-gray-100">
                            <p className="text-gray-500">Toko / Supplier: <strong className="text-gray-800">{confirmModalTrx.nama_toko || "Nota"}</strong></p>
                            <p className="text-gray-500">Tanggal: <strong className="text-gray-800">{confirmModalTrx.date}</strong></p>
                            <p className="text-gray-500">Total Nominal: <strong className="text-emerald-700 font-bold">{formatRp(confirmModalTrx.total)}</strong></p>
                        </div>

                        <form onSubmit={handleConfirmSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Metode Pembayaran
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: "cash", label: "💵 Tunai", desc: "Kas Keluar" },
                                        { id: "hutang", label: "💳 Hutang", desc: "Kredit/Payable" },
                                        { id: "transfer", label: "🏦 Transfer", desc: "Bank" },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setConfirmPaymentMethod(m.id)}
                                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                                confirmPaymentMethod === m.id
                                                    ? "border-blue-600 bg-blue-50/70 text-blue-900 font-bold ring-2 ring-blue-500/20"
                                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                            }`}
                                        >
                                            <div className="text-xs">{m.label}</div>
                                            <div className="text-[10px] text-gray-400 font-normal">{m.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Catatan Konfirmasi (Opsional)</label>
                                <textarea
                                    value={confirmNotes}
                                    onChange={(e) => setConfirmNotes(e.target.value)}
                                    placeholder="Tambahkan catatan jika ada..."
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none"
                                    rows={2}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button
                                    type="button"
                                    onClick={() => setConfirmModalTrx(null)}
                                    className="px-4 py-2 border rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={confirmSubmitting}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                >
                                    {confirmSubmitting ? "Memproses..." : "✅ Konfirmasi & Update Stok"}
                                </button>
                            </div>
                        </form>
                </>)}
            </BaseModal>

            {/* Modal Konfirmasi Hapus Nota */}
            <BaseModal isOpen={!!deleteModalTrx} onClose={() => setDeleteModalTrx(null)} title="🗑️ Konfirmasi Hapus Nota" maxWidth="max-w-md">
                {deleteModalTrx && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700">
                            Apakah Anda yakin ingin menghapus nota dari <strong>{deleteModalTrx.nama_toko || "Supplier"}</strong> ({formatRp(deleteModalTrx.total)})?
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 space-y-1">
                            <p className="font-bold">⚠️ Efek Penghapusan Nota:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>Status nota akan dibatalkan/voided.</li>
                                <li>Stok bahan baku akan dikurangi/dikoreksi kembali otomatis.</li>
                                <li>Catatan transaksi di Pembukuan & Arus Kas akan dibersihkan.</li>
                            </ul>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalTrx(null)}
                                disabled={deleteSubmitting}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSubmit}
                                disabled={deleteSubmitting}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                {deleteSubmitting ? "Menghapus..." : "🗑️ Ya, Hapus Permanen"}
                            </button>
                        </div>
                    </div>
                )}
            </BaseModal>
        </div>
    );
}
