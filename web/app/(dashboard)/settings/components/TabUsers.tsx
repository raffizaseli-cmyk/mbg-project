"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { BaseModal } from "@/components/ui/BaseModal";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  has_telegram: boolean;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

type Role = "admin" | "kasir" | "viewer" | "driver";
const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "admin",  label: "Admin",  desc: "Semua fitur kecuali kelola user" },
  { value: "kasir",  label: "Kasir",  desc: "Input transaksi harian" },
  { value: "viewer", label: "Viewer", desc: "Lihat laporan saja" },
  { value: "driver", label: "Driver", desc: "Lihat jadwal pengiriman" },
];

const ROLE_COLORS: Record<string, string> = {
  owner:  "bg-blue-900 text-white",
  admin:  "bg-blue-600 text-white",
  kasir:  "bg-green-600 text-white",
  viewer: "bg-gray-500 text-white",
  driver: "bg-amber-500 text-white",
};

/* ─── Component ─────────────────────────────────────────────────────────── */
export function TabUsers() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [showInvite, setShowInvite] = useState(false);
  const [roleModal, setRoleModal] = useState<TeamUser | null>(null);
  const [statusModal, setStatusModal] = useState<TeamUser | null>(null);

  // Invite form
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [invPassword, setInvPassword] = useState("");
  const [invRole, setInvRole] = useState<Role>("kasir");
  const [invLoading, setInvLoading] = useState(false);

  // Role change
  const [newRole, setNewRole] = useState<Role>("admin");
  const [roleLoading, setRoleLoading] = useState(false);

  // Status change
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet("/auth/users");
      setUsers(res.data || []);
      setError("");
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal memuat data user");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── Handlers ────────────────────────────────────────────────────────── */
  const handleInvite = async () => {
    if (!invName || !invEmail || !invPassword) return;
    try {
      setInvLoading(true);
      await apiPost("/auth/users/invite", {
        name: invName, email: invEmail, password: invPassword, role: invRole,
      });
      setShowInvite(false);
      setInvName(""); setInvEmail(""); setInvPassword(""); setInvRole("kasir");
      fetchUsers();
    } catch (e: any) {
      alert(e?.response?.data?.error || "Gagal menambah user");
    } finally {
      setInvLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleModal) return;
    try {
      setRoleLoading(true);
      await apiPut(`/auth/users/${roleModal.id}/role`, { role: newRole });
      setRoleModal(null);
      fetchUsers();
    } catch (e: any) {
      alert(e?.response?.data?.error || "Gagal mengubah role");
    } finally {
      setRoleLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusModal) return;
    try {
      setStatusLoading(true);
      await apiPut(`/auth/users/${statusModal.id}/status`, { is_active: !statusModal.is_active });
      setStatusModal(null);
      fetchUsers();
    } catch (e: any) {
      alert(e?.response?.data?.error || "Gagal mengubah status");
    } finally {
      setStatusLoading(false);
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  if (loading) return <div className="text-center py-12 text-gray-500">Memuat data tim...</div>;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;

  const nonOwnerCount = users.filter(u => u.role !== "owner").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">👥 Tim & Akses</h2>
          <p className="text-sm text-gray-500 mt-1">Kelola anggota tim dan hak akses mereka</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
        >
          + Tambah User
        </button>
      </div>

      {/* Empty state */}
      {nonOwnerCount === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <strong>Belum ada anggota tim lain.</strong><br />
          Tambah kasir atau admin untuk bantu operasional harian.
        </div>
      )}

      {/* User Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-center">Telegram</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || "bg-gray-300"}`}>
                    {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-center">{u.has_telegram ? "✅" : "❌"}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {u.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {u.role === "owner" ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => { setRoleModal(u); setNewRole(u.role as Role); }}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition"
                        title="Ubah Role"
                      >✏️</button>
                      <button
                        onClick={() => setStatusModal(u)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 transition"
                        title={u.is_active ? "Nonaktifkan" : "Aktifkan"}
                      >{u.is_active ? "⛔" : "✅"}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
        ℹ️ Untuk link Telegram, user baru harus generate kode di Settings → tab Telegram masing-masing.
      </div>

      {/* ── MODAL: Tambah User ── */}
      <BaseModal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Tambah Anggota Tim" maxWidth="max-w-md">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama lengkap</label>
                <input value={invName} onChange={e => setInvName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Nama lengkap" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input value={invEmail} onChange={e => setInvEmail(e.target.value)} type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input value={invPassword} onChange={e => setInvPassword(e.target.value)} type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Min 6 karakter" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="space-y-2">
                  {ROLES.map(r => (
                    <label key={r.value} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition ${invRole === r.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="inv-role" value={r.value} checked={invRole === r.value}
                        onChange={() => setInvRole(r.value)} className="mt-0.5" />
                      <div><div className="font-medium text-sm">{r.label}</div><div className="text-xs text-gray-500">{r.desc}</div></div>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Setelah ditambah, user bisa login ke web dengan email + password,
                lalu link Telegram via /start [kode].
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleInvite} disabled={invLoading || !invName || !invEmail || !invPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {invLoading ? "Menyimpan..." : "✅ Tambah User"}
              </button>
            </div>
      </BaseModal>

      {/* ── MODAL: Ubah Role ── */}
      <BaseModal isOpen={!!roleModal} onClose={() => setRoleModal(null)} title={roleModal ? `Ubah Role — ${roleModal.name}` : ""} maxWidth="max-w-md">
            {roleModal && (<>
            <p className="text-sm text-gray-500 mb-4">
              Role saat ini: <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[roleModal.role]}`}>
                {roleModal.role.charAt(0).toUpperCase() + roleModal.role.slice(1)}
              </span>
            </p>
            <div className="space-y-2">
              {ROLES.map(r => (
                <label key={r.value} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition ${newRole === r.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="new-role" value={r.value} checked={newRole === r.value}
                    onChange={() => setNewRole(r.value)} className="mt-0.5" />
                  <div><div className="font-medium text-sm">{r.label}</div><div className="text-xs text-gray-500">{r.desc}</div></div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setRoleModal(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleRoleChange} disabled={roleLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {roleLoading ? "Menyimpan..." : "✅ Simpan"}
              </button>
            </div>
            </>)}
      </BaseModal>

      {/* ── MODAL: Nonaktifkan / Aktifkan ── */}
      <BaseModal isOpen={!!statusModal} onClose={() => setStatusModal(null)} title={statusModal ? `${statusModal.is_active ? "Nonaktifkan" : "Aktifkan"} ${statusModal.name}?` : ""} maxWidth="max-w-sm">
            {statusModal && (<>
            <p className="text-sm text-gray-600 mb-6">
              {statusModal.is_active
                ? "User tidak bisa login lagi setelah dinonaktifkan."
                : "User akan bisa login kembali setelah diaktifkan."}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setStatusModal(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleStatusChange} disabled={statusLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${statusModal.is_active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>
                {statusLoading ? "Memproses..." : statusModal.is_active ? "⛔ Ya, Nonaktifkan" : "✅ Ya, Aktifkan"}
              </button>
            </div>
            </>)}
      </BaseModal>
    </div>
  );
}
