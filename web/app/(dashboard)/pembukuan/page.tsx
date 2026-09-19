"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { BaseModal } from "@/components/ui/BaseModal";
import { 
  Receipt, 
  FileSpreadsheet, 
  FileText, 
  Search, 
  Plus, 
  Filter, 
  RotateCcw, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  Trash2,
  Check,
  ChevronRight,
  DollarSign
} from "lucide-react";

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
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-8">
            
            {/* ─── Page Header with Actions ────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[11px] font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Buku Kas & Rekonsiliasi
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-500">{MONTHS_FULL[bulan]} {tahun}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                        Pembukuan & Nota Belanja
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                        Rekam transaksi belanja pasar, verifikasi ekstraksi AI OCR, dan unduh laporan pertanggungjawaban dinas.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowOpsModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Catat Biaya Operasional</span>
                    </button>
                </div>
            </div>

            {/* ─── DOKUMEN LEGAL & EXCEL SECTION ──────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                
                {/* EXCEL DINAS */}
                <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
                    
                    <div>
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                                    <FileSpreadsheet className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                            Excel Dinas Juknis BGN
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">
                                            10 Sheet
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Periode: <span className="font-semibold text-slate-700">{MONTHS_FULL[bulan]} {tahun}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-5 p-3 rounded-2xl bg-slate-50/80 border border-slate-200/60 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Status Arsip:</span>
                                <span className={`inline-flex items-center gap-1.5 font-bold ${excelDoc ? "text-emerald-700" : "text-slate-500"}`}>
                                    <span className={`w-2 h-2 rounded-full ${excelDoc ? "bg-emerald-500" : "bg-slate-400"}`} />
                                    {excelDoc ? "Siap Diunduh (Valid)" : "Belum Digenerate"}
                                </span>
                            </div>
                            {excelDoc && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Diperbarui: {new Date(excelDoc.generated_at).toLocaleString("id-ID")}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 relative z-10">
                        {excelDoc && (
                            <a 
                                href={excelDoc.file_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                <span>Unduh Format Dinas Resmi (.xlsx)</span>
                            </a>
                        )}
                        <button 
                            onClick={handleGenerateExcel} 
                            disabled={excelLoading} 
                            className="w-full py-2.5 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-700 hover:text-emerald-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {excelLoading ? (
                                <>
                                    <Clock className="w-4 h-4 animate-spin text-emerald-600" />
                                    <span>Menyusun Laporan Excel...</span>
                                </>
                            ) : excelDoc ? (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Kompilasi Ulang Data</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 text-emerald-600" />
                                    <span>Buat Excel Laporan Bulanan</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* BAP KAS */}
                <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />

                    <div>
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                            BAP Rekonsiliasi Kas
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold">
                                            Berita Acara
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">Pertanggungjawaban Sisa Saldo Kas</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mb-5 p-3 rounded-2xl bg-slate-50/80 border border-slate-200/60 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Status Pengesahan:</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                    !bapDoc 
                                        ? "bg-slate-100 text-slate-500 border-slate-200" 
                                        : bapDoc.status === "draft" 
                                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                                        : bapDoc.status === "final" 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}>
                                    {!bapDoc ? "⚪ Belum Ada (N/A)" : bapDoc.status === "draft" ? "📝 Draft TTD" : bapDoc.status === "final" ? "✅ Final & Ditandatangani" : "📤 Submitted"}
                                </span>
                            </div>
                            {!bapDoc && (
                                <p className="text-[11px] text-slate-400 mt-1 italic">
                                    Dibuat otomatis jika terdapat pengembalian sisa dana kas dinas.
                                </p>
                            )}
                            {bapDoc && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Generated: {new Date(bapDoc.generated_at).toLocaleString("id-ID")}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 relative z-10">
                        {bapDoc && (
                            <div className="grid grid-cols-2 gap-2">
                                <a 
                                    href={bapDoc.file_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Unduh PDF</span>
                                </a>
                                {bapDoc.status === "draft" ? (
                                    <button 
                                        onClick={() => handleUpdateStatus(bapDoc.id, "final")} 
                                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                                    >
                                        ✅ Tandai Final
                                    </button>
                                ) : bapDoc.status === "final" ? (
                                    <button 
                                        onClick={() => handleUpdateStatus(bapDoc.id, "submitted")} 
                                        className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                                    >
                                        📤 Tandai Submitted
                                    </button>
                                ) : (
                                    <div className="py-2.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Terkirim</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <button 
                            onClick={handleGenerateBAP} 
                            disabled={bapLoading} 
                            className="w-full py-2.5 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-700 hover:text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {bapLoading ? (
                                <>
                                    <Clock className="w-4 h-4 animate-spin text-indigo-600" />
                                    <span>Memproses BAP...</span>
                                </>
                            ) : bapDoc ? (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Generate Ulang BAP</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 text-indigo-600" />
                                    <span>Hitung Sisa & Terbitkan BAP</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                        <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                            Log Transaksi & Pengeluaran
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">Daftar rekonsiliasi belanja bahan baku, operasional, dan arus kas.</p>
                    </div>
                </div>
                <Link 
                    href="/pembukuan/dokumen" 
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all group border border-slate-200/60"
                >
                    <span>Kumpulan Dokumen</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-slate-500" />
                </Link>
            </div>

            {/* ─── Filter Bar ─────────────────────────────────── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-5 sm:p-6 overflow-visible z-20 relative">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="w-28">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Bulan</label>
                        <select
                            value={bulan}
                            onChange={(e) => { setBulan(Number(e.target.value)); setPage(0); }}
                            className="bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm w-full font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                        >
                            {MONTHS_FULL.slice(1).map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-24">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Tahun</label>
                        <input
                            type="number"
                            value={tahun}
                            onChange={(e) => { setTahun(Number(e.target.value)); setPage(0); }}
                            className="bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm w-full font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                        />
                    </div>
                    <div className="w-40">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Status</label>
                        <select
                            value={status}
                            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
                            className="bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm w-full font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Kategori</label>
                        <select
                            value={juknisCat}
                            onChange={(e) => { setJuknisCat(e.target.value); setPage(0); }}
                            className="bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm w-full font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                        >
                            <option value="all">Semua Kategori</option>
                            <option value="bahan_pangan">🥦 Bahan Pangan</option>
                            <option value="operasional">⚙️ Operasional</option>
                            <option value="insentif">👷 Insentif</option>
                            <option value="dana_masuk">💰 Dana Masuk</option>
                            <option value="lainnya">📦 Lainnya</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Supplier / Toko</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Cari nama supplier atau toko..."
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                                className="bg-slate-50/80 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm w-full font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setPage(0); fetchData(); }}
                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-slate-900/10 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                            <Search className="w-3.5 h-3.5" />
                            <span>Cari</span>
                        </button>
                        <button
                            onClick={() => { setBulan(now.getMonth() + 1); setTahun(now.getFullYear()); setStatus("all"); setSupplier(""); setPage(0); }}
                            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Summary Cards ──────────────────────────────── */}
            {monthly && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <StatCard 
                        title="Total Transaksi" 
                        value={`${monthly.expenses.count} nota`} 
                        subtitle={`Periode ${MONTHS_FULL[bulan]}`}
                        icon="🧾" 
                        accentColor="blue"
                    />
                    <StatCard 
                        title="Total Belanja Struk" 
                        value={formatRp(monthly.expenses.total)} 
                        subtitle="Belum termasuk insentif/gaji" 
                        icon="💸" 
                        accentColor="emerald"
                    />
                    <StatCard 
                        title="Hutang Outstanding" 
                        value={formatRp(monthly.expenses.hutang_outstanding)} 
                        subtitle="Kewajiban bayar tempo"
                        icon="📋" 
                        accentColor="amber"
                    />
                    <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-5 sm:p-6 flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Laporan</span>
                            <span className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center text-sm font-bold">
                                📊
                            </span>
                        </div>
                        <div className="my-2">
                            {monthly.excel_status === "ready" ? (
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-base sm:text-lg font-extrabold text-emerald-700 tracking-tight">
                                        Siap Diunduh
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                                    <span className="text-base sm:text-lg font-extrabold text-slate-500 tracking-tight">
                                        Menunggu Rekap
                                    </span>
                                </div>
                            )}
                            <p className="text-[11px] text-slate-400 mt-0.5">Kompilasi 10 Sheet Dinas BGN</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Banner: Nota Siap Dikonfirmasi ────────────────────────── */}
            {transactions.some(t => t.status === "pending_confirm" || t.status === "unmapped_hold") && (
                <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-blue-500/10 border border-amber-400/30 rounded-3xl p-5 sm:p-6 backdrop-blur-md relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
                            <Clock className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <p className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                                Terdapat nota belanja yang siap dikonfirmasi!
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5 font-medium">
                                Pilih metode bayar (Tunai, Hutang, Transfer) lalu konfirmasi agar stok bahan baku langsung disinkronkan ke gudang.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setStatus("pending_confirm")}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 cursor-pointer transition-all shrink-0 hover:-translate-y-0.5"
                    >
                        Tampilkan Siap Dikonfirmasi ({transactions.filter(t => t.status === "pending_confirm" || t.status === "unmapped_hold").length})
                    </button>
                </div>
            )}

            {/* ─── Warning: Nota Stale ─────────────────────────── */}
            {stalCount > 0 && (
                <div className="flex items-center gap-3 bg-rose-50/80 border border-rose-200/80 text-rose-800 px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold backdrop-blur-sm">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>
                        <strong className="font-extrabold text-rose-900">{stalCount} nota belanja</strong> belum dikonfirmasi selama lebih dari 24 jam. Harap segera periksa untuk menjaga akurasi saldo kas harian.
                    </span>
                </div>
            )}

            {/* ─── Tabel Transaksi ──────────────────────────────── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-xs sm:text-sm text-slate-500 font-semibold">Memuat riwayat transaksi...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-16 text-rose-600 font-bold text-sm bg-rose-50/40">
                        {error}
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-24 text-slate-400 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4 text-slate-400">
                            🧾
                        </div>
                        <p className="text-base font-extrabold text-slate-800">Tidak ada transaksi ditemukan</p>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
                            Belum ada nota belanja atau pengeluaran yang tercatat pada periode dan filter yang dipilih.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-xs sm:text-sm">
                                <thead className="bg-slate-50/70 border-b border-slate-200/80">
                                    <tr className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500">
                                        <th className="text-left px-6 py-4 whitespace-nowrap">Tanggal</th>
                                        <th className="text-left px-6 py-4 whitespace-nowrap">Supplier / Toko</th>
                                        <th className="text-center px-6 py-4 whitespace-nowrap">Item</th>
                                        <th className="text-right px-6 py-4 whitespace-nowrap">Total Nominal</th>
                                        <th className="text-center px-6 py-4 whitespace-nowrap">Kategori</th>
                                        <th className="text-center px-6 py-4 whitespace-nowrap">Status</th>
                                        <th className="text-right px-6 py-4 whitespace-nowrap">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {transactions.map((trx) => {
                                        return (
                                            <tr 
                                                key={trx.id} 
                                                className="group hover:bg-slate-50/80 transition-colors"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-semibold">
                                                    {new Date(trx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-900 max-w-[200px] truncate" title={trx.nama_toko}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-indigo-600 transition-colors" />
                                                        <span className="truncate">{trx.nama_toko || "—"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                                                        {trx.items_count ?? "—"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap font-mono tracking-tight text-sm">
                                                    {formatRp(trx.total)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {(() => {
                                                        const cat = trx.juknis_category || "lainnya";
                                                        const colors: Record<string, string> = {
                                                            bahan_pangan: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
                                                            operasional: "bg-blue-500/10 text-blue-700 border-blue-500/30",
                                                            insentif: "bg-purple-500/10 text-purple-700 border-purple-500/30",
                                                            dana_masuk: "bg-amber-500/10 text-amber-700 border-amber-500/30",
                                                            lainnya: "bg-slate-500/10 text-slate-700 border-slate-500/30",
                                                        };
                                                        const labels: Record<string, string> = {
                                                            bahan_pangan: "🥦 Bahan",
                                                            operasional: "⚙️ Ops",
                                                            insentif: "👷 Insentif",
                                                            dana_masuk: "💰 Dana Masuk",
                                                            lainnya: "📦 Lain",
                                                        };
                                                        return (
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${colors[cat] || colors.lainnya}`}>
                                                                {labels[cat] || cat}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <StatusBadge status={trx.status} />
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link 
                                                            href={`/pembukuan/${trx.id}`} 
                                                            className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all"
                                                        >
                                                            Detail
                                                        </Link>
                                                        {trx.status !== "confirmed" && trx.status !== "failed" && (
                                                            <button
                                                                onClick={() => {
                                                                    setConfirmModalTrx(trx);
                                                                    setConfirmPaymentMethod(trx.payment_method || "cash");
                                                                    setConfirmNotes("");
                                                                }}
                                                                className="inline-flex items-center gap-1 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer hover:-translate-y-0.5"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Konfirmasi</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setDeleteModalTrx(trx)}
                                                            className="inline-flex items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                                            title="Hapus / batalkan nota"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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
                        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-100 text-xs font-semibold text-slate-500 gap-3">
                            <span>Menampilkan {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, totalCount)} dari {totalCount} total transaksi</span>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={page === 0}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-3.5 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent font-bold transition-colors cursor-pointer"
                                >
                                    ← Sebelumnya
                                </button>
                                <button
                                    disabled={(page + 1) * LIMIT >= totalCount}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3.5 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent font-bold transition-colors cursor-pointer"
                                >
                                    Selanjutnya →
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal Biaya Operasional */}
            <BaseModal isOpen={showOpsModal} onClose={() => setShowOpsModal(false)} title="Catat Biaya Operasional" maxWidth="max-w-md">
                <form onSubmit={handleSaveOps} className="space-y-4 pt-1">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nama Biaya Operasional</label>
                        <input 
                            required 
                            placeholder="Contoh: Gas Elpiji 12kg, Kantong Plastik, Tissue" 
                            value={opsForm.name} 
                            onChange={e => setOpsForm({...opsForm, name: e.target.value})} 
                            className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nominal (Rp)</label>
                            <input 
                                required 
                                type="number" 
                                min="0" 
                                placeholder="0"
                                value={opsForm.amount} 
                                onChange={e => setOpsForm({...opsForm, amount: e.target.value})} 
                                className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tanggal</label>
                            <input 
                                required 
                                type="date" 
                                value={opsForm.cost_date} 
                                onChange={e => setOpsForm({...opsForm, cost_date: e.target.value})} 
                                className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                        <input 
                            type="checkbox" 
                            id="is_recurring" 
                            checked={opsForm.is_recurring} 
                            onChange={e => setOpsForm({...opsForm, is_recurring: e.target.checked})} 
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/20 cursor-pointer" 
                        />
                        <label htmlFor="is_recurring" className="text-xs font-semibold text-slate-700 cursor-pointer">
                            Biaya Rutin Bulanan (Tetap)
                        </label>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Catatan Tambahan (Opsional)</label>
                        <textarea 
                            value={opsForm.notes} 
                            onChange={e => setOpsForm({...opsForm, notes: e.target.value})} 
                            className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400" 
                            rows={2} 
                            placeholder="Keterangan pengadaan atau bukti fisik..."
                        />
                    </div>
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={() => setShowOpsModal(false)} 
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl cursor-pointer transition-colors"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit" 
                            disabled={opsSaving} 
                            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer transition-all"
                        >
                            {opsSaving ? "Menyimpan..." : "Simpan Operasional"}
                        </button>
                    </div>
                </form>
            </BaseModal>

            {/* ─── MODAL KONFIRMASI PEMBAYARAN & UPDATE STOK ─── */}
            <BaseModal isOpen={!!confirmModalTrx} onClose={() => setConfirmModalTrx(null)} title="Konfirmasi Nota & Sinkronisasi Stok" maxWidth="max-w-md">
                {confirmModalTrx && (
                    <div className="space-y-4 pt-1">
                        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 text-xs space-y-1.5 border border-slate-200/80">
                            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                                <span className="text-slate-500 font-medium">Supplier / Toko</span>
                                <strong className="text-slate-900 font-bold">{confirmModalTrx.nama_toko || "Nota Belanja"}</strong>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">Tanggal Transaksi</span>
                                <strong className="text-slate-800 font-semibold">{confirmModalTrx.date}</strong>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                                <span className="text-slate-500 font-medium">Total Tagihan</span>
                                <strong className="text-emerald-700 font-black text-sm">{formatRp(confirmModalTrx.total)}</strong>
                            </div>
                        </div>

                        <form onSubmit={handleConfirmSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Metode Pembayaran
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: "cash", label: "💵 Tunai", desc: "Kas Keluar" },
                                        { id: "hutang", label: "💳 Hutang", desc: "Tempo/Kredit" },
                                        { id: "transfer", label: "🏦 Bank", desc: "Transfer" },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setConfirmPaymentMethod(m.id)}
                                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                                confirmPaymentMethod === m.id
                                                    ? "border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-sm"
                                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="text-xs font-bold">{m.label}</div>
                                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">{m.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Catatan Konfirmasi (Opsional)
                                </label>
                                <textarea
                                    value={confirmNotes}
                                    onChange={(e) => setConfirmNotes(e.target.value)}
                                    placeholder="Tambahkan nomor referensi transfer atau catatan..."
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                                    rows={2}
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setConfirmModalTrx(null)}
                                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl cursor-pointer transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={confirmSubmitting}
                                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{confirmSubmitting ? "Memproses..." : "Konfirmasi & Update Stok"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </BaseModal>

            {/* Modal Konfirmasi Hapus Nota */}
            <BaseModal isOpen={!!deleteModalTrx} onClose={() => setDeleteModalTrx(null)} title="Konfirmasi Pembatalan Nota" maxWidth="max-w-md">
                {deleteModalTrx && (
                    <div className="space-y-4 pt-1">
                        <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                            Apakah Anda yakin ingin membatalkan/menghapus nota dari <strong className="text-slate-900 font-bold">{deleteModalTrx.nama_toko || "Supplier"}</strong> senilai <strong className="text-rose-600 font-extrabold">{formatRp(deleteModalTrx.total)}</strong>?
                        </p>
                        <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-3.5 text-xs text-rose-800 space-y-1.5">
                            <p className="font-extrabold flex items-center gap-1.5 text-rose-900">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>Konsekuensi Otomatis:</span>
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-rose-700 text-[11px] font-medium pl-1">
                                <li>Status nota belanja akan di-void secara permanen.</li>
                                <li>Stok bahan baku gudang akan dikoreksi kembali otomatis.</li>
                                <li>Data arus kas dan buku besar terkait akan dibersihkan.</li>
                            </ul>
                        </div>
                        <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setDeleteModalTrx(null)}
                                disabled={deleteSubmitting}
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSubmit}
                                disabled={deleteSubmitting}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{deleteSubmitting ? "Menghapus..." : "Ya, Hapus Permanen"}</span>
                            </button>
                        </div>
                    </div>
                )}
            </BaseModal>
        </div>
    );
}
