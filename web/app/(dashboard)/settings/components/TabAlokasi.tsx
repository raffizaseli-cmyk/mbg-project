"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { formatRupiah } from "@/components/ui/rupiah";
import { apiGet, apiPut } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface MbgSettings {
    bahan_sd_smp: number;
    bahan_paud_tk: number;
    ops_per_porsi: number;
    insentif_harian: number;
    hari_kerja_bulan: number;
}

export function TabAlokasi() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<MbgSettings>({
        bahan_sd_smp: 10000,
        bahan_paud_tk: 8000,
        ops_per_porsi: 3000,
        insentif_harian: 6000000,
        hari_kerja_bulan: 26
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await apiGet("/tenants/mbg-settings") as { data: MbgSettings };
            if (res.data) {
                setSettings(res.data);
            }
        } catch (e) {
            console.error(e);
            showToast("Gagal memuat pengaturan", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            await apiPut("/tenants/mbg-settings", settings);
            showToast("Pengaturan berhasil disimpan", "success");
        } catch (e) {
            console.error(e);
            showToast("Gagal menyimpan pengaturan", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    const estimasiBahan = 1000 * settings.bahan_sd_smp;
    const estimasiOps = 1000 * settings.ops_per_porsi;
    const grandTotal = estimasiBahan + estimasiOps + settings.insentif_harian;
    const totalInsentifBulan = settings.insentif_harian * settings.hari_kerja_bulan;

    return (
        <div>
            <h2 className="text-2xl font-bold font-heading text-slate-900 mb-6">Alokasi Anggaran MBG (Juknis Baru)</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* FORM COLUMN */}
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                        <div className="flex items-center gap-2 text-lg font-bold text-slate-800 border-b pb-2">
                            <span>📐 Komponen Bahan Baku</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">SD/SMP/SMA per porsi</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400">Rp</span>
                                    <input 
                                        type="number" 
                                        value={settings.bahan_sd_smp} 
                                        onChange={(e) => setSettings({...settings, bahan_sd_smp: Number(e.target.value)})}
                                        className="pl-9 w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">PAUD/TK per porsi</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400">Rp</span>
                                    <input 
                                        type="number" 
                                        value={settings.bahan_paud_tk} 
                                        onChange={(e) => setSettings({...settings, bahan_paud_tk: Number(e.target.value)})}
                                        className="pl-9 w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500" 
                                        required 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                        <div className="flex items-center gap-2 text-lg font-bold text-slate-800 border-b pb-2">
                            <span>⚙️ Operasional</span>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Operasional per porsi</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400">Rp</span>
                                <input 
                                    type="number" 
                                    value={settings.ops_per_porsi} 
                                    onChange={(e) => setSettings({...settings, ops_per_porsi: Number(e.target.value)})}
                                    className="pl-9 w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500" 
                                    required 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
                        <div className="flex items-center gap-2 text-lg font-bold text-slate-800 border-b pb-2">
                            <span>💰 Insentif SPPG</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Insentif per hari (Fixed)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400">Rp</span>
                                    <input 
                                        type="number" 
                                        value={settings.insentif_harian} 
                                        onChange={(e) => setSettings({...settings, insentif_harian: Number(e.target.value)})}
                                        className="pl-9 w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Hari kerja/bulan</label>
                                <input 
                                    type="number" 
                                    value={settings.hari_kerja_bulan} 
                                    onChange={(e) => setSettings({...settings, hari_kerja_bulan: Number(e.target.value)})}
                                    className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500" 
                                    required 
                                />
                            </div>
                        </div>
                        <div className="bg-orange-50 text-orange-800 p-3 rounded-lg text-sm font-medium border border-orange-200">
                            Total insentif per bulan: {formatRupiah(totalInsentifBulan)}
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={saving}
                        className="w-full flex justify-center items-center py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                        Simpan Pengaturan
                    </button>
                </form>

                {/* PREVIEW COLUMN */}
                <div>
                    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg sticky top-6">
                        <h3 className="text-lg font-bold font-heading mb-5 flex items-center gap-2">
                            📊 Simulasi Harian <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded">(Asumsi 1.000 porsi SD)</span>
                        </h3>
                        
                        <div className="space-y-3">
                            {/* Biaya Operasi */}
                            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Biaya Produksi (Terpakai)</p>
                            <div className="flex justify-between items-center text-slate-400 text-sm">
                                <span>Bahan Baku (1.000 × {formatRupiah(settings.bahan_sd_smp)})</span>
                                <span className="font-medium text-slate-300">{formatRupiah(estimasiBahan)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400 text-sm">
                                <span>Operasional (1.000 × {formatRupiah(settings.ops_per_porsi)})</span>
                                <span className="font-medium text-slate-300">{formatRupiah(estimasiOps)}</span>
                            </div>
                            
                            <hr className="border-slate-700/50 my-3" />
                            
                            {/* Keuntungan Dapur */}
                            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Keuntungan Pengelola (Sewa Dapur)</p>
                            <div className="flex justify-between items-center text-emerald-400 font-bold text-base">
                                <span>💰 Insentif Harian (Fixed)</span>
                                <span>{formatRupiah(settings.insentif_harian)}</span>
                            </div>
                            
                            <hr className="border-slate-700/50 my-3" />
                            
                            {/* Total */}
                            <div className="flex justify-between items-center text-sm text-slate-400">
                                <span>Total Pagu Harian</span>
                                <span className="font-medium text-slate-300">{formatRupiah(grandTotal)}</span>
                            </div>
                        </div>
                        
                        <p className="text-[11px] text-slate-500 mt-5 leading-relaxed">
                            Bahan baku &amp; operasional langsung terpakai untuk produksi makanan. Keuntungan yang diterima pengelola dapur = <strong className="text-emerald-400">Insentif harian {formatRupiah(settings.insentif_harian)}/hari</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
