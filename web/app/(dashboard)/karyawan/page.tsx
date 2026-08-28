"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { BaseModal } from "@/components/ui/BaseModal";

type Tab = "Karyawan" | "Jabatan" | "Absensi" | "Penggajian";

export default function KaryawanPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Karyawan");

  return (
    <div className="animate-in max-w-7xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Karyawan & HR
          </h1>
          <p className="text-gray-500 font-medium text-sm">Kelola data pegawai, absensi, dan penggajian</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200/50 sticky top-0 lg:-top-4 bg-gray-50/80 backdrop-blur-md z-10 mb-2 mt-2">
        <div className="flex space-x-8 px-2 overflow-x-auto no-scrollbar">
        {["Karyawan", "Jabatan", "Absensi", "Penggajian"].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-3 font-semibold border-b-[3px] transition-all duration-200 whitespace-nowrap ${
              activeTab === tab
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab(tab as Tab)}
          >
            {tab}
          </button>
        ))}
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        {activeTab === "Karyawan" && <KaryawanTab />}
        {activeTab === "Jabatan" && <JabatanTab />}
        {activeTab === "Absensi" && <AbsensiTab />}
        {activeTab === "Penggajian" && <PenggajianTab />}
      </div>
    </div>
  );
}

// ─── KARYAWAN TAB ─────────────────────────────────────────────────────────────

