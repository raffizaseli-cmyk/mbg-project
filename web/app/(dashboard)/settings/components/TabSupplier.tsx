"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { BaseModal } from "@/components/ui/BaseModal";

interface Supplier {
    id: string;
    name: string;
    category: string;
    is_pkp: boolean;
    address: string;
    phone: string;
    notes: string;
}

export function TabSupplier() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        category: "general",
        is_pkp: false,
        address: "",
        phone: "",
        notes: "",
    });

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const res = await apiGet("/suppliers");
            setSuppliers(res?.data?.items || res?.data || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const openForm = (supplier?: Supplier) => {
        if (supplier) {
            setEditingId(supplier.id);
            setFormData({
                name: supplier.name,
                category: supplier.category || "general",
                is_pkp: supplier.is_pkp || false,
                address: supplier.address || "",
                phone: supplier.phone || "",
                notes: supplier.notes || "",
            });
        } else {
            setEditingId(null);
            setFormData({ name: "", category: "general", is_pkp: false, address: "", phone: "", notes: "" });
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await apiPut(`/suppliers/${editingId}`, formData);
            } else {
                await apiPost("/suppliers", formData);
            }
            setShowModal(false);
            fetchSuppliers();
        } catch (err) {
            alert("Gagal menyimpan data supplier");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus supplier ini?")) return;
        try {
            await apiDelete(`/suppliers/${id}`);
            fetchSuppliers();
        } catch {
            alert("Gagal menghapus supplier");
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Daftar Supplier</h2>
                <button onClick={() => openForm()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium">
                    + Tambah Supplier
                </button>
            </div>

            {loading ? (
                <div className="text-gray-500">Memuat data...</div>
            ) : suppliers.length === 0 ? (
                <div className="text-gray-500 text-center py-8">Belum ada data supplier.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left align-middle border-collapse">
                        <thead>
                            <tr className="border-b bg-gray-50">
                                <th className="px-4 py-3 font-semibold text-gray-700">Nama Supplier</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Kategori</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Status Pajak</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Telepon</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((s) => (
                                <tr key={s.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                                    <td className="px-4 py-3 text-gray-600">
                                        <span className="px-2 py-1 bg-gray-100 rounded text-xs capitalize">{s.category}</span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {s.is_pkp ? (
                                            <span className="text-green-600 font-medium text-xs border border-green-200 bg-green-50 px-2 py-1 rounded">PKP</span>
                                        ) : (
                                            <span className="text-gray-500 text-xs border border-gray-200 bg-gray-50 px-2 py-1 rounded">Non-PKP</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 truncate">{s.phone || "-"}</td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => openForm(s)} className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded">Edit</button>
                                        <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 font-medium px-2 py-1 bg-red-50 rounded">Hapus</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <BaseModal isOpen={showModal} onClose={() => setShowModal(false)} title={`${editingId ? "Edit" : "Tambah"} Supplier`} maxWidth="max-w-md">
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Supplier / Toko</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border rounded-lg bg-white">
                                        <option value="general">Umum (General)</option>
                                        <option value="bahan_baku">Bahan Baku Makanan</option>
                                        <option value="kemasan">Kemasan / Box</option>
                                        <option value="distributor">Distributor / Pabrik</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Pajak</label>
                                    <label className="flex items-center space-x-2 mt-2">
                                        <input type="checkbox" checked={formData.is_pkp} onChange={e => setFormData({ ...formData, is_pkp: e.target.checked })} className="w-5 h-5 text-blue-600" />
                                        <span className="text-sm">Perusahaan PKP</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Telepon</label>
                                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Supplier</label>
                                <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows={2} />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Batal</button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Simpan</button>
                            </div>
                        </form>
            </BaseModal>
        </div>
    );
}
