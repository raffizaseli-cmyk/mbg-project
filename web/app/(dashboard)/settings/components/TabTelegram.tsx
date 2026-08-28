"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";

export function TabTelegram() {
    const [code, setCode] = useState("");
    const [expiry, setExpiry] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const generateCode = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await apiPost("/tenants/telegram-link-code", {});
            if (res?.data) {
                setCode(res.data.code);
                setExpiry(res.data.expires_at);
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || "Gagal membuat linking code.");
        }
        setLoading(false);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Koneksi Telegram (Bot Notifikasi)</h2>

            <p className="text-gray-600 mb-6 max-w-2xl">
                Aplikasi Anda dapat mengirimkan notifikasi harian seperti pengingat stok kosong dan laporan transaksi otomatis melalui <b>Telegram</b>. Silakan hubungkan akun dengan membuat kode link di bawah ini.
            </p>

            {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm max-w-md">{error}</div>}

            <div className="max-w-md border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                <h3 className="font-semibold text-lg text-gray-800 mb-2">Sambungkan Telegram Anda</h3>
                <p className="text-sm text-gray-500 mb-6">Klik tombol untuk memunculkan token penghubung.</p>

                {code ? (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center mb-6">
                        <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-2">Kode Token Login Anda</p>
                        <p className="text-3xl font-mono tracking-widest font-black text-blue-800 p-2 bg-white rounded border border-blue-100 relative inline-block">
                            {code}
                        </p>
                        <p className="text-xs text-gray-500 mt-4">
                            Berlaku hingga: {new Date(expiry).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })} pukul {new Date(expiry).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                ) : (
                    <div className="mb-6">
                        {/* Placeholder state */}
                    </div>
                )}

                <button
                    onClick={generateCode}
                    disabled={loading}
                    className="w-full px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? "Membuat..." : code ? "Buat Kode Baru" : "Generate Kode Token"}
                </button>
            </div>

            <div className="mt-8">
                <h4 className="font-semibold text-gray-800 mb-2">Cara Menggunakan:</h4>
                <ol className="list-decimal list-outside ml-5 space-y-2 text-sm text-gray-600">
                    <li>Cari akun bot Telegram: <b>@MbgCateringBot</b></li>
                    <li>Kirim pesan perintah berikut ke bot tersebut beserta kode token Anda:</li>
                    <li className="font-mono bg-gray-100 px-2 py-1 rounded inline-block text-gray-800">/start {code || "A1B2C3"}</li>
                    <li>Setelah sukses, semua notifikasi sistem akan dikirimkan ke Telegram Anda.</li>
                </ol>
            </div>
        </div>
    );
}
