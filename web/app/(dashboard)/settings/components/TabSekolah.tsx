"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { BaseModal } from "@/components/ui/BaseModal";

interface School {
    id: string;
    name: string;
    address: string;
    contact_name: string;
    default_portions: number;
    notes: string;
    school_level?: string;
    distance_km?: number;
}

interface BeneficiaryType {
    id: string;
    name: string;
    description?: string;
    sort_order: number;
    is_active: boolean;
}

interface SchoolBeneficiary {
    id: string;
    beneficiary_type_id: string;
    jumlah: number;
    beneficiary_types?: { name: string; sort_order: number };
}

export function TabSekolah() {
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        address: "",
        contact_name: "",
        default_portions: 0,
        notes: "",
        school_level: "sd_smp",
        distance_km: 0,
    });

    // ── Beneficiary state ──
    const [benTypes, setBenTypes] = useState<BeneficiaryType[]>([]);
    const [schoolBens, setSchoolBens] = useState<SchoolBeneficiary[]>([]);
    const [benLoading, setBenLoading] = useState(false);

    // Add beneficiary row
    const [addTypeId, setAddTypeId] = useState("");
    const [addJumlah, setAddJumlah] = useState(0);
    const [addNewName, setAddNewName] = useState("");

    // Kelola Jenis modal
    const [showKelolaModal, setShowKelolaModal] = useState(false);
    const [kelolaName, setKelolaName] = useState("");
    const [kelolaDesc, setKelolaDesc] = useState("");
    const [saving, setSaving] = useState(false);

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const res = await apiGet("/schools");
            setSchools(res?.data?.items || res?.data || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const fetchBenTypes = async () => {
        try {
            const res = await apiGet("/beneficiary-types");
            setBenTypes((res?.data || []).filter((t: BeneficiaryType) => t.is_active));
        } catch (e) { console.error(e); }
    };

    const fetchSchoolBens = async (schoolId: string) => {
        setBenLoading(true);
        try {
            const res = await apiGet(`/schools/${schoolId}/beneficiaries`);
            setSchoolBens(res?.data || []);
        } catch (e) { console.error(e); }
        setBenLoading(false);
    };

    useEffect(() => { fetchSchools(); fetchBenTypes(); }, []);

const openForm = (school?: School) => {
        if (school) {
            setEditingId(school.id);
            setFormData({
                name: school.name,
                address: school.address || "",
                contact_name: school.contact_name || "",
                default_portions: school.default_portions,
                notes: school.notes || "",
                school_level: school.school_level || "sd_smp",
                distance_km: school.distance_km || 0,
            });
            fetchSchoolBens(school.id);
        } else {
            setEditingId(null);
            setFormData({ name: "", address: "", contact_name: "", default_portions: 0, notes: "", school_level: "sd_smp", distance_km: 0 });
            setSchoolBens([]);
        }
        setAddTypeId("");
        setAddJumlah(0);
        setAddNewName("");
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await apiPut(`/schools/${editingId}`, formData);
            } else {
                await apiPost("/schools", formData);
            }
            setShowModal(false);
            fetchSchools();
        } catch (err: any) {
            alert(err?.response?.data?.detail || err?.response?.data?.error || "Gagal menyimpan data sekolah");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus sekolah ini?")) return;
        try {
            await apiDelete(`/schools/${id}`);
            fetchSchools();
        } catch {
            alert("Gagal menghapus sekolah");
        }
    };

    // ── Beneficiary actions ──

    const benTotal = schoolBens.reduce((s, b) => s + (Number(b.jumlah) || 0), 0);

    const saveBeneficiaries = async () => {
        if (!editingId) return;
        setSaving(true);
        try {
            const items = schoolBens.map(b => ({
                beneficiary_type_id: b.beneficiary_type_id,
                jumlah: b.jumlah,
            }));
            await apiPut(`/schools/${editingId}/beneficiaries`, items);
            // Update default_portions to match beneficiary total
            setFormData(prev => ({ ...prev, default_portions: benTotal }));
            fetchSchools();
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Gagal menyimpan penerima manfaat");
        }
        setSaving(false);
    };

    const addBenRow = async () => {
        let typeId = addTypeId;

        // If creating new type
        if (addTypeId === "__new__" || (addNewName.trim() && !addTypeId)) {
            if (!addNewName.trim()) {
                alert("Silakan masukkan nama jenis baru");
                return;
            }
            try {
                const res = await apiPost("/beneficiary-types", { name: addNewName.trim(), sort_order: benTypes.length });
                typeId = res?.data?.id;
                if (typeId) {
                    await fetchBenTypes();
                }
            } catch (e: any) {
                alert(e?.response?.data?.detail || "Gagal membuat jenis penerima baru");
                return;
            }
        }

        if (!typeId || addJumlah <= 0) {
            alert("Pilih jenis penerima dan isi jumlah");
            return;
        }

        // Check if already exists
        if (schoolBens.some(b => b.beneficiary_type_id === typeId)) {
            alert("Jenis penerima ini sudah ada di daftar");
            return;
        }

        const typeName = benTypes.find(t => t.id === typeId)?.name || addNewName;
        setSchoolBens(prev => [...prev, {
            id: `new-${Date.now()}`,
            beneficiary_type_id: typeId,
            jumlah: addJumlah,
            beneficiary_types: { name: typeName, sort_order: 0 },
        }]);
        setAddTypeId("");
        setAddJumlah(0);
        setAddNewName("");
    };

    const removeBenRow = (typeId: string) => {
        setSchoolBens(prev => prev.filter(b => b.beneficiary_type_id !== typeId));
    };

    const updateBenJumlah = (typeId: string, jumlah: number) => {
        setSchoolBens(prev => prev.map(b =>
            b.beneficiary_type_id === typeId ? { ...b, jumlah } : b
        ));
    };

    // ── Kelola Jenis actions ──
    const addJenis = async () => {
        if (!kelolaName.trim()) return;
        try {
            await apiPost("/beneficiary-types", { name: kelolaName.trim(), description: kelolaDesc || null, sort_order: benTypes.length });
            setKelolaName("");
            setKelolaDesc("");
            fetchBenTypes();
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Gagal menambah jenis");
        }
    };

    const deleteJenis = async (id: string) => {
        if (!confirm("Hapus/nonaktifkan jenis penerima ini?")) return;
        try {
            await apiDelete(`/beneficiary-types/${id}`);
            fetchBenTypes();
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Gagal menghapus jenis");
        }
    };

    // Available types not yet added to this school
    const availableTypes = benTypes.filter(t => !schoolBens.some(b => b.beneficiary_type_id === t.id));

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Daftar Sekolah</h2>
                <button onClick={() => openForm()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium">
                    + Tambah Sekolah
                </button>
            </div>

            {loading ? (
                <div className="text-gray-500">Memuat data...</div>
            ) : schools.length === 0 ? (
                <div className="text-gray-500 text-center py-8">Belum ada data sekolah.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left align-middle border-collapse">
                        <thead>
                            <tr className="border-b bg-gray-50">
                                <th className="px-4 py-3 font-semibold text-gray-700">Nama Sekolah</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Penanggung Jawab</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Alokasi Anggaran</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Default Porsi</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Alamat</th>
                                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schools.map((s) => (
                                <tr key={s.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                                    <td className="px-4 py-3 text-gray-600">{s.contact_name || "-"}</td>
                                    <td className="px-4 py-3 text-gray-600">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.school_level === 'paud_tk' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                            {s.school_level === 'paud_tk' ? 'PAUD/TK' : 'SD/SMP/SMA'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 font-medium">{s.default_portions} porsi</td>
                                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{s.address || "-"}</td>
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

            {/* ═══ Modal Edit/Tambah Sekolah ═══ */}
            <BaseModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={`${editingId ? "Edit" : "Tambah"} Sekolah`}
                maxWidth="max-w-lg"
                footer={
                    <div className="flex gap-3 w-full">
                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Batal</button>
                        <button type="submit" form="school-form" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Simpan Sekolah</button>
                    </div>
                }
            >
                        <form id="school-form" onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sekolah</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penanggung Jawab</label>
                                <input type="text" value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang Sekolah</label>
                                <select 
                                    className="w-full px-4 py-2 border rounded-lg bg-white"
                                    value={formData.school_level}
                                    onChange={e => setFormData(prev => ({ ...prev, school_level: e.target.value }))}
                                >
                                    <option value="sd_smp">SD / SMP / SMA</option>
                                    <option value="paud_tk">PAUD / TK</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jarak Lokasi (km)</label>
                                    <input type="number" step="0.1" min="0" value={formData.distance_km} onChange={e => setFormData({ ...formData, distance_km: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Porsi</label>
                                    <input type="number" required min="0" value={formData.default_portions} onChange={e => setFormData({ ...formData, default_portions: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                                    <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="Opsional" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap</label>
                                <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows={2} />
                            </div>

                            {/* ━━━ Penerima Manfaat Section (only when editing) ━━━ */}
                            {editingId && (
                                <div className="border-t pt-4 mt-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-gray-900">👥 Penerima Manfaat</h4>
                                        <button type="button" onClick={() => setShowKelolaModal(true)}
                                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                                            ⚙️ Kelola Jenis
                                        </button>
                                    </div>

                                    {benLoading ? (
                                        <p className="text-gray-400 text-sm">Memuat...</p>
                                    ) : (
                                        <>
                                            {/* Existing beneficiaries table */}
                                            {schoolBens.length > 0 && (
                                                <div className="mb-3">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b bg-gray-50">
                                                                <th className="text-left px-3 py-2 text-gray-500 font-medium">Jenis Penerima</th>
                                                                <th className="text-left px-3 py-2 text-gray-500 font-medium w-24">Jumlah</th>
                                                                <th className="px-3 py-2 w-12" />
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {schoolBens.map(b => {
                                                                const typeName = b.beneficiary_types?.name || benTypes.find(t => t.id === b.beneficiary_type_id)?.name || "?";
                                                                return (
                                                                    <tr key={b.beneficiary_type_id} className="border-b">
                                                                        <td className="px-3 py-2 text-gray-800">{typeName}</td>
                                                                        <td className="px-3 py-2">
                                                                            <input type="number" min="0"
                                                                                value={b.jumlah}
                                                                                onChange={e => updateBenJumlah(b.beneficiary_type_id, parseInt(e.target.value) || 0)}
                                                                                className="w-20 px-2 py-1 border rounded text-sm"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <button type="button" onClick={() => removeBenRow(b.beneficiary_type_id)}
                                                                                className="text-red-400 hover:text-red-600">🗑️</button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-blue-50 font-bold">
                                                                <td className="px-3 py-2 text-blue-800">Total Porsi</td>
                                                                <td className="px-3 py-2 text-blue-800">{benTotal}</td>
                                                                <td className="px-3 py-2 text-xs text-blue-500">(auto)</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* Add new beneficiary row */}
                                            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                                <p className="text-xs font-medium text-gray-500">+ Tambah Jenis Penerima</p>
                                                <div className="flex gap-2">
                                                    <select value={addTypeId} onChange={e => { setAddTypeId(e.target.value); setAddNewName(""); }}
                                                        className="flex-1 border rounded px-2 py-1.5 text-sm">
                                                        <option value="">Pilih jenis...</option>
                                                        {availableTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                        <option value="__new__">+ Buat baru...</option>
                                                    </select>
                                                    <input type="number" min="0" placeholder="Jml"
                                                        value={addJumlah || ""} onChange={e => setAddJumlah(parseInt(e.target.value) || 0)}
                                                        className="w-20 border rounded px-2 py-1.5 text-sm"
                                                    />
                                                    <button type="button" onClick={addBenRow}
                                                        className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                                                        +
                                                    </button>
                                                </div>
                                                {addTypeId === "__new__" && (
                                                    <input type="text" placeholder="Nama jenis baru (cth: Siswa Laki-laki)"
                                                        value={addNewName} onChange={e => { setAddNewName(e.target.value); setAddTypeId(""); }}
                                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                                    />
                                                )}
                                            </div>

                                            {/* Save beneficiaries button */}
                                            <button type="button" onClick={saveBeneficiaries} disabled={saving}
                                                className="w-full mt-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                                                {saving ? "Menyimpan..." : `💾 Simpan Penerima Manfaat (Total: ${benTotal} porsi)`}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                        </form>
            </BaseModal>

            {/* ═══ Modal Kelola Jenis Penerima ═══ */}
            <BaseModal isOpen={showKelolaModal} onClose={() => setShowKelolaModal(false)} title="⚙️ Kelola Jenis Penerima Manfaat" maxWidth="max-w-md">

                        {/* Existing types list */}
                        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                            {benTypes.length > 0 ? benTypes.map(t => (
                                <div key={t.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                                    <div>
                                        <span className="text-sm font-medium text-gray-800">{t.name}</span>
                                        {t.description && <span className="text-xs text-gray-400 ml-2">({t.description})</span>}
                                    </div>
                                    <button onClick={() => deleteJenis(t.id)} className="text-red-400 hover:text-red-600 text-sm">🗑️</button>
                                </div>
                            )) : (
                                <p className="text-gray-400 text-sm italic">Belum ada jenis penerima. Tambahkan di bawah.</p>
                            )}
                        </div>

                        {/* Add new type */}
                        <div className="border-t pt-3 space-y-2">
                            <p className="text-xs font-medium text-gray-500">Tambah Jenis Baru</p>
                            <input type="text" value={kelolaName} onChange={e => setKelolaName(e.target.value)}
                                placeholder="Nama jenis (cth: Siswa Laki-laki)" className="w-full border rounded-lg px-3 py-2 text-sm" />
                            <input type="text" value={kelolaDesc} onChange={e => setKelolaDesc(e.target.value)}
                                placeholder="Deskripsi (opsional)" className="w-full border rounded-lg px-3 py-2 text-sm" />
                            <button onClick={addJenis} disabled={!kelolaName.trim()}
                                className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40">
                                + Tambah Jenis
                            </button>
                        </div>

                        <button onClick={() => setShowKelolaModal(false)} className="w-full mt-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                            Tutup
                        </button>
            </BaseModal>
        </div>
    );
}
