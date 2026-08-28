"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { BaseModal } from "@/components/ui/BaseModal";

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
                setError("Transaksi tidak ditemukan atau terjadi error.");
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
            alert("✅ Transaksi berhasil dikonfirmasi & stok telah diperbarui!");
            setShowConfirmModal(false);
            router.push("/pembukuan");
        } catch {
            alert("Gagal konfirmasi transaksi.");
            setConfirmLoading(false);
        }
    };

    const handleDelete = async () => {
        setDeleteLoading(true);
        try {
            await apiDelete(`/transactions/${id}`);
            alert("✅ Transaksi berhasil dihapus dan data terkait telah dibersihkan.");
            setShowDeleteModal(false);
            router.push("/pembukuan");
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Gagal membatalkan transaksi.");
            setDeleteLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !trx) {
        return (
            <div className="text-center py-20 space-y-3">
                <p className="text-4xl">⚠️</p>
                <p className="text-red-600 font-medium">{error ?? "Transaksi tidak ditemukan."}</p>
                <a href="/pembukuan" className="text-blue-600 hover:underline text-sm">← Kembali ke Pembukuan</a>
            </div>
        );
    }

    const subtotal = trx.items.reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);

    return (
        <div className="space-y-5 max-w-4xl">
            <PageHeader
                title="Detail Transaksi"
                backHref="/pembukuan"
                backLabel="Kembali ke Pembukuan"
                actions={
                    <div className="flex items-center gap-2">
                        <StatusBadge status={trx.status} />
                        {trx.source && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{trx.source}</span>}
                        {trx.status !== "confirmed" && trx.status !== "failed" && (
                            <button
                                onClick={() => setShowConfirmModal(true)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                            >
                                ✅ Konfirmasi
                            </button>
                        )}
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                        >
                            🗑️ Hapus Nota
                        </button>
                    </div>
                }
            />

            {/* ─── Info Transaksi ───────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
                <h2 className="font-semibold text-gray-800">📋 Informasi Transaksi</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                    <Row label="Supplier" value={trx.nama_toko || "—"} />
                    <Row label="Tanggal" value={new Date(trx.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
                    <Row label="Metode Bayar" value={trx.payment_method || "—"} />
                    {trx.due_date && <Row label="Jatuh Tempo" value={new Date(trx.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />}
                    <Row label="Dibuat" value={formatDate(trx.created_at)} />
                    <Row label="Dikonfirmasi" value={trx.confirmed_at ? formatDate(trx.confirmed_at) : "Belum dikonfirmasi"} />
                    {trx.created_by && <Row label="Oleh" value={trx.created_by} />}
                </div>
            </div>

            {/* ─── Foto Nota ────────────────────────────────────── */}
            {trx.photo_url && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="font-semibold text-gray-800 mb-3">📷 Foto Nota</h2>
                    <div className="relative inline-block">
                        <img
                            src={trx.photo_url}
                            alt="Foto nota"
                            className="max-h-64 rounded-lg object-contain cursor-pointer border border-gray-200 hover:opacity-90 transition-opacity"
                            onClick={() => setPhotoOpen(true)}
                        />
                    </div>
                    <div className="mt-2">
                        <a href={trx.photo_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline">🔍 Buka Ukuran Penuh</a>
                    </div>
                    {/* Lightbox */}
                    <BaseModal isOpen={photoOpen} onClose={() => setPhotoOpen(false)} title="Foto Nota" maxWidth="max-w-4xl">
                        <div className="flex items-center justify-center">
                            <img src={trx.photo_url} alt="Nota" className="max-w-full max-h-[70vh] rounded-lg" />
                        </div>
                    </BaseModal>
                </div>
            )}

            {/* ─── Tabel Items ──────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">🛒 Daftar Item ({trx.items.length})</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {["No", "Nama Item", "Qty", "Satuan", "Harga Satuan", "Subtotal", "Produk DB"].map(h => (
                                    <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {trx.items.map((item, i) => (
                                <tr key={item.id} className={`border-b border-gray-50 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                                    <td className="px-4 py-2.5 font-medium text-gray-800">{item.product_name}</td>
                                    <td className="px-4 py-2.5 text-right">{parseFloat(item.qty).toLocaleString("id-ID")}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{item.unit || "—"}</td>
                                    <td className="px-4 py-2.5 text-right">{formatRp(item.price)}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold">{formatRp(item.subtotal)}</td>
                                    <td className="px-4 py-2.5 text-xs text-gray-400">{item.alias_matched || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary */}
                <div className="px-5 py-4 border-t border-gray-100 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-medium">{formatRp(subtotal)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-base">
                        <span>Total</span>
                        <span>{formatRp(trx.total)}</span>
                    </div>
                </div>
            </div>

            {/* ─── Actions ──────────────────────────────────────── */}
            {trx.status !== "confirmed" && trx.status !== "failed" && (
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setPaymentMethod(trx.payment_method || "cash");
                            setShowConfirmModal(true);
                        }}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 shadow-md transition-all cursor-pointer"
                    >
                        ✅ Konfirmasi Transaksi
                    </button>
                    <button
                        onClick={handleDelete}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-red-50 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
                    >
                        ❌ Batalkan
                    </button>
                </div>
            )}

            {/* ─── Riwayat Stok ─────────────────────────────────── */}
            {trx.stock_history && trx.stock_history.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="font-semibold text-gray-800 mb-3">📦 Riwayat Stok Terkait</h2>
                    <div className="space-y-1.5">
                        {trx.stock_history.map((h) => (
                            <div key={h.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                                <div>
                                    <span className="text-gray-700 font-medium">{h.product_name || "—"}</span>
                                    <span className="text-gray-400 ml-2 text-xs">{h.reason}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`font-semibold ${parseFloat(h.change_qty) >= 0 ? "text-green-600" : "text-red-500"}`}>
                                        {parseFloat(h.change_qty) >= 0 ? "+" : ""}{h.change_qty} {h.unit}
                                    </span>
                                    <span className="text-gray-400 text-xs">
                                        {new Date(h.created_at).toLocaleDateString("id-ID")}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Modal Konfirmasi Pembayaran ─── */}
            <BaseModal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="✅ Konfirmasi Nota & Update Stok" maxWidth="max-w-md">
                        <form onSubmit={handleConfirmSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Metode Pembayaran</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: "cash", label: "💵 Tunai", desc: "Kas Keluar" },
                                        { id: "hutang", label: "💳 Hutang", desc: "Kredit/Payable" },
                                        { id: "transfer", label: "🏦 Transfer", desc: "Bank" },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setPaymentMethod(m.id)}
                                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                                paymentMethod === m.id
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
                                    placeholder="Tambahkan catatan..."
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none"
                                    rows={2}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button type="button" onClick={() => setShowConfirmModal(false)} className="px-4 py-2 border rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer">Batal</button>
                                <button type="submit" disabled={confirmLoading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer">
                                    {confirmLoading ? "Memproses..." : "✅ Konfirmasi & Update Stok"}
                                </button>
                            </div>
                        </form>
            </BaseModal>

            {/* Modal Konfirmasi Hapus Nota */}
            <BaseModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="🗑️ Konfirmasi Hapus Nota" maxWidth="max-w-md">
                <div className="space-y-4">
                    <p className="text-sm text-gray-700">
                        Apakah Anda yakin ingin menghapus nota dari <strong>{trx.nama_toko || "Supplier"}</strong> ({formatRp(trx.total)})?
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 space-y-1">
                        <p className="font-bold">⚠️ Efek Penghapusan Nota:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>Status nota akan dibatalkan/voided.</li>
                            <li>Stok bahan baku akan dikurangi/dikoreksi kembali otomatis.</li>
                            <li>Catatan transaksi di Pembukuan & Arus Kas akan dibersihkan.</li>
                            <li>Data harga outlier dari nota ini akan dibersihkan dari grafik & AI.</li>
                        </ul>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={deleteLoading}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleteLoading}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            {deleteLoading ? "Menghapus..." : "🗑️ Ya, Hapus Permanen"}
                        </button>
                    </div>
                </div>
            </BaseModal>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-2">
            <span className="text-gray-500 min-w-[110px]">{label}</span>
            <span className="font-medium text-gray-800">{value}</span>
        </div>
    );
}
