"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiDelete, getApiClient } from "@/lib/api";
import { BaseModal } from "@/components/ui/BaseModal";
import {
  Users,
  Briefcase,
  CalendarCheck,
  Coins,
  Plus,
  Search,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Download,
  Printer,
  ArrowLeft,
  CreditCard,
  UserCheck,
  Clock
} from "lucide-react";

type Tab = "Karyawan" | "Jabatan" | "Absensi" | "Penggajian";

function formatRp(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) || 0 : val || 0;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
    .format(n)
    .replace("IDR", "Rp");
}

export default function KaryawanPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Karyawan");

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "Karyawan", label: "Daftar Staf", icon: Users },
    { id: "Jabatan", label: "Jabatan & Tarif", icon: Briefcase },
    { id: "Absensi", label: "Presensi Mingguan", icon: CalendarCheck },
    { id: "Penggajian", label: "Payroll & Gaji", icon: Coins },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-5">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Karyawan, Presensi & Payroll
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kelola data staf operasional, penugasan jabatan, presensi harian, dan penggajian dapur.
          </p>
        </div>
      </div>

      {/* ─── Tab Navigation Bar ─── */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex gap-1.5 overflow-x-auto no-scrollbar w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Tab Content ─── */}
      <div>
        {activeTab === "Karyawan" && <KaryawanTab />}
        {activeTab === "Jabatan" && <JabatanTab />}
        {activeTab === "Absensi" && <AbsensiTab />}
        {activeTab === "Penggajian" && <PenggajianTab />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. KARYAWAN TAB
// ─────────────────────────────────────────────────────────────────────────────
function KaryawanTab() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    nik: "",
    phone: "",
    address: "",
    position_id: "",
    employee_type: "relawan",
    bank_name: "",
    bank_account: "",
    bank_holder: "",
    join_date: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, posRes] = await Promise.all([
        apiGet("/employees"),
        apiGet("/employees/positions"),
      ]);
      setEmployees(empRes?.data || []);
      setPositions(posRes?.data || []);
    } catch (err) {
      console.error("Gagal mengambil data karyawan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
      alert(err.response?.data?.detail || "Gagal menyimpan data staf");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Nonaktifkan staf "${name}"?`)) return;
    try {
      await apiDelete(`/employees/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Gagal menonaktifkan karyawan");
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      (e.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.phone || "").includes(searchQuery) ||
      (e.position_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || e.employee_type === filterType;
    return matchesSearch && matchesType;
  });

  const totalCount = employees.length;
  const relawanCount = employees.filter((e) => e.employee_type === "relawan").length;
  const tetapCount = employees.filter((e) => e.employee_type === "karyawan_tetap").length;

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Staf</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{totalCount} Orang</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Relawan Dapur</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{relawanCount} Orang</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Karyawan Tetap & Kader</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{tetapCount} Orang</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, no. HP, atau jabatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  filterType === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterType("relawan")}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  filterType === "relawan" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Relawan
              </button>
              <button
                onClick={() => setFilterType("karyawan_tetap")}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  filterType === "karyawan_tetap" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tetap
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              setFormData({
                id: "",
                name: "",
                nik: "",
                phone: "",
                address: "",
                position_id: "",
                employee_type: "relawan",
                bank_name: "",
                bank_account: "",
                bank_holder: "",
                join_date: "",
              });
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Karyawan</span>
          </button>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="h-36 flex items-center justify-center text-slate-400 text-sm gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Memuat data staf...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Nama & Kontak</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5">Jabatan</th>
                  <th className="py-2.5 px-3.5">Rekening Bank</th>
                  <th className="py-2.5 px-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5">
                      <div className="font-semibold text-slate-900 leading-tight">{e.name}</div>
                      <div className="text-xs text-slate-500">
                        {e.phone ? e.phone : "-"}
                        {e.nik ? ` • NIK: ${e.nik}` : ""}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          e.employee_type === "relawan"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : e.employee_type === "karyawan_tetap"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {e.employee_type === "relawan"
                          ? "Relawan"
                          : e.employee_type === "karyawan_tetap"
                          ? "Karyawan Tetap"
                          : e.employee_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                      {e.position_name || <span className="text-slate-400 italic">Tanpa Jabatan</span>}
                    </td>
                    <td className="py-2.5 px-3.5 text-xs text-slate-600">
                      {e.bank_name ? `${e.bank_name} - ${e.bank_account}` : "-"}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setFormData(e);
                            setShowModal(true);
                          }}
                          className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit Staf"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id, e.name)}
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Nonaktifkan Staf"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                      Tidak ada staf yang sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add / Edit */}
      <BaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={formData.id ? "Edit Data Karyawan" : "Tambah Karyawan Baru"}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-3.5 pt-1 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
            <input
              required
              placeholder="Nama staf"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Staf</label>
              <select
                value={formData.employee_type}
                onChange={(e) => setFormData({ ...formData, employee_type: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="relawan">Relawan Dapur</option>
                <option value="karyawan_tetap">Karyawan Tetap</option>
                <option value="kader">Kader Posyandu/PKK</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan</label>
              <select
                value={formData.position_id || ""}
                onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">-- Pilih Jabatan --</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">No. Handphone (WA)</label>
              <input
                placeholder="081234567890"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIK (KTP)</label>
              <input
                placeholder="16 digit NIK"
                value={formData.nik || ""}
                onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              Rekening Bank (Opsional)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="Bank"
                value={formData.bank_name || ""}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                placeholder="No. Rekening"
                value={formData.bank_account || ""}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                placeholder="Atas Nama"
                value={formData.bank_holder || ""}
                onChange={(e) => setFormData({ ...formData, bank_holder: e.target.value })}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Simpan Staf
            </button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. JABATAN TAB
// ─────────────────────────────────────────────────────────────────────────────
function JabatanTab() {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ id: "", name: "", salary_type: "harian", base_salary: "" });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiGet("/employees/positions");
      setPositions(res?.data || []);
    } catch (err) {
      console.error("Gagal mengambil posisi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, ...rest } = formData;
      const payload = { ...rest, base_salary: Number(formData.base_salary) };
      if (id) {
        await apiPut(`/employees/positions/${id}`, payload);
      } else {
        await apiPost("/employees/positions", payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Gagal menyimpan jabatan");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Daftar Jabatan & Standar Honor</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar posisi staf dapur MBG dan besaran honor per unit kerja.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({ id: "", name: "", salary_type: "harian", base_salary: "" });
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Jabatan</span>
        </button>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-slate-400 text-sm gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Memuat data jabatan...</span>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Nama Jabatan</th>
                <th className="py-2.5 px-3.5">Skema Honor</th>
                <th className="py-2.5 px-3.5">Nominal Tarif</th>
                <th className="py-2.5 px-3.5">Jumlah Staf</th>
                <th className="py-2.5 px-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {positions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3.5 font-semibold text-slate-900">{p.name}</td>
                  <td className="py-2.5 px-3.5 capitalize">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {p.salary_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 font-bold text-slate-900">
                    {formatRp(p.base_salary)}
                    <span className="text-xs font-normal text-slate-400"> /{p.salary_type}</span>
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600 font-medium">
                    {p.employee_count ?? 0} Staf
                  </td>
                  <td className="py-2.5 px-3.5 text-center">
                    <button
                      onClick={() => {
                        setFormData({ ...p, base_salary: p.base_salary.toString() });
                        setShowModal(true);
                      }}
                      className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit Jabatan"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {positions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                    Belum ada jabatan dibuat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add / Edit Position */}
      <BaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={formData.id ? "Edit Jabatan" : "Tambah Jabatan Baru"}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleSave} className="space-y-3 pt-1 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Jabatan</label>
            <input
              required
              placeholder="Contoh: Juru Masak"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Skema Pembayaran</label>
            <select
              value={formData.salary_type}
              onChange={(e) => setFormData({ ...formData, salary_type: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="harian">Harian</option>
              <option value="mingguan">Mingguan</option>
              <option value="bulanan">Bulanan</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Besaran Honor (Rp)</label>
            <input
              required
              type="number"
              min="0"
              placeholder="150000"
              value={formData.base_salary}
              onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              Simpan
            </button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ABSENSI TAB
// ─────────────────────────────────────────────────────────────────────────────
function AbsensiTab() {
  const [data, setData] = useState<{ days: string[]; employees: any[] }>({ days: [], employees: [] });
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return {
        weekday: d.toLocaleDateString("id-ID", { weekday: "short" }),
        dayMonth: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      };
    } catch {
      return { weekday: "", dayMonth: isoStr };
    }
  };

  const fetchAttendance = useCallback(async (dateParam?: string) => {
    try {
      setLoading(true);
      const url = `/attendance/week${dateParam ? `?week_start=${dateParam}` : ""}`;
      const res = await apiGet(url);
      if (res) {
        setData(res.data || { days: [], employees: [] });
        if (!dateParam && res.data?.week_start) setWeekStart(res.data.week_start);
      }
    } catch (err) {
      console.error("Gagal mengambil data absensi:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value);
    const day = d.getDay() || 7;
    if (day !== 1) {
      d.setHours(-24 * (day - 1));
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const st = `${yyyy}-${mm}-${dd}`;
    setWeekStart(st);
    fetchAttendance(st);
    setChanges([]);
  };

  const shiftWeek = (offsetDays: number) => {
    if (!weekStart) return;
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const st = `${yyyy}-${mm}-${dd}`;
    setWeekStart(st);
    fetchAttendance(st);
    setChanges([]);
  };

  const toggleStatus = (empId: string, date: string, currentStatus: string | null) => {
    const order = [null, "sakit", "izin", "alpa"];
    const idx = order.indexOf(currentStatus as any);
    const nextStatus = order[(idx + 1) % order.length];

    const newEmps = [...data.employees];
    const emp = newEmps.find((e) => e.id === empId);
    if (emp) {
      emp.attendance[date] = nextStatus;
      setData({ ...data, employees: newEmps });
    }

    const newChanges = [...changes];
    const existingIdx = newChanges.findIndex((c) => c.employee_id === empId && c.date === date);
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
      fetchAttendance(weekStart);
    } catch (err) {
      alert("Gagal menyimpan perubahan absensi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Grid Presensi Mingguan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Klik sel untuk mengganti status kehadiran (Hadir → Sakit → Izin → Alpa).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week Navigator */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => shiftWeek(-7)}
              className="p-1.5 rounded hover:bg-white text-slate-600 transition-colors cursor-pointer"
              title="Minggu Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              className="px-2 py-0.5 bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              value={weekStart}
              onChange={handleDateChange}
            />
            <button
              onClick={() => shiftWeek(7)}
              className="p-1.5 rounded hover:bg-white text-slate-600 transition-colors cursor-pointer"
              title="Minggu Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Save Button */}
          <button
            disabled={changes.length === 0 || saving}
            onClick={handleSave}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
              changes.length > 0
                ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>{saving ? "Menyimpan..." : `Simpan (${changes.length})`}</span>
          </button>
        </div>
      </div>

      {/* Legend Badges */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
        <span className="text-slate-400 font-medium">Petunjuk:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Hadir
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
          Sakit (S)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
          Izin (I)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold border border-rose-200">
          Alpa (A)
        </span>
      </div>

      {/* Grid Table */}
      {loading ? (
        <div className="h-36 flex items-center justify-center text-slate-400 text-sm gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Memuat jadwal absensi...</span>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse min-w-[650px] text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3.5 border-r border-slate-200 sticky left-0 bg-slate-50 z-10 w-48 font-bold uppercase tracking-wider text-xs">
                  Nama Personel
                </th>
                {data.days.map((d) => {
                  const { weekday, dayMonth } = formatDate(d);
                  return (
                    <th key={d} className="py-2.5 px-2 border-r border-slate-200 text-center w-24">
                      <div className="font-bold text-slate-800">{weekday}</div>
                      <div className="text-xs font-normal text-slate-500">{dayMonth}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.employees.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3.5 border-r border-slate-200 sticky left-0 bg-white">
                    <p className="font-semibold text-slate-900 leading-tight whitespace-nowrap">{e.name}</p>
                    <p className="text-xs text-slate-500 whitespace-nowrap">
                      {e.position_name || "Tanpa Jabatan"}
                    </p>
                  </td>
                  {data.days.map((d) => {
                    const st = e.attendance[d];
                    const stMap: any = {
                      null: {
                        bg: "bg-white hover:bg-slate-50 border border-slate-200 text-emerald-600",
                        content: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
                      },
                      sakit: {
                        bg: "bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold",
                        content: "S",
                      },
                      izin: {
                        bg: "bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-900 font-bold",
                        content: "I",
                      },
                      alpa: {
                        bg: "bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-900 font-bold",
                        content: "A",
                      },
                    };
                    const config = stMap[String(st)] || stMap["null"];

                    return (
                      <td key={d} className="border-r border-slate-200 p-1 text-center">
                        <button
                          type="button"
                          onClick={() => toggleStatus(e.id, d, st)}
                          className={`h-9 w-full flex items-center justify-center rounded-lg transition-colors cursor-pointer text-xs ${config.bg}`}
                        >
                          {config.content}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {data.employees.length === 0 && (
                <tr>
                  <td colSpan={data.days.length + 1} className="py-8 text-center text-slate-400">
                    Belum ada data personel untuk periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PENGGAJIAN TAB
// ─────────────────────────────────────────────────────────────────────────────
function PenggajianTab() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [periodItems, setPeriodItems] = useState<any[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [downloadingBatch, setDownloadingBatch] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    working_days: "20",
  });

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await apiGet("/payroll/periods");
      setPeriods(res?.data || []);
    } catch (err) {
      console.error("Gagal mengambil periode payroll:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
    apiGet("/employees")
      .then((res) => {
        const active = (res?.data || []).filter((e: any) => e.is_active !== false);
        setActiveEmployees(active);
      })
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployees.length === 0) {
      alert("Pilih minimal 1 staf karyawan.");
      return;
    }
    try {
      const reqData = {
        ...formData,
        working_days: parseInt(formData.working_days),
        employee_ids: selectedEmployees,
      };
      await apiPost("/payroll/periods", reqData);
      setShowModal(false);
      fetchPeriods();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Gagal membuat periode payroll baru");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Hapus periode penggajian draft ini?")) return;
    try {
      await apiDelete(`/payroll/periods/${id}`);
      fetchPeriods();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Gagal menghapus periode");
    }
  };

  const loadDetails = async (id: string) => {
    try {
      const res = await apiGet(`/payroll/periods/${id}`);
      setSelectedPeriod(res?.data?.period);
      setPeriodItems(res?.data?.items || []);
    } catch (err) {
      console.error("Gagal mengambil detail payroll:", err);
    }
  };

  const handleAction = async (id: string, action: "approve" | "pay") => {
    const promptMsg =
      action === "approve"
        ? "Setujui kalkulasi periode penggajian ini?"
        : "Bayar dan bukukan pengeluaran gaji ini?";
    if (!confirm(promptMsg)) return;

    try {
      if (action === "pay") {
        await apiPost(`/payroll/periods/${id}/pay`);
      } else {
        await apiPut(`/payroll/periods/${id}/${action}`);
      }
      fetchPeriods();
      if (selectedPeriod?.id === id) loadDetails(id);
    } catch (err: any) {
      alert(err.response?.data?.detail || `Gagal memproses ${action}`);
    }
  };

  const handleDownloadSingleSlip = async (employeeId: string, employeeName: string) => {
    if (!selectedPeriod) return;
    try {
      const client = getApiClient();
      const res = await client.get(`/payroll/periods/${selectedPeriod.id}/slip/${employeeId}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Slip_Gaji_${employeeName.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Gagal mengunduh slip PDF.");
    }
  };

  const handleDownloadBatchZip = async () => {
    if (!selectedPeriod) return;
    setDownloadingBatch(true);
    try {
      const client = getApiClient();
      const res = await client.post(
        `/payroll/periods/${selectedPeriod.id}/slip/batch`,
        {},
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Slip_Gaji_Batch_${selectedPeriod.name.replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Gagal mengunduh berkas ZIP slip gaji.");
    } finally {
      setDownloadingBatch(false);
    }
  };

  if (selectedPeriod) {
    return (
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSelectedPeriod(null)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{selectedPeriod.name}</h2>
                <span
                  className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${
                    selectedPeriod.status === "draft"
                      ? "bg-slate-100 text-slate-700"
                      : selectedPeriod.status === "approved"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {selectedPeriod.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedPeriod.start_date} s/d {selectedPeriod.end_date} • Target {selectedPeriod.working_days} Hari
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedPeriod.status === "draft" && (
              <button
                onClick={() => handleAction(selectedPeriod.id, "approve")}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Approve Periode
              </button>
            )}

            {selectedPeriod.status === "approved" && (
              <button
                onClick={() => handleAction(selectedPeriod.id, "pay")}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Bayar Sekarang
              </button>
            )}

            {selectedPeriod.status === "paid" && (
              <button
                onClick={handleDownloadBatchZip}
                disabled={downloadingBatch}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingBatch ? "Menyiapkan..." : "Download ZIP Slip"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Amount Summary */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pembayaran Gaji</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{formatRp(selectedPeriod.total_amount)}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Penerima</p>
            <h3 className="text-base font-bold text-slate-800 mt-0.5">{periodItems.length} Staf</h3>
          </div>
        </div>

        {/* Table of Items */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Nama Staf</th>
                <th className="py-2.5 px-3.5">Jabatan</th>
                <th className="py-2.5 px-3.5 text-center">Hadir/Alpa</th>
                <th className="py-2.5 px-3.5">Gross</th>
                <th className="py-2.5 px-3.5">Gaji Bersih (Net)</th>
                <th className="py-2.5 px-3.5 text-center">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periodItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3.5 font-semibold text-slate-900">{item.employee_name}</td>
                  <td className="py-2.5 px-3.5 text-xs text-slate-500">{item.position_name || "-"}</td>
                  <td className="py-2.5 px-3.5 text-center text-xs">
                    <span className="text-emerald-700 font-semibold">{item.present_days}</span> /{" "}
                    <span className="text-rose-700 font-semibold">{item.absent_days}</span>
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600">{formatRp(item.gross_amount)}</td>
                  <td className="py-2.5 px-3.5 font-bold text-slate-900">{formatRp(item.net_amount)}</td>
                  <td className="py-2.5 px-3.5 text-center">
                    {selectedPeriod.status === "paid" ? (
                      <button
                        onClick={() => handleDownloadSingleSlip(item.employee_id, item.employee_name)}
                        className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer text-xs inline-flex items-center gap-1 font-semibold"
                        title="Unduh Slip PDF"
                      >
                        <Printer className="w-3.5 h-3.5" /> PDF
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">-</span>
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

  // ─── List of Periods View ───
  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Daftar Periode Penggajian</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar periode kalkulasi honor kerja staf dapur.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedEmployees(activeEmployees.map((e) => e.id));
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Periode Baru</span>
        </button>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-slate-400 text-sm gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Memuat periode...</span>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Nama Periode</th>
                <th className="py-2.5 px-3.5">Rentang Tanggal</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5">Total Gaji</th>
                <th className="py-2.5 px-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => loadDetails(p.id)}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <td className="py-2.5 px-3.5 font-semibold text-blue-600">{p.name}</td>
                  <td className="py-2.5 px-3.5 text-xs text-slate-500">
                    {p.start_date} s/d {p.end_date}
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs uppercase font-bold ${
                        p.status === "draft"
                          ? "bg-slate-100 text-slate-700"
                          : p.status === "approved"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 font-bold text-slate-900">{formatRp(p.total_amount)}</td>
                  <td className="py-2.5 px-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadDetails(p.id);
                        }}
                        className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Buka Detail"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {p.status === "draft" && (
                        <button
                          onClick={(e) => handleDelete(p.id, e)}
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Hapus Periode"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {periods.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                    Belum ada periode penggajian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Create Period */}
      <BaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Periode Penggajian Baru"
        maxWidth="max-w-md"
      >
        <p className="text-xs text-slate-500 mb-3">
          Sistem akan menghitung gaji pokok dan kehadiran staf secara otomatis.
        </p>

        <form onSubmit={handleCreate} className="space-y-3 pt-1 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Periode</label>
            <input
              required
              placeholder="Maret 2026 Shift A"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Mulai</label>
              <input
                required
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Selesai</label>
              <input
                required
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Hari Kerja (Max Hadir)</label>
            <input
              required
              type="number"
              min="1"
              value={formData.working_days}
              onChange={(e) => setFormData({ ...formData, working_days: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Pilih Staf Penerima</label>
              <button
                type="button"
                onClick={() => {
                  if (selectedEmployees.length === activeEmployees.length) {
                    setSelectedEmployees([]);
                  } else {
                    setSelectedEmployees(activeEmployees.map((e) => e.id));
                  }
                }}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                {selectedEmployees.length === activeEmployees.length ? "Batal Semua" : "Pilih Semua"}
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50 text-xs">
              {activeEmployees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 p-1 hover:bg-white rounded cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-blue-600"
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedEmployees([...selectedEmployees, emp.id]);
                      else setSelectedEmployees(selectedEmployees.filter((id) => id !== emp.id));
                    }}
                  />
                  <span className="text-slate-800 font-medium">{emp.name}</span>
                  <span className="text-slate-400">({emp.position_name || "Tanpa Jabatan"})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              Generate
            </button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
