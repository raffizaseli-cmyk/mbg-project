"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiGet, apiPut } from "@/lib/api";
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  FolderCheck, 
  ShieldCheck,
  Calendar
} from "lucide-react";

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
            alert("Gagal memperbarui status dokumen.");
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fade-in">
            
            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                    <Link 
                        href="/pembukuan" 
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors mb-2 group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        <span>Kembali ke Pembukuan</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                            <FolderCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                                Repositori Dokumen Pertanggungjawaban
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 font-medium">
                                Arsip digital Excel Format Dinas BGN, Berita Acara Rekonsiliasi Kas (BAP), dan SPT legal.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Dokumen Table Card ─── */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs sm:text-sm text-slate-500 font-semibold">Memuat arsip dokumen legal...</p>
                    </div>
                ) : docs.length === 0 ? (
                    <div className="text-center py-24 text-slate-400 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-4 text-slate-400">
                            📂
                        </div>
                        <p className="text-base font-extrabold text-slate-800">Belum Ada Dokumen Yang Diterbitkan</p>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
                            Dokumen akan otomatis tersimpan di sini ketika Anda melakukan kompilasi Excel Dinas atau pengesahan BAP di halaman Pembukuan.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-xs sm:text-sm">
                            <thead className="bg-slate-50/70 border-b border-slate-200/80">
                                <tr className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500">
                                    <th className="text-left px-6 py-4 whitespace-nowrap">Periode</th>
                                    <th className="text-left px-6 py-4 whitespace-nowrap">Tipe Dokumen</th>
                                    <th className="text-center px-6 py-4 whitespace-nowrap">Status Pengesahan</th>
                                    <th className="text-left px-6 py-4 whitespace-nowrap">Waktu Diterbitkan</th>
                                    <th className="text-right px-6 py-4 whitespace-nowrap">Aksi Unduh & TTD</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {docs.map((doc) => {
                                    const t = doc.doc_type;
                                    const isExcel = t === "excel_dinas";
                                    const label = t === "spt" ? "Surat Pertanggungjawaban (SPT)" : t === "bap" ? "BAP Rekonsiliasi Kas" : "Excel Juknis BGN (10 Sheet)";
                                    
                                    return (
                                        <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-slate-400" />
                                                    <span>{MONTHS_FULL[doc.month]} {doc.year}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                                                        isExcel ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                                    }`}>
                                                        {isExcel ? <FileSpreadsheet className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{label}</p>
                                                        <p className="text-[11px] text-slate-400">{isExcel ? ".XLSX format resmi BGN" : ".PDF dokumen pengesahan"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {doc.status === "draft" ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                                                        <Clock className="w-3 h-3 text-amber-600" />
                                                        Draft Tanda Tangan
                                                    </span>
                                                ) : doc.status === "final" ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Final & Ditandatangani
                                                    </span>
                                                ) : doc.status === "submitted" ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-700 border border-blue-500/20">
                                                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                                                        Terkirim ke Dinas
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Valid & Siap Diunduh
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                                                {new Date(doc.generated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="flex justify-end gap-2 items-center">
                                                    <a 
                                                        href={doc.file_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        <span>Unduh</span>
                                                    </a>
                                                    {doc.doc_type !== "excel_dinas" && doc.status === "draft" && (
                                                        <button 
                                                            disabled={updatingId === doc.id}
                                                            onClick={() => handleUpdateStatus(doc.id, "final")} 
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                                                        >
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            <span>Tandai Final</span>
                                                        </button>
                                                    )}
                                                    {doc.doc_type !== "excel_dinas" && doc.status === "final" && (
                                                        <button 
                                                            disabled={updatingId === doc.id}
                                                            onClick={() => handleUpdateStatus(doc.id, "submitted")} 
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                                                        >
                                                            <ShieldCheck className="w-3 h-3" />
                                                            <span>Tandai Terkirim</span>
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
