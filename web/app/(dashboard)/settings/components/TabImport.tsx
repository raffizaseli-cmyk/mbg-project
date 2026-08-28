"use client";

import { useState, useRef, useEffect } from "react";
import { apiDownload, apiUpload, apiGet } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { BaseModal } from "@/components/ui/BaseModal";
import Link from "next/link";

/* ────────── Types ────────── */
interface PreviewRow {
    row_number: number;
    tanggal: string | null;
    nama_bahan: string;
    product_id: string | null;
    product_found: boolean;
    qty: number | null;
    satuan: string;
    harga_satuan: string | null;
    nama_supplier: string;
    supplier_id: string | null;
    supplier_status: "found" | "will_create" | "empty";
    status: "valid" | "invalid";
    errors: string[];
}

interface PreviewData {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    rows: PreviewRow[];
    warnings: string[];
}

interface ImportResult {
    imported_rows: number;
    skipped_rows: number;
    created_suppliers: number;
    created_products: number;
    transactions_created: number;
    skipped_details: { row: number; reason: string }[];
}

interface ImportHistory {
    imported_at: string;
    total_rows: number;
    date_range: string;
    total_amount: string;
}

type Step = "upload" | "preview" | "done";

function formatRp(val: number | string): string {
    const n = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(n)) return "Rp 0";
    return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

