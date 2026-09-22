"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { BaseModal } from "@/components/ui/BaseModal";
import { 
  Receipt, 
  Store, 
  Calendar, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ExternalLink, 
  Maximize2, 
  FileText, 
  PackageCheck, 
  Trash2, 
  Check, 
  Sparkles,
  ShoppingBag,
  Layers,
  UserCheck
} from "lucide-react";

interface TransactionItem {
    id: string;
    product_name: string;
    qty: string;
    unit: string;
    price: string;
    subtotal: string;
    product_id?: string;
    alias_matched?: string;
}

interface StockHistoryEntry {
    id: string;
    created_at: string;
    product_name?: string;
    change_qty: string;
    unit?: string;
    reason?: string;
}

interface TransactionDetail {
    id: string;
    date: string;
    nama_toko: string;
    supplier_id?: string;
    payment_method: string;
    due_date?: string;
    created_at: string;
    confirmed_at?: string;
    created_by?: string;
    status: string;
    source?: string;
    photo_url?: string;
    total: string;

    items: TransactionItem[];
    stock_history?: StockHistoryEntry[];
}

function formatRp(val: string | number): string {
    const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
        .format(n).replace("IDR", "Rp");
}

function formatDate(iso?: string): string {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("id-ID", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch { return iso; }
}

export default function TransactionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [trx, setTrx] = useState<TransactionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [photoOpen, setPhotoOpen] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [confirmNotes, setConfirmNotes] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const r = await apiGet(`/transactions/${id}`);
                setTrx(r?.data ?? r);
            } catch {
                setError("Transaksi tidak ditemukan atau terjadi error sistem.");
            } finally {
                setLoading(false);
            }
        };
        if (id) fetch();
    }, [id]);

    const handleConfirmSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setConfirmLoading(true);
        try {
            await apiPost(`/transactions/${id}/confirm`, {
                payment_method: paymentMethod,
                notes: confirmNotes || undefined,
            });
            alert("✅ Transaksi berhasil dikonfirmasi! Stok gudang telah diperbarui.");
            setShowConfirmModal(false);
            router.push("/pembukuan");
        } catch {
            alert("Gagal mengonfirmasi transaksi.");
            setConfirmLoading(false);
        }
    };

    const handleDelete = async () => {
        setDeleteLoading(true);
        try {
            await apiDelete(`/transactions/${id}`);
            alert("✅ Transaksi berhasil dihapus dan data stok terkait telah disesuaikan.");
            setShowDeleteModal(false);
            router.push("/pembukuan");
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Gagal membatalkan transaksi.");
            setDeleteLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-28 space-y-4">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-xs sm:text-sm font-semibold text-slate-500">Memuat rincian transaksi nota...</p>
            </div>
        );
    }

    if (error || !trx) {
        return (
            <div className="text-center py-24 space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-2xl border border-rose-200/60">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800">Data Transaksi Tidak Ditemukan</h3>
                <p className="text-xs sm:text-sm text-slate-500">{error ?? "ID transaksi tidak valid atau telah dihapus."}</p>
                <Link 
                    href="/pembukuan" 
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-slate-800 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Kembali ke Pembukuan</span>
                </Link>
            </div>
        );
    }

    const subtotal = trx.items.reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fade-in">
            
            {/* ─── Breadcrumb & Top Bar ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                    <Link 
                        href="/pembukuan" 
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors mb-2 group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        <span>Kembali ke Daftar Transaksi</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                            {trx.nama_toko || "Nota Belanja"}
                        </h1>
                        <StatusBadge status={trx.status} />
                        {trx.source && (
                            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-600">
                                {trx.source}
                            </span>
                        )}
                    </div>
                    <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">
                        ID Transaksi: <span className="font-mono text-slate-700 font-semibold">{trx.id}</span> • Tanggal: <span className="text-slate-800 font-semibold">{new Date(trx.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    {trx.status !== "confirmed" && trx.status !== "failed" && (
                        <button
                            onClick={() => {
                                setPaymentMethod(trx.payment_method || "cash");
                                setShowConfirmModal(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 transition-all cursor-pointer"
                        >
                            <Check className="w-4 h-4" />
                            <span>Konfirmasi & Sinkron Stok</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200/80 bg-rose-50/50 hover:bg-rose-100/60 text-rose-600 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                        title="Hapus / batalkan nota ini"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Hapus Nota</span>
                    </button>
                </div>
            </div>

            {/* ─── Main 2-Column Grid ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* ─── Kolom Kiri: Foto Slip Nota & Dokumen Audit (4/12) ─── */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Slip Foto Nota */}
                    <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-5 sm:p-6 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
                                    <Receipt className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Dokumen Fisik Nota</h3>
                            </div>
                            {trx.photo_url && (
                                <button
                                    onClick={() => setPhotoOpen(true)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                    title="Lihat ukuran penuh"
                                >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {trx.photo_url ? (
                            <div className="space-y-3">
                                <div 
                                    className="relative rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-950/5 group cursor-pointer aspect-[3/4] flex items-center justify-center"
                                    onClick={() => setPhotoOpen(true)}
                                >
                                    <img
                                        src={trx.photo_url}
                                        alt="Foto Nota Belanja"
                                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-sm text-slate-900 font-bold text-xs shadow-md flex items-center gap-1.5">
                                            <Maximize2 className="w-3.5 h-3.5" />
                                            Perbesar
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-medium">Format: Gambar Dokumen</span>
                                    <a 
                                        href={trx.photo_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1"
                                    >
                                        <span>Buka di Tab Baru</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 px-4 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 text-center space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                                    <Receipt className="w-6 h-6" />
                                </div>
                                <p className="text-xs font-bold text-slate-700">Foto Nota Tidak Terlampir</p>
                                <p className="text-xs text-slate-400">Transaksi dicatat manual atau melalui sistem integrasi kasir.</p>
                            </div>
                        )}
                    </div>

                    {/* Metadata & Audit Trail */}
                    <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-5 sm:p-6 space-y-4">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                                <FileText className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Rincian & Audit Kas</h3>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="flex justify-between items-center py-1">
                                <span className="text-slate-400 font-medium">Nama Toko</span>
                                <span className="font-bold text-slate-800 text-right">{trx.nama_toko || "—"}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-t border-slate-100/60">
                                <span className="text-slate-400 font-medium">Metode Bayar</span>
                                <span className="px-2.5 py-0.5 rounded-lg font-bold bg-blue-50 text-blue-700 border border-blue-200/60 uppercase text-xs">
                                    {trx.payment_method || "Tunai"}
                                </span>
                            </div>
                            {trx.due_date && (
                                <div className="flex justify-between items-center py-1 border-t border-slate-100/60">
                                    <span className="text-slate-400 font-medium">Jatuh Tempo</span>
                                    <span className="font-bold text-amber-700">
                                        {new Date(trx.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-1 border-t border-slate-100/60">
                                <span className="text-slate-400 font-medium">Dibuat Pada</span>
                                <span className="font-semibold text-slate-600 text-right">{formatDate(trx.created_at)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-t border-slate-100/60">
                                <span className="text-slate-400 font-medium">Dikonfirmasi</span>
                                <span className={`font-semibold text-right ${trx.confirmed_at ? "text-emerald-700" : "text-slate-400 italic"}`}>
                                    {trx.confirmed_at ? formatDate(trx.confirmed_at) : "Belum dikonfirmasi"}
                                </span>
                            </div>
                            {trx.created_by && (
                                <div className="flex justify-between items-center py-1 border-t border-slate-100/60">
                                    <span className="text-slate-400 font-medium">Dicatat Oleh</span>
                                    <span className="font-bold text-slate-700">{trx.created_by}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Kolom Kanan: Rincian Item Belanja & Riwayat Stok (8/12) ─── */}
                <div className="lg:col-span-8 space-y-6">
                    
                    {/* Item Belanja Table Card */}
                    <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                                    <ShoppingBag className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                                        Daftar Ekstraksi Bahan Belanja ({trx.items.length} Item)
                                    </h2>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Rincian kuantitas, harga satuan, dan pencocokan ke master bahan SPPG.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-xs sm:text-sm">
                                <thead className="bg-slate-50/70 border-b border-slate-200/80">
                                    <tr className="text-xs uppercase font-bold tracking-wider text-slate-500">
                                        <th className="text-left px-5 py-3.5 whitespace-nowrap">No</th>
                                        <th className="text-left px-5 py-3.5 whitespace-nowrap">Nama Bahan (Nota)</th>
                                        <th className="text-right px-5 py-3.5 whitespace-nowrap">Qty</th>
                                        <th className="text-left px-4 py-3.5 whitespace-nowrap">Satuan</th>
                                        <th className="text-right px-5 py-3.5 whitespace-nowrap">Harga Satuan</th>
                                        <th className="text-right px-5 py-3.5 whitespace-nowrap">Subtotal</th>
                                        <th className="text-left px-5 py-3.5 whitespace-nowrap">Master Bahan DB</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {trx.items.map((item, i) => (
                                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-5 py-3.5 text-slate-400 font-medium">{i + 1}</td>
                                            <td className="px-5 py-3.5 font-bold text-slate-900">
                                                {item.product_name}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">
                                                {parseFloat(item.qty).toLocaleString("id-ID")}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-500 font-medium">
                                                {item.unit || "—"}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono text-slate-600">
                                                {formatRp(item.price)}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-mono font-extrabold text-slate-900">
                                                {formatRp(item.subtotal)}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                {item.alias_matched ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-700">
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                        {item.alias_matched}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                                                        Belum Dipetakan
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Financial Calculation Summary Footer */}
                        <div className="p-5 sm:p-6 bg-slate-50/50 border-t border-slate-100 space-y-2">
                            <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                <span>Total Subtotal Item</span>
                                <span className="font-mono font-bold text-slate-700">{formatRp(subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200/70">
                                <span className="text-sm font-extrabold text-slate-900">Total Nilai Transaksi</span>
                                <span className="text-xl sm:text-2xl font-bold font-mono text-blue-700 tracking-tight">
                                    {formatRp(trx.total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stock Impact / Riwayat Mutasi Gudang Card */}
                    {trx.stock_history && trx.stock_history.length > 0 && (
                        <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-5 sm:p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                                    <PackageCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                                        Dampak Mutasi Stok Gudang
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Bahan baku yang otomatis ditambahkan ke kuota persediaan SPPG.
                                    </p>
                                </div>
                            </div>

                            <div className="divide-y divide-slate-100 text-xs">
                                {trx.stock_history.map((h) => {
                                    const isPositive = parseFloat(h.change_qty) >= 0;
                                    return (
                                        <div key={h.id} className="py-3 flex items-center justify-between first:pt-1 last:pb-1">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`} />
                                                <div>
                                                    <p className="font-bold text-slate-900">{h.product_name || "Bahan Baku"}</p>
                                                    <p className="text-xs text-slate-400">{h.reason || "Penerimaan Belanja Nota"}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-2.5 py-1 rounded-xl font-mono font-bold text-xs ${
                                                    isPositive ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" : "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                                                }`}>
                                                    {isPositive ? "+" : ""}{h.change_qty} {h.unit}
                                                </span>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {new Date(h.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox Modal for Receipt Photo */}
            <BaseModal isOpen={photoOpen} onClose={() => setPhotoOpen(false)} title="Foto Dokumen Fisik Nota" maxWidth="max-w-4xl">
                <div className="flex flex-col items-center justify-center p-2">
                    <img 
                        src={trx.photo_url} 
                        alt="Nota Full Resolution" 
                        className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-xl" 
                    />
                    <div className="mt-4 flex gap-3">
                        <a 
                            href={trx.photo_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all inline-flex items-center gap-1.5"
                        >
                            <span>Buka Ukuran Asli</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button 
                            type="button" 
                            onClick={() => setPhotoOpen(false)}
                            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                        >
                            Tutup Pratinjau
                        </button>
                    </div>
                </div>
            </BaseModal>

            {/* Modal Konfirmasi Pembayaran */}
            <BaseModal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Konfirmasi Pembayaran & Update Stok" maxWidth="max-w-md">
                <form onSubmit={handleConfirmSubmit} className="space-y-4 pt-1">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Metode Pembayaran</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: "cash", label: "💵 Tunai", desc: "Kas Keluar" },
                                { id: "hutang", label: "💳 Hutang", desc: "Tempo/Kredit" },
                                { id: "transfer", label: "🏦 Bank", desc: "Transfer" },
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setPaymentMethod(m.id)}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        paymentMethod === m.id
                                            ? "border-blue-600 bg-blue-50/80 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-sm"
                                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    <div className="text-xs font-bold">{m.label}</div>
                                    <div className="text-xs text-slate-400 font-normal mt-0.5">{m.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Catatan Konfirmasi (Opsional)</label>
                        <textarea
                            value={confirmNotes}
                            onChange={(e) => setConfirmNotes(e.target.value)}
                            placeholder="Keterangan transaksi atau referensi transfer..."
                            className="w-full px-3.5 py-2.5 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-400"
                            rows={2}
                        />
                    </div>
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={() => setShowConfirmModal(false)} 
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl cursor-pointer transition-colors"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit" 
                            disabled={confirmLoading} 
                            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span>{confirmLoading ? "Memproses..." : "Konfirmasi & Update Stok"}</span>
                        </button>
                    </div>
                </form>
            </BaseModal>

            {/* Modal Konfirmasi Hapus Nota */}
            <BaseModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Konfirmasi Pembatalan Nota" maxWidth="max-w-md">
                <div className="space-y-4 pt-1">
                    <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                        Apakah Anda yakin ingin membatalkan/menghapus nota dari <strong className="text-slate-900 font-bold">{trx.nama_toko || "Supplier"}</strong> senilai <strong className="text-rose-600 font-extrabold">{formatRp(trx.total)}</strong>?
                    </p>
                    <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-3.5 text-xs text-rose-800 space-y-1.5">
                        <p className="font-extrabold flex items-center gap-1.5 text-rose-900">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Konsekuensi Otomatis:</span>
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-rose-700 text-xs font-medium pl-1">
                            <li>Status nota belanja akan dibatalkan permanen.</li>
                            <li>Stok bahan baku gudang akan dikoreksi kembali otomatis.</li>
                            <li>Catatan transaksi di Pembukuan & Arus Kas akan dibersihkan.</li>
                            <li>Data harga outlier dari nota ini akan dibersihkan dari grafik & AI.</li>
                        </ul>
                    </div>
                    <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={deleteLoading}
                            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleteLoading}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deleteLoading ? "Menghapus..." : "Ya, Hapus Permanen"}</span>
                        </button>
                    </div>
                </div>
            </BaseModal>
        </div>
    );
}