function KaryawanTab() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: "", name: "", nik: "", phone: "", address: "",
    position_id: "", employee_type: "relawan",
    bank_name: "", bank_account: "", bank_holder: "", join_date: ""
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, posRes] = await Promise.all([
        apiGet("/employees"),
        apiGet("/employees/positions")
      ]);
      setEmployees(empRes.data || []);
      setPositions(posRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = formData.id ? "PUT" : "POST";
    const url = formData.id ? `/api/employees/${formData.id}` : "/api/employees";
    
    // cleanup empty strings
    const reqData: any = { ...formData };
    if (!reqData.position_id) delete reqData.position_id;
    if (!reqData.join_date) delete reqData.join_date;

    try {
      if (formData.id) {
        await apiPut(`/employees/${formData.id}`, reqData);
      } else {
        await apiPost("/employees", reqData);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Gagal menyimpan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Nonaktifkan karyawan ini?")) return;
    try {
      await apiDelete(`/employees/${id}`);
      fetchData();
    } catch (err) {}
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 relative z-0">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Daftar Karyawan</h2>
        <button onClick={() => {
          setFormData({ id: "", name: "", nik: "", phone: "", address: "", position_id: "", employee_type: "relawan", bank_name: "", bank_account: "", bank_holder: "", join_date: "" });
          setShowModal(true);
        }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          <span>➕ Tambah Karyawan</span>
        </button>
      </div>

      {loading ? (<div className="h-32 flex items-center justify-center">Loading...</div>) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-100 font-medium text-xs uppercase text-gray-500">
                <th className="py-3 px-4">Nama</th>
                <th className="py-3 px-4">Tipe</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Bank</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">{e.name}</p>
                    <p className="text-xs text-gray-500">{e.phone || "No HP -"}</p>
                  </td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">{e.employee_type}</span></td>
                  <td className="py-3 px-4">{e.position_name || "Tanpa Jabatan"}</td>
                  <td className="py-3 px-4 text-xs">
                    {e.bank_name ? `${e.bank_name} - ${e.bank_account}` : "-"}
                  </td>
                  <td className="py-3 px-4 text-center space-x-2">
                    <button onClick={() => { setFormData(e); setShowModal(true); }} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-500">Belum ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <BaseModal isOpen={showModal} onClose={() => setShowModal(false)} title={`${formData.id ? "Edit" : "Tambah"} Karyawan`} maxWidth="max-w-lg">
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipe</label>
                  <select value={formData.employee_type} onChange={e => setFormData({...formData, employee_type: e.target.value})} className="w-full p-2 border rounded-lg">
                    <option value="relawan">Relawan</option>
                    <option value="karyawan_tetap">Karyawan Tetap</option>
                    <option value="kader">Kader</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Jabatan</label>
                  <select value={formData.position_id || ""} onChange={e => setFormData({...formData, position_id: e.target.value})} className="w-full p-2 border rounded-lg">
                    <option value="">-- Pilih Jabatan --</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">HP</label><input value={formData.phone || ""} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-1">NIK</label><input value={formData.nik || ""} onChange={e => setFormData({...formData, nik: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bank (Opsional)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Nama Bank" value={formData.bank_name || ""} onChange={e => setFormData({...formData, bank_name: e.target.value})} className="p-2 border rounded-lg" />
                  <input placeholder="No Rekening" value={formData.bank_account || ""} onChange={e => setFormData({...formData, bank_account: e.target.value})} className="p-2 border rounded-lg" />
                  <input placeholder="A.N" value={formData.bank_holder || ""} onChange={e => setFormData({...formData, bank_holder: e.target.value})} className="p-2 border rounded-lg" />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
              </div>
            </form>
      </BaseModal>
    </div>
  );
}

// ─── JABATAN TAB ──────────────────────────────────────────────────────────────
// Sama polanya seperti Karyawan, lebih sederhana
function JabatanTab() {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ id: "", name: "", salary_type: "harian", base_salary: "" });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiGet("/employees/positions");
      setPositions(res.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, ...rest } = formData;
      const payload = {...rest, base_salary: Number(formData.base_salary)};
      if (id) {
        await apiPut(`/employees/positions/${id}`, payload);
      } else {
        await apiPost("/employees/positions", payload);
      }
      setShowModal(false); 
      fetchData();
    } catch (err: any) { alert(err.response?.data?.detail || "Error"); }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 relative z-0">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Daftar Jabatan</h2>
        <button onClick={() => { setFormData({ id: "", name: "", salary_type: "harian", base_salary: "" }); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-2">
          <span>➕ Tambah Jabatan</span>
        </button>
      </div>

      {loading ? (<div>Loading...</div>) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-100 font-medium text-xs uppercase text-gray-500">
                <th className="py-3 px-4">Nama Jabatan</th>
                <th className="py-3 px-4">Tipe Gaji</th>
                <th className="py-3 px-4">Nominal</th>
                <th className="py-3 px-4">Jumlah Pegawai</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {positions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{p.name}</td>
                  <td className="py-3 px-4 capitalize">{p.salary_type}</td>
                  <td className="py-3 px-4 min-w-[120px]">Rp {Number(p.base_salary).toLocaleString("id-ID")}</td>
                  <td className="py-3 px-4">{p.employee_count}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => { setFormData({ ...p, base_salary: p.base_salary.toString() }); setShowModal(true); }} className="text-blue-600 hover:underline cursor-pointer">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BaseModal isOpen={showModal} onClose={() => setShowModal(false)} title={`${formData.id ? "Edit" : "Tambah"} Jabatan`} maxWidth="max-w-sm">
            <form onSubmit={handleSave} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nama</label><input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipe Gaji</label>
                <select value={formData.salary_type} onChange={e => setFormData({...formData, salary_type: e.target.value})} className="w-full p-2 border rounded-lg">
                  <option value="harian">Harian</option><option value="mingguan">Mingguan</option><option value="bulanan">Bulanan</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">Nominal</label><input required type="number" value={formData.base_salary} onChange={e => setFormData({...formData, base_salary: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">Simpan</button>
              </div>
            </form>
      </BaseModal>
    </div>
  );
}

// ─── ABSENSI TAB ──────────────────────────────────────────────────────────────
function AbsensiTab() {
  const [data, setData] = useState<{days: string[], employees: any[]}>({days: [], employees: []});
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<any[]>([]); // To hold unsaved changes
  const [saving, setSaving] = useState(false);

  // Format date to locale helper
  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("id-ID", { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const fetchAttendance = async (dateParam?: string) => {
    try {
      setLoading(true);
      const url = `/attendance/week${dateParam ? `?week_start=${dateParam}` : ""}`;
      const res = await apiGet(url);
      if (res) {
        setData(res.data || {days: [], employees: []});
        if (!dateParam && res.data?.week_start) setWeekStart(res.data.week_start);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAttendance(); }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // try to snap to monday
    const d = new Date(e.target.value);
    const day = d.getDay() || 7;
    if (day !== 1) {
      d.setHours(-24 * (day - 1));
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const st = `${yyyy}-${mm}-${dd}`;
    setWeekStart(st);
    fetchAttendance(st);
    setChanges([]); // clear unsaved
  };

  const toggleStatus = (empId: string, date: string, currentStatus: string | null) => {
    // Cycle: null (hadir) -> 'sakit' -> 'izin' -> 'alpa' -> null
    const order = [null, "sakit", "izin", "alpa"];
    const idx = order.indexOf(currentStatus as any);
    const nextStatus = order[(idx + 1) % order.length];

    // Update local state optimistic
    const newEmps = [...data.employees];
    const emp = newEmps.find(e => e.id === empId);
    if (emp) {
      emp.attendance[date] = nextStatus;
      setData({...data, employees: newEmps});
    }

    // Add to changes track for batch save
    const newChanges = [...changes];
    const existingIdx = newChanges.findIndex(c => c.employee_id === empId && c.date === date);
    if (existingIdx >= 0) {
      newChanges[existingIdx].status = nextStatus;
    } else {
      newChanges.push({ employee_id: empId, date, status: nextStatus, notes: "" });
    }
    setChanges(newChanges);
  };

  const handleSave = async () => {
    if (changes.length === 0) return;
    try {
      setSaving(true);
      await apiPost("/attendance/batch", { records: changes });
      setChanges([]);
      fetchAttendance(weekStart); // refresh
    } catch (err) { alert("Error"); } finally { setSaving(false); }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 relative z-0">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Grid Absensi Mingguan</h2>
          <p className="text-xs text-gray-500">Klik pada sel grid untuk mengubah status (Hadir → Sakit → Izin → Alpa)</p>
        </div>
        <div className="flex items-center space-x-4">
          <input type="date" className="p-2 border rounded-lg text-sm" value={weekStart} onChange={handleDateChange} />
          <button 
            disabled={changes.length === 0 || saving}
            onClick={handleSave} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${changes.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <span>💾 Simpan ({changes.length})</span>
          </button>
        </div>
      </div>

      {loading ? (<div>Loading...</div>) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 font-medium text-xs text-gray-700 border-b border-gray-200">
                <th className="py-2 px-4 border-r border-gray-200 sticky left-0 bg-gray-50 z-10 w-48">Karyawan</th>
                {data.days.map(d => (
                  <th key={d} className="py-2 px-2 border-r border-gray-200 text-center w-24">
                    {formatDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {data.employees.map(e => (
                <tr key={e.id} className="hover:bg-blue-50/50">
                  <td className="py-2 px-4 border-r border-gray-200 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <p className="font-medium whitespace-nowrap">{e.name}</p>
                    <p className="text-xs text-gray-500 whitespace-nowrap">{e.position_name}</p>
                  </td>
                  {data.days.map(d => {
                    const st = e.attendance[d];
                    const stMap: any = {
                      null: { bg: "bg-white hover:bg-gray-50 cursor-pointer", text: "" },
                      "sakit": { bg: "bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer font-medium", text: "S" },
                      "izin": { bg: "bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer font-medium", text: "I" },
                      "alpa": { bg: "bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer font-medium", text: "A" },
                    };
                    const config = stMap[String(st)] || stMap["null"];

                    return (
                      <td key={d} className="border-r border-gray-200 p-1">
                        <div 
                          onClick={() => toggleStatus(e.id, d, st)}
                          className={`h-10 w-full flex items-center justify-center rounded transition-colors ${config.bg}`}
                        >
                          {config.text || <span className="opacity-0 group-hover:opacity-100 text-green-300">✔️</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PENGGAJIAN TAB ───────────────────────────────────────────────────────────
function PenggajianTab() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null); // For detail view
  const [periodItems, setPeriodItems] = useState<any[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({ name: "", start_date: "", end_date: "", working_days: "20" });

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await apiGet("/payroll/periods");
      setPeriods(res.data || []);
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchPeriods(); 
    apiGet("/employees").then(res => {
      const active = (res.data || []).filter((e: any) => e.is_active);
      setActiveEmployees(active);
    }).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployees.length === 0) {
      alert("Pilih minimal 1 karyawan");
      return;
    }
    try {
      const reqData = { ...formData, working_days: parseInt(formData.working_days), employee_ids: selectedEmployees };
      await apiPost("/payroll/periods", reqData);
      setShowModal(false);
      fetchPeriods();
    } catch (err: any) { alert(err.response?.data?.detail || "Gagal membuat periode"); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Batal dan hapus periode draft ini?")) return;
    try {
      await apiDelete(`/payroll/periods/${id}`);
      fetchPeriods();
    } catch (err: any) { alert(err.response?.data?.detail || "Error menghapus periode, pastikan status draft"); }
  };

  const loadDetails = async (id: string) => {
    try {
      const res = await apiGet(`/payroll/periods/${id}`);
      setSelectedPeriod(res.data?.period);
      setPeriodItems(res.data?.items || []);
    } catch (err) {}
  };

  const handleAction = async (id: string, action: "approve" | "pay") => {
    if (!confirm(`Yakin untuk ${action} periode ini?`)) return;
    try {
      if (action === "pay") {
        await apiPost(`/payroll/periods/${id}/pay`);
      } else {
        await apiPut(`/payroll/periods/${id}/${action}`);
      }
      fetchPeriods();
      if (selectedPeriod?.id === id) loadDetails(id);
    } catch (err) {}
  };

  if (selectedPeriod) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 relative z-0">
        <div className="flex items-center space-x-4 mb-6 pb-6 border-b">
          <button onClick={() => setSelectedPeriod(null)} className="text-gray-500 hover:text-gray-900 cursor-pointer">← Kembali</button>
          <h2 className="text-xl font-bold">{selectedPeriod.name}</h2>
          <span className={`px-2 py-1 rounded text-xs uppercase font-bold 
            ${selectedPeriod.status === 'draft' ? 'bg-gray-100 text-gray-700' : 
              selectedPeriod.status === 'approved' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
            {selectedPeriod.status}
          </span>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-500">Total Dibayar</p>
            <p className="text-2xl font-bold">Rp {Number(selectedPeriod.total_amount).toLocaleString('id-ID')}</p>
          </div>
          <div className="flex space-x-2">
            {selectedPeriod.status === 'draft' && <button onClick={() => handleAction(selectedPeriod.id, "approve")} className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 cursor-pointer font-bold">Approve</button>}
            {selectedPeriod.status === 'approved' && <button onClick={() => handleAction(selectedPeriod.id, "pay")} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer font-bold">Bayar Sekarang</button>}
            {selectedPeriod.status === 'paid' && (
              <a href={`/api/payroll/periods/${selectedPeriod.id}/slip/batch`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 cursor-pointer">
                <span>📥 Download Semua Slip (ZIP)</span>
              </a>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 font-medium text-xs uppercase text-gray-500">
                <th className="py-2 px-4 border-b">Nama</th>
                <th className="py-2 px-4 border-b">Jabatan</th>
                <th className="py-2 px-4 border-b">Hadir/Alpa</th>
                <th className="py-2 px-4 border-b">Gross</th>
                <th className="py-2 px-4 border-b">Net</th>
                <th className="py-2 px-4 border-b text-center">Slip</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {periodItems.map(item => (
                <tr key={item.id} className="border-b">
                  <td className="py-2 px-4 font-medium">{item.employee_name}</td>
                  <td className="py-2 px-4 text-xs text-gray-500">{item.position_name}</td>
                  <td className="py-2 px-4">{item.present_days}/{item.absent_days}</td>
                  <td className="py-2 px-4">Rp {Number(item.gross_amount).toLocaleString('id-ID')}</td>
                  <td className="py-2 px-4 font-medium text-green-700">Rp {Number(item.net_amount).toLocaleString('id-ID')}</td>
                  <td className="py-2 px-4 text-center">
                    {selectedPeriod.status === 'paid' && (
                      <a href={`/api/payroll/periods/${selectedPeriod.id}/slip/${item.employee_id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 text-lg" title="Cetak Slip">
                        🖨️
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6 relative z-0">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Daftar Periode Penggajian</h2>
        <button onClick={() => {
          setSelectedEmployees(activeEmployees.map(e => e.id));
          setShowModal(true);
        }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer">
          <span>➕ Buat Periode Baru</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-100 font-medium text-xs uppercase text-gray-500">
              <th className="py-3 px-4">Nama Periode</th>
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Total Amount</th>
              <th className="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {periods.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => loadDetails(p.id)}>
                <td className="py-3 px-4 font-bold text-blue-600">{p.name}</td>
                <td className="py-3 px-4 text-xs">{p.start_date} - {p.end_date}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs uppercase font-bold 
                    ${p.status === 'draft' ? 'bg-gray-100 text-gray-700' : p.status === 'approved' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-3 px-4 font-medium">Rp {Number(p.total_amount).toLocaleString('id-ID')}</td>
                <td className="py-3 px-4 text-center text-lg">
                  <span className="text-gray-400">📄</span>
                  <button onClick={(e) => handleDelete(p.id, e)} className="ml-2 text-red-500 hover:text-red-700 cursor-pointer" title="Hapus Periode">
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {periods.length === 0 && !loading && <tr><td colSpan={5} className="py-4 text-center">Belum ada periode.</td></tr>}
          </tbody>
        </table>
      </div>

      <BaseModal isOpen={showModal} onClose={() => setShowModal(false)} title="Buat Periode Penggajian" maxWidth="max-w-sm">
            <p className="text-sm text-gray-500 mb-4">Sistem akan mengambil snapshot gaji saat ini dan menghitung berdasarkan data absensi (jika ada).</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nama Periode</label><input required placeholder="Maret 2026 Shift A" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-sm font-medium mb-1">Mulai</label><input required type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full p-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">Selesai</label><input required type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full p-2 border rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Target Hari Kerja (Max Hadir)</label><input required type="number" value={formData.working_days} onChange={e => setFormData({...formData, working_days: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Pilih Karyawan</label>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1 bg-gray-50 text-sm">
                  {activeEmployees.map(emp => (
                    <label key={emp.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-100 rounded">
                      <input 
                        type="checkbox" 
                        checked={selectedEmployees.includes(emp.id)}
                        onChange={(e) => {
                           if(e.target.checked) setSelectedEmployees([...selectedEmployees, emp.id]);
                           else setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                        }} 
                      />
                      <span>{emp.name} ({emp.position_name || "Tanpa Jabatan"})</span>
                    </label>
                  ))}
                  {activeEmployees.length === 0 && <div className="text-gray-500 italic p-1">Belum ada karyawan aktif.</div>}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">Generate</button>
              </div>
            </form>
      </BaseModal>
    </div>
  );
}