/* ────────── Component ────────── */
export function TabImport() {
    const [step, setStep] = useState<Step>("upload");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    // Preview
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [showAllRows, setShowAllRows] = useState(false);
    const [createProducts, setCreateProducts] = useState(false);
    const [createSuppliers, setCreateSuppliers] = useState(true);

    // Result
    const [result, setResult] = useState<ImportResult | null>(null);
    const [showSkipped, setShowSkipped] = useState(false);

    // History
    const [history, setHistory] = useState<ImportHistory[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
    const [rollbackLoading, setRollbackLoading] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    async function loadHistory() {
        setHistoryLoading(true);
        try {
            const res = await apiGet("/imports/history");
            setHistory(res?.data?.imports || []);
        } catch { /* ignore */ }
        setHistoryLoading(false);
    }

    /* ─── Download template ─── */
    async function downloadTemplate() {
        try {
            await apiDownload("/imports/template", "template_import_harga.csv");
        } catch {
            setError("Gagal download template");
        }
    }

    /* ─── File select ─── */
    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.endsWith(".csv")) {
            setError("Hanya file .csv yang diterima");
            return;
        }
        if (f.size > 5 * 1024 * 1024) {
            setError("File terlalu besar (max 5MB)");
            return;
        }
        setFile(f);
        setError("");
        setPreview(null);
    }

    /* ─── Validate ─── */
    async function validateFile() {
        if (!file) return;
        setLoading(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await apiUpload("/imports/validate", fd);
            if (res?.data) {
                setPreview(res.data);
                setStep("preview");
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || "Validasi gagal");
        }
        setLoading(false);
    }

    /* ─── Execute ─── */
    async function executeImport() {
        if (!file) return;
        setLoading(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("create_missing_products", String(createProducts));
            fd.append("create_missing_suppliers", String(createSuppliers));
            const res = await apiUpload("/imports/execute", fd);
            if (res?.data) {
                setResult(res.data);
                setStep("done");
                loadHistory();
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || "Import gagal");
        }
        setLoading(false);
    }

    /* ─── Rollback ─── */
    async function doRollback(importedAt: string) {
        setRollbackLoading(true);
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
            const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
            const res = await fetch(`${baseUrl}/imports/rollback`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ imported_at: importedAt }),
            });
            if (!res.ok) throw new Error("Rollback failed");
            setRollbackTarget(null);
            loadHistory();
        } catch {
            setError("Rollback gagal");
        }
        setRollbackLoading(false);
    }

    /* ─── Reset to upload ─── */
    function resetToUpload() {
        setStep("upload");
        setFile(null);
        setPreview(null);
        setResult(null);
        setError("");
        setShowAllRows(false);
        if (fileRef.current) fileRef.current.value = "";
    }

    const visibleRows = preview?.rows
        ? showAllRows ? preview.rows : preview.rows.slice(0, 20)
        : [];

    return (
        <div className="pb-20">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">📥 Import Harga Historis</h2>
                <p className="text-gray-500 text-sm mt-1">Upload data harga belanja masa lalu agar grafik track harga langsung punya data</p>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    ❌ {error}
                </div>
            )}

            {/* ─── Info Box ─── */}
            <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900">
                <p className="font-semibold mb-2">💡 Gunakan fitur ini untuk:</p>
                <ul className="list-disc list-inside space-y-1 mb-3">
                    <li>Memasukkan data belanja sebelum pakai sistem ini</li>
                    <li>Melengkapi data historis harga per bahan</li>
                    <li>Makin banyak data → grafik track harga makin akurat</li>
                </ul>
                <p className="font-medium mb-1">Data yang diimport akan muncul di:</p>
                <div className="flex flex-wrap gap-3 text-xs">
                    <span className="bg-blue-100 px-2 py-1 rounded">📈 Track Harga → grafik & perbandingan supplier</span>
                    <span className="bg-blue-100 px-2 py-1 rounded">📋 Pembukuan → ditandai &apos;Import Historis&apos;</span>
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">📦 Stok → TIDAK mengubah stok (hanya data harga)</span>
                </div>
            </div>

            {/* ═══ STEP 1: Template + Upload ═══ */}
            {step === "upload" && (
                <>
                    {/* Download template */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-800 mb-3">Langkah 1 — Download Template CSV</h2>
                        <button
                            onClick={downloadTemplate}
                            className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition mb-4"
                        >
                            📥 Download Template CSV
                        </button>
                        <div className="text-sm text-gray-600 space-y-1">
                            <p className="font-medium">Instruksi pengisian:</p>
                            <ul className="list-disc list-inside text-xs space-y-0.5">
                                <li><code className="bg-gray-100 px-1 rounded">tanggal</code>: format YYYY-MM-DD (contoh: 2026-01-15)</li>
                                <li><code className="bg-gray-100 px-1 rounded">nama_bahan</code>: harus sama dengan nama di Settings</li>
                                <li><code className="bg-gray-100 px-1 rounded">qty</code> & <code className="bg-gray-100 px-1 rounded">harga_satuan</code>: angka saja tanpa titik/koma</li>
                                <li><code className="bg-gray-100 px-1 rounded">nama_supplier</code>: opsional, bisa dikosongkan</li>
                            </ul>
                        </div>
                    </div>

                    {/* Upload */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-800 mb-3">Langkah 2 — Upload File CSV</h2>
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
                        >
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv"
                                onChange={onFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div>
                                    <p className="text-2xl mb-2">📄</p>
                                    <p className="font-medium text-gray-800">{file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-3xl mb-2">📂</p>
                                    <p className="text-gray-600 font-medium">Drag & drop atau klik untuk pilih file</p>
                                    <p className="text-xs text-gray-400 mt-1">Hanya .csv, max 5MB</p>
                                </div>
                            )}
                        </div>

                        {file && (
                            <button
                                onClick={validateFile}
                                disabled={loading}
                                className="mt-4 w-full px-5 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                            >
                                {loading ? "⏳ Memeriksa data..." : "🔍 Validasi Data"}
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* ═══ STEP 2: Preview ═══ */}
            {step === "preview" && preview && (
                <div className="space-y-6">
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-green-700">{preview.valid_rows}</p>
                            <p className="text-sm text-green-600">✅ Valid</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-red-700">{preview.invalid_rows}</p>
                            <p className="text-sm text-red-600">❌ Invalid</p>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-yellow-700">{preview.warnings.length}</p>
                            <p className="text-sm text-yellow-600">⚠️ Warnings</p>
                        </div>
                    </div>

                    {/* Warnings */}
                    {preview.warnings.length > 0 && (
                        <div className="space-y-2">
                            {preview.warnings.map((w, i) => (
                                <div key={i} className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                                    ⚠️ {w}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Options */}
                    <div className="bg-white rounded-xl border p-5 space-y-3">
                        <h3 className="font-semibold text-gray-800">Opsi Import:</h3>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={createProducts}
                                onChange={e => setCreateProducts(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600"
                            />
                            Buat otomatis bahan yang tidak ditemukan
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={createSuppliers}
                                onChange={e => setCreateSuppliers(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600"
                            />
                            Buat otomatis supplier yang tidak ditemukan
                        </label>
                    </div>

                    {/* Preview table */}
                    <div className="bg-white rounded-xl border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs text-gray-600 uppercase">
                                    <tr>
                                        <th className="px-3 py-3">Baris</th>
                                        <th className="px-3 py-3">Tanggal</th>
                                        <th className="px-3 py-3">Bahan</th>
                                        <th className="px-3 py-3">Qty</th>
                                        <th className="px-3 py-3">Harga</th>
                                        <th className="px-3 py-3">Supplier</th>
                                        <th className="px-3 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visibleRows.map(row => (
                                        <tr key={row.row_number} className={row.status === "invalid" ? "bg-red-50" : row.product_found ? "" : "bg-yellow-50"}>
                                            <td className="px-3 py-2 text-gray-500">{row.row_number}</td>
                                            <td className="px-3 py-2">{row.tanggal || "-"}</td>
                                            <td className="px-3 py-2">
                                                {row.nama_bahan}
                                                {!row.product_found && row.status === "valid" && (
                                                    <span className="ml-1 text-xs text-yellow-600">(baru)</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">{row.qty} {row.satuan}</td>
                                            <td className="px-3 py-2">{row.harga_satuan ? formatRp(row.harga_satuan) : "-"}</td>
                                            <td className="px-3 py-2">
                                                {row.nama_supplier || "-"}
                                                {row.supplier_status === "will_create" && (
                                                    <span className="ml-1 text-xs text-yellow-600">(baru)</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                {row.status === "valid" ? (
                                                    <span className="text-green-600 font-medium">✅</span>
                                                ) : (
                                                    <span className="text-red-600 font-medium" title={row.errors.join(", ")}>❌</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {preview.rows.length > 20 && !showAllRows && (
                            <div className="p-3 text-center border-t">
                                <button
                                    onClick={() => setShowAllRows(true)}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    Tampilkan semua {preview.rows.length} baris
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-4">
                        <button
                            onClick={resetToUpload}
                            className="flex-1 px-5 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                        >
                            ← Ganti File
                        </button>
                        <button
                            onClick={executeImport}
                            disabled={loading || preview.valid_rows === 0}
                            className="flex-1 px-5 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                        >
                            {loading ? "⏳ Mengimport..." : `✅ Import ${preview.valid_rows} Baris`}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ STEP 3: Result ═══ */}
            {step === "done" && result && (
                <div className="space-y-6">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                        <p className="text-4xl mb-3">✅</p>
                        <h2 className="text-xl font-bold text-green-800 mb-3">Import Berhasil!</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                            <div className="bg-white rounded-lg p-3 border">
                                <p className="text-xl font-bold text-green-700">{result.imported_rows}</p>
                                <p className="text-gray-600">Baris diimport</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border">
                                <p className="text-xl font-bold text-yellow-600">{result.skipped_rows}</p>
                                <p className="text-gray-600">Dilewati</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border">
                                <p className="text-xl font-bold text-blue-600">{result.created_suppliers}</p>
                                <p className="text-gray-600">Supplier baru</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border">
                                <p className="text-xl font-bold text-purple-600">{result.created_products}</p>
                                <p className="text-gray-600">Bahan baru</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 justify-center">
                            <Link href="/insights?tab=harga" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition">
                                📈 Lihat Track Harga
                            </Link>
                            <Link href="/pembukuan" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium transition">
                                📋 Lihat Pembukuan
                            </Link>
                            <button onClick={resetToUpload} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition">
                                📥 Import Lagi
                            </button>
                        </div>
                    </div>

                    {result.skipped_rows > 0 && (
                        <div className="bg-white rounded-xl border p-4">
                            <button
                                onClick={() => setShowSkipped(s => !s)}
                                className="text-sm text-blue-600 hover:underline font-medium"
                            >
                                {showSkipped ? "Sembunyikan" : `Lihat ${result.skipped_rows} baris yang dilewati`}
                            </button>
                            {showSkipped && (
                                <div className="mt-3 space-y-1 text-sm">
                                    {result.skipped_details.map((d, i) => (
                                        <div key={i} className="flex gap-2 text-gray-600">
                                            <span className="font-mono text-gray-400 w-16 shrink-0">Baris {d.row}</span>
                                            <span>→ {d.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Riwayat Import ═══ */}
            <div className="mt-12">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Riwayat Import</h2>
                {historyLoading ? (
                    <div className="text-center text-gray-500 py-8">⏳ Memuat...</div>
                ) : history.length === 0 ? (
                    <div className="text-center text-gray-400 py-8 bg-gray-50 rounded-xl border border-dashed">
                        Belum ada riwayat import
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs text-gray-600 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Tanggal Import</th>
                                    <th className="px-4 py-3">Periode Data</th>
                                    <th className="px-4 py-3">Jumlah Transaksi</th>
                                    <th className="px-4 py-3">Total Nilai</th>
                                    <th className="px-4 py-3">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map((h, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">{h.imported_at}</td>
                                        <td className="px-4 py-3">{h.date_range}</td>
                                        <td className="px-4 py-3">{h.total_rows}</td>
                                        <td className="px-4 py-3">{formatRp(h.total_amount)}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setRollbackTarget(h.imported_at)}
                                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                                            >
                                                🗑️ Rollback
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── Rollback modal ─── */}
            <BaseModal isOpen={!!rollbackTarget} onClose={() => setRollbackTarget(null)} title="🗑️ Rollback Import" maxWidth="max-w-md">
                {rollbackTarget && (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                            Hapus semua data import tanggal <strong>{rollbackTarget}</strong>?
                        </p>
                        <p className="text-xs text-red-600 mb-4">
                            Semua transaksi &amp; item yang diimport akan dihapus. Aksi ini tidak bisa dibatalkan.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setRollbackTarget(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => doRollback(rollbackTarget)}
                                disabled={rollbackLoading}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium cursor-pointer"
                            >
                                {rollbackLoading ? "⏳..." : "🗑️ Ya, Hapus"}
                            </button>
                        </div>
                    </div>
                )}
            </BaseModal>
        </div>
    );
}
