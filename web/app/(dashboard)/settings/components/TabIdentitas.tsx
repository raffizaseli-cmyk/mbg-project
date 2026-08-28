"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPut } from "@/lib/api";

interface Tenant {
    id: string;
    name: string;
    slug: string;
    phone: string;
    address: string;
    business_type: string;
    sppg_code: string;
    contact_name: string;
    plan: string;
}

export function TabIdentitas() {
    const [data, setData] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const fetchTenant = async () => {
        setLoading(true);
        try {
            const res = await apiGet("/tenants/me");
            if (res?.data) {
                // Ensure null values are converted to empty strings for controlled inputs
                setData({
                    ...res.data,
                    name: res.data.name || "",
                    phone: res.data.phone || "",
                    address: res.data.address || "",
                    contact_name: res.data.contact_name || "",
                    sppg_code: res.data.sppg_code || "",
                    business_type: res.data.business_type || "catering",
                });
            }
        } catch (e: any) {
            setError("Gagal memuat profil identitas.");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTenant();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (!data) return;
        setData({ ...data, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data) return;
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            await apiPut("/tenants/me", {
                name: data.name,
                phone: data.phone || null,
                address: data.address || null,
                business_type: data.business_type || "catering",
                sppg_code: data.sppg_code || null,
                contact_name: data.contact_name || null,
            });
            setSuccess("Profil identitas berhasil disimpan.");
            await fetchTenant(); // Refresh ulang state data dari DB beneran
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.response?.data?.error || "Gagal menyimpan.");
        }
        setSaving(false);
    };

    if (loading) return <div className="text-gray-500">Memuat data...</div>;
    if (!data) return <div className="text-red-500">Gagal mengambil data.</div>;

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Identitas SPPG</h2>

            {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
            {success && <div className="mb-4 bg-green-50 text-green-600 p-3 rounded-lg text-sm">{success}</div>}

            <form onSubmit={handleSave} className="max-w-xl space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama SPPG</label>
                    <input
                        type="text"
                        name="name"
                        value={data.name || ""}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-100"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug (Identifier)</label>
                    <input
                        type="text"
                        readOnly
                        value={data.slug || ""}
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Slug digunakan untuk sistem dan tidak dapat diubah.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik / Penanggung Jawab</label>
                    <input
                        type="text"
                        name="contact_name"
                        value={data.contact_name || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-100"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telepon (WhatsApp)</label>
                    <input
                        type="text"
                        name="phone"
                        value={data.phone || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-100"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alamat SPPG</label>
                    <textarea
                        name="address"
                        rows={3}
                        value={data.address || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-100"
                    />
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
            </form>
        </div>
    );
}
