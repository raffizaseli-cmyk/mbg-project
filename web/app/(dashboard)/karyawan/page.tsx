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
  Sparkles,
  Clock,
  CreditCard,
  Building2,
  UserCheck,
  AlertTriangle,
  FileSpreadsheet
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

  const tabs: { id: Tab; label: string; desc: string; icon: any; activeClass: string }[] = [
    {
      id: "Karyawan",
      label: "Daftar Staf",
      desc: "Database Relawan & Tim Dapur",
      icon: Users,
      activeClass: "bg-blue-600 text-white shadow-md shadow-blue-500/25",
    },
    {
      id: "Jabatan",
      label: "Jabatan & Tarif",
      desc: "Skema Gaji & Honor Kerja",
      icon: Briefcase,
      activeClass: "bg-purple-600 text-white shadow-md shadow-purple-500/25",
    },
    {
      id: "Absensi",
      label: "Presensi Mingguan",
      desc: "Grid Kehadiran & Status Masuk",
      icon: CalendarCheck,
      activeClass: "bg-emerald-600 text-white shadow-md shadow-emerald-500/25",
    },
    {
      id: "Penggajian",
      label: "Payroll & Gaji",
      desc: "Periode Gaji & Cetak Slip",
      icon: Coins,
      activeClass: "bg-amber-600 text-white shadow-md shadow-amber-500/25",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6 animate-fade-in">
      {/* ─── Hero Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 text-[11px] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Manajemen SDM & Operasional
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">Dapur Sentral MBG</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Karyawan, Presensi & Payroll
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Kelola data staf operasional, penugasan jabatan, presensi harian, dan kalkulasi pembayaran honor relawan.
          </p>
        </div>
      </div>

      {/* ─── Modern Tab Navigation ─── */}
      <div className="sticky top-0 z-20 pt-1 pb-2 backdrop-blur-md">
        <div className="flex gap-2.5 bg-white/85 backdrop-blur-xl rounded-2xl p-2 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? tab.activeClass
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div>{tab.label}</div>
                  <div
                    className={`text-[10px] font-normal hidden sm:block ${
                      isActive ? "text-white/80" : "text-slate-400"
                    }`}
                  >
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Active Tab Content ─── */}
      <div className="transition-all duration-200">
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
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Staf Terdaftar</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount} Orang</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Relawan Dapur MBG</p>
            <h3 className="text-2xl font-extrabold text-amber-700 mt-1">{relawanCount} Orang</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Karyawan Tetap & Kader</p>
            <h3 className="text-2xl font-extrabold text-indigo-700 mt-1">{tetapCount} Orang</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6">
        {/* Controls Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, no. HP, atau jabatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter Pill */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterType === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterType("relawan")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterType === "relawan"
                    ? "bg-white text-amber-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Relawan
              </button>
              <button
                onClick={() => setFilterType("karyawan_tetap")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterType === "karyawan_tetap"
                    ? "bg-white text-indigo-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Karyawan Tetap
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
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 hover:-translate-y-0.5 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Karyawan</span>
          </button>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Memuat data staf...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Nama & Staf</th>
                  <th className="py-3.5 px-4">Tipe Keanggotaan</th>
                  <th className="py-3.5 px-4">Jabatan Dapur</th>
                  <th className="py-3.5 px-4">Rekening Penyaluran</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEmployees.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-xs shrink-0">
                          {e.name ? e.name.charAt(0) : "S"}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-snug">{e.name}</p>
                          <p className="text-xs text-slate-500">
                            {e.phone ? `📱 ${e.phone}` : "No HP tidak diisi"}
                            {e.nik ? ` • NIK: ${e.nik}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          e.employee_type === "relawan"
                            ? "bg-amber-50 text-amber-700 border border-amber-200/80"
                            : e.employee_type === "karyawan_tetap"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            e.employee_type === "relawan"
                              ? "bg-amber-500"
                              : e.employee_type === "karyawan_tetap"
                              ? "bg-indigo-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        {e.employee_type === "relawan"
                          ? "Relawan"
                          : e.employee_type === "karyawan_tetap"
                          ? "Karyawan Tetap"
                          : e.employee_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {e.position_name || (
                          <span className="text-slate-400 italic">Tanpa Jabatan</span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {e.bank_name ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            <strong className="text-slate-900">{e.bank_name}</strong> - {e.bank_account}{" "}
                            {e.bank_holder && <span className="text-slate-500">({e.bank_holder})</span>}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setFormData(e);
                            setShowModal(true);
                          }}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit Staf"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id, e.name)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
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
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      Tidak ditemukan data karyawan yang sesuai.
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
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Lengkap <span className="text-rose-500">*</span>
            </label>
            <input
              required
              placeholder="Contoh: Siti Rahmawati"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipe Keanggotaan</label>
              <select
                value={formData.employee_type}
                onChange={(e) => setFormData({ ...formData, employee_type: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="relawan">Relawan Dapur</option>
                <option value="karyawan_tetap">Karyawan Tetap</option>
                <option value="kader">Kader Posyandu/PKK</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jabatan Dapur</label>
              <select
                value={formData.position_id || ""}
                onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nomor Handphone (WhatsApp)</label>
              <input
                placeholder="081234567890"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">NIK (KTP)</label>
              <input
                placeholder="16 digit NIK"
                value={formData.nik || ""}
                onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              Informasi Rekening Bank (Opsional)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="Bank (e.g. BRI)"
                value={formData.bank_name || ""}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <input
                placeholder="No. Rekening"
                value={formData.bank_account || ""}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <input
                placeholder="Atas Nama"
                value={formData.bank_holder || ""}
                onChange={(e) => setFormData({ ...formData, bank_holder: e.target.value })}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
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
    <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Struktur Jabatan & Standar Honor</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Daftar posisi operasional dapur MBG dan besaran honor dasar per unit kerja.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({ id: "", name: "", salary_type: "harian", base_salary: "" });
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-purple-600/20 hover:-translate-y-0.5 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Jabatan</span>
        </button>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm gap-2">
          <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <span>Memuat data jabatan...</span>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama Posisi / Jabatan</th>
                <th className="py-3.5 px-4">Skema Honor</th>
                <th className="py-3.5 px-4">Tarif Dasar</th>
                <th className="py-3.5 px-4">Personel Terisi</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {positions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 capitalize">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {p.salary_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {formatRp(p.base_salary)}
                    <span className="text-xs font-normal text-slate-400"> /{p.salary_type}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-slate-700 font-semibold text-xs">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {p.employee_count ?? 0} Staf
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => {
                        setFormData({ ...p, base_salary: p.base_salary.toString() });
                        setShowModal(true);
                      }}
                      className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                      title="Edit Jabatan"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {positions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                    Belum ada jabatan dibuat. Klik tombol di atas untuk menambah.
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
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Jabatan</label>
            <input
              required
              placeholder="Contoh: Juru Masak (Chef Utama)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Skema Pembayaran</label>
            <select
              value={formData.salary_type}
              onChange={(e) => setFormData({ ...formData, salary_type: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            >
              <option value="harian">Harian</option>
              <option value="mingguan">Mingguan</option>
              <option value="bulanan">Bulanan</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Besaran Honor (Rp)</label>
            <input
              required
              type="number"
              min="0"
              step="1000"
              placeholder="Contoh: 150000"
              value={formData.base_salary}
              onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
            {formData.base_salary && (
              <p className="text-xs text-purple-700 font-semibold mt-1">
                Preview: {formatRp(formData.base_salary)} / {formData.salary_type}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer"
            >
              Simpan Jabatan
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
    // Cycle: null (Hadir) -> 'sakit' -> 'izin' -> 'alpa' -> null
    const order = [null, "sakit", "izin", "alpa"];
    const idx = order.indexOf(currentStatus as any);
    const nextStatus = order[(idx + 1) % order.length];

    // Update local state optimistic
    const newEmps = [...data.employees];
    const emp = newEmps.find((e) => e.id === empId);
    if (emp) {
      emp.attendance[date] = nextStatus;
      setData({ ...data, employees: newEmps });
    }

    // Add to changes track for batch save
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
    <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Matriks Presensi Mingguan</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Klik sel kotak kehadiran untuk mengubah status presensi harian secara interaktif.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Week Navigator */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => shiftWeek(-7)}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
              title="Minggu Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              className="px-2 py-1 bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              value={weekStart}
              onChange={handleDateChange}
            />
            <button
              onClick={() => shiftWeek(7)}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
              title="Minggu Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Save Button */}
          <button
            disabled={changes.length === 0 || saving}
            onClick={handleSave}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm ${
              changes.length > 0
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25 cursor-pointer animate-pulse"
                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>
              {saving ? "Menyimpan..." : `Simpan Perubahan ${changes.length > 0 ? `(${changes.length})` : ""}`}
            </span>
          </button>
        </div>
      </div>

      {/* Legend Badges */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
        <span className="text-slate-400 font-medium">Petunjuk Status:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Hadir (Default)
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold border border-amber-200">
          <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-bold">
            S
          </span>{" "}
          Sakit
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
          <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-900 flex items-center justify-center text-[10px] font-bold">
            I
          </span>{" "}
          Izin
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200">
          <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-900 flex items-center justify-center text-[10px] font-bold">
            A
          </span>{" "}
          Alpa
        </span>
      </div>

      {/* Grid Table */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm gap-2">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span>Memuat jadwal absensi mingguan...</span>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-xs">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-700">
                <th className="py-3 px-4 border-r border-slate-200 sticky left-0 bg-slate-50 z-10 w-52 font-bold uppercase tracking-wider">
                  Nama Personel
                </th>
                {data.days.map((d) => {
                  const { weekday, dayMonth } = formatDate(d);
                  return (
                    <th key={d} className="py-3 px-2 border-r border-slate-200 text-center w-28">
                      <div className="font-bold text-slate-800">{weekday}</div>
                      <div className="text-[11px] font-normal text-slate-500">{dayMonth}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.employees.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 border-r border-slate-200 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <p className="font-bold text-slate-900 leading-snug whitespace-nowrap">{e.name}</p>
                    <p className="text-xs text-slate-500 whitespace-nowrap font-medium">
                      {e.position_name || "Tanpa Jabatan"}
                    </p>
                  </td>
                  {data.days.map((d) => {
                    const st = e.attendance[d];
                    const stMap: any = {
                      null: {
                        bg: "bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-200/60 text-emerald-700",
                        content: (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-[11px] font-bold">Hadir</span>
                          </div>
                        ),
                      },
                      sakit: {
                        bg: "bg-amber-100/90 hover:bg-amber-200/80 border border-amber-300 text-amber-900",
                        content: <span className="font-bold text-xs">Sakit</span>,
                      },
                      izin: {
                        bg: "bg-blue-100/90 hover:bg-blue-200/80 border border-blue-300 text-blue-900",
                        content: <span className="font-bold text-xs">Izin</span>,
                      },
                      alpa: {
                        bg: "bg-rose-100/90 hover:bg-rose-200/80 border border-rose-300 text-rose-900",
                        content: <span className="font-bold text-xs">Alpa</span>,
                      },
                    };
                    const config = stMap[String(st)] || stMap["null"];

                    return (
                      <td key={d} className="border-r border-slate-200 p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleStatus(e.id, d, st)}
                          className={`h-11 w-full flex items-center justify-center rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 ${config.bg}`}
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
                  <td colSpan={data.days.length + 1} className="py-12 text-center text-slate-400">
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
      alert("Pilih minimal 1 staf karyawan untuk periode penggajian ini.");
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
    if (!confirm("Batalkan dan hapus periode penggajian draft ini?")) return;
    try {
      await apiDelete(`/payroll/periods/${id}`);
      fetchPeriods();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Gagal menghapus periode (pastikan status draft)");
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
        : "Bayar dan bukukan pengeluaran gaji ini ke sistem?";
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

  // Authenticated PDF Download
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
      alert("Gagal mengunduh slip PDF. Pastikan hak akses memadai.");
    }
  };

  // Authenticated Batch ZIP Download
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

  // ─── Detail View ───
  if (selectedPeriod) {
    return (
      <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPeriod(null)}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900">{selectedPeriod.name}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs uppercase font-bold ${
                    selectedPeriod.status === "draft"
                      ? "bg-slate-100 text-slate-700 border border-slate-200"
                      : selectedPeriod.status === "approved"
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {selectedPeriod.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedPeriod.start_date} s/d {selectedPeriod.end_date} • Target {selectedPeriod.working_days} Hari
                Kerja
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedPeriod.status === "draft" && (
              <button
                onClick={() => handleAction(selectedPeriod.id, "approve")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Periode</span>
              </button>
            )}

            {selectedPeriod.status === "approved" && (
              <button
                onClick={() => handleAction(selectedPeriod.id, "pay")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Coins className="w-4 h-4" />
                <span>Bayar & Bukukan Kas</span>
              </button>
            )}

            {selectedPeriod.status === "paid" && (
              <button
                onClick={handleDownloadBatchZip}
                disabled={downloadingBatch}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingBatch ? "Membuat ZIP..." : "Download Semua Slip (ZIP)"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Amount Pill */}
        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pembayaran Gaji</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {formatRp(selectedPeriod.total_amount)}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah Penerima</p>
            <h3 className="text-xl font-bold text-slate-800 mt-1">{periodItems.length} Staf</h3>
          </div>
        </div>

        {/* Table of Items */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama Staf</th>
                <th className="py-3.5 px-4">Jabatan</th>
                <th className="py-3.5 px-4 text-center">Hadir / Alpa</th>
                <th className="py-3.5 px-4">Gaji Kotor</th>
                <th className="py-3.5 px-4">Gaji Bersih (Net)</th>
                <th className="py-3.5 px-4 text-center">Cetak Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {periodItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{item.employee_name}</td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                    {item.position_name || "Tanpa Jabatan"}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                      <span className="text-emerald-700">{item.present_days} Hadir</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-rose-700">{item.absent_days} Alpa</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">{formatRp(item.gross_amount)}</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-700">{formatRp(item.net_amount)}</td>
                  <td className="py-3.5 px-4 text-center">
                    {selectedPeriod.status === "paid" ? (
                      <button
                        onClick={() => handleDownloadSingleSlip(item.employee_id, item.employee_name)}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center gap-1 cursor-pointer font-semibold text-xs"
                        title="Unduh Slip PDF"
                      >
                        <Printer className="w-4 h-4" />
                        <span>PDF</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Tersedia usai bayar</span>
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
    <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Daftar Periode Penggajian & Honor</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Snapshot kalkulasi upah harian/bulanan berdasarkan rekapan presensi staf dapur.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedEmployees(activeEmployees.map((e) => e.id));
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-600/20 hover:-translate-y-0.5 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Periode Baru</span>
        </button>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm gap-2">
          <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <span>Memuat riwayat periode payroll...</span>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama Periode</th>
                <th className="py-3.5 px-4">Rentang Tanggal</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Total Anggaran Gaji</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {periods.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => loadDetails(p.id)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                    {p.start_date} s/d {p.end_date}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        p.status === "draft"
                          ? "bg-slate-100 text-slate-700 border border-slate-200"
                          : p.status === "approved"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          p.status === "draft"
                            ? "bg-slate-400"
                            : p.status === "approved"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{formatRp(p.total_amount)}</td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadDetails(p.id);
                        }}
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Buka Detail"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {p.status === "draft" && (
                        <button
                          onClick={(e) => handleDelete(p.id, e)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
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
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                    Belum ada periode penggajian. Klik "Buat Periode Baru" untuk mengenerate.
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
        <p className="text-xs text-slate-500 mb-4">
          Sistem akan menghitung gaji pokok dan kehadiran staf secara otomatis selama rentang tanggal kerja yang
          dipilih.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Periode</label>
            <input
              required
              placeholder="Contoh: Maret 2026 - Shift Masak Utama"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal Mulai</label>
              <input
                required
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal Selesai</label>
              <input
                required
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Hari Kerja (Maksimal Hari Masuk)
            </label>
            <input
              required
              type="number"
              min="1"
              max="31"
              value={formData.working_days}
              onChange={(e) => setFormData({ ...formData, working_days: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Pilih Staf Penerima ({selectedEmployees.length}/{activeEmployees.length})
              </label>
              <button
                type="button"
                onClick={() => {
                  if (selectedEmployees.length === activeEmployees.length) {
                    setSelectedEmployees([]);
                  } else {
                    setSelectedEmployees(activeEmployees.map((e) => e.id));
                  }
                }}
                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
              >
                {selectedEmployees.length === activeEmployees.length ? "Batal Pilih Semua" : "Pilih Semua"}
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1 bg-slate-50 text-xs">
              {activeEmployees.map((emp) => (
                <label
                  key={emp.id}
                  className="flex items-center gap-2.5 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedEmployees([...selectedEmployees, emp.id]);
                      else setSelectedEmployees(selectedEmployees.filter((id) => id !== emp.id));
                    }}
                  />
                  <span className="font-semibold text-slate-800">{emp.name}</span>
                  <span className="text-slate-400 italic">({emp.position_name || "Tanpa Jabatan"})</span>
                </label>
              ))}

              {activeEmployees.length === 0 && (
                <div className="text-slate-400 italic p-2 text-center">Belum ada karyawan aktif ditemukan.</div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              Generate Periode
            </button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
