"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiGet, apiPut } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";

interface LegalDoc {
    id: string;
    doc_type: "spt" | "bap" | "excel_dinas";
    year: number;
    month: number;
    file_url: string;
    status: string;
    generated_at: string;
}

const MONTHS_FULL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function DokumenLegalPage() {
    const [docs, setDocs] = useState<LegalDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiGet("/legal/documents");
            setDocs(res?.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDocs();
    }, [fetchDocs]);

    const handleUpdateStatus = async (id: string, status: string) => {
        setUpdatingId(id);
        try {
            await apiPut(`/legal/documents/${id}/status`, { status });
            fetchDocs();
        } catch {
            alert("Gagal update status.");
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Daftar Dokumen Legal & Export"
                subtitle="Riwayat lengkap seluruh dokumen yang di-generate"
                actions={
                    <Link href="/pembukuan" className="text-blue-600 hover:underline text-sm font-medium">
                        ← Kembali ke Pembukuan
                    </Link>
                }
            />

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : docs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 space-y-2">
                        <p className="text-3xl">📭</p>
                        <p className="font-medium">Belum ada dokumen yang digenerate</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Tahun</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Bulan</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Jenis Dokumen</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Tanggal Generate</th>
                                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map((doc, i) => {
                                    const t = doc.doc_type;
                                    let label = t === "spt" ? "SPT" : t === "bap" ? "BAP Kas" : "Excel Dinas";
                                    let clr = "text-gray-600";
                                    let statStr = doc.status;
                                    
                                    if (doc.status === "draft") {
                                        clr = "text-orange-500";
                                        statStr = "📝 Draft";
                                    } else if (doc.status === "final") {
                                        clr = "text-green-600";
                                        statStr = "✅ Final";
                                    } else if (doc.status === "submitted") {
                                        clr = "text-blue-600";
                                        statStr = "📤 Submitted";
                                    } else if (doc.status === "ready") {
                                        clr = "text-green-600";
                                        statStr = "✅ Siap";
                                    }
                                    
                                    return (
                                        <tr key={doc.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                            <td className="px-4 py-3 text-gray-800">{doc.year}</td>
                                            <td className="px-4 py-3 text-gray-800">{MONTHS_FULL[doc.month]}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900">{label}</td>
                                            <td className={`px-4 py-3 font-medium ${clr}`}>{statStr}</td>
                                            <td className="px-4 py-3 text-gray-500">
                                                {new Date(doc.generated_at).toLocaleString("id-ID")}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2 items-center">
                                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1 rounded">
                                                        Lihat
                                                    </a>
                                                    {doc.doc_type !== "excel_dinas" && doc.status === "draft" && (
                                                        <button onClick={() => handleUpdateStatus(doc.id, "final")} className="text-green-600 hover:text-green-800 font-medium bg-green-50 px-3 py-1 rounded">
                                                            Tandai Final
                                                        </button>
                                                    )}
                                                    {doc.doc_type !== "excel_dinas" && doc.status === "final" && (
                                                        <button onClick={() => handleUpdateStatus(doc.id, "submitted")} className="text-purple-600 hover:text-purple-800 font-medium bg-purple-50 px-3 py-1 rounded">
                                                            Tandai Submit
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
