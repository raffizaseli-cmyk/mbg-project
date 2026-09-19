"use client";

import { apiPost } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  ArrowRight,
  Loader2,
  Mail,
  Lock,
  Building2,
  UserCircle,
  Phone,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Layers
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    tenant_name: "",
    slug: "",
    owner_email: "",
    password: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-generate slug suggestion when tenant name is typed if slug is untouched/empty
  const handleTenantNameChange = (val: string) => {
    const cleanSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 20);

    setFormData((prev) => ({
      ...prev,
      tenant_name: val,
      slug: prev.slug === "" || prev.slug === prev.tenant_name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)
        ? cleanSlug
        : prev.slug,
    }));
  };

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("Harap menyetujui ketentuan layanan MBG Catering untuk melanjutkan.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Kata sandi minimal harus 6 karakter.");
      return;
    }

    setLoading(true);

    try {
      const result = await apiPost("/auth/register-tenant", formData);
      if (result.success) {
        setToken(result.data.access_token);
        router.push("/onboarding");
      } else {
        setError(result.error || "Pendaftaran tenant gagal. Silakan coba lagi.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Terjadi kesalahan saat memproses registrasi. Coba beberapa saat lagi.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[1000px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 flex flex-col lg:flex-row-reverse overflow-hidden animate-fade-in transition-all">
      
      {/* ─── Branding & Benefits Showcase (Right side on desktop) ─────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[48%] p-10 bg-slate-900 text-white relative overflow-hidden border-l border-slate-800">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-600/15 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-slate-800/50 rounded-full blur-[80px] pointer-events-none" />

        {/* Top Header & Brand Tag */}
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/30 text-white">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-white">
                  MBG Catering
                </span>
                <span className="block text-[10px] uppercase font-semibold tracking-wider text-amber-400">
                  Unit Pelayanan Dapur SPPG
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Registrasi Terbuka</span>
            </div>
          </div>
        </div>

        {/* Center Value Proposition */}
        <div className="relative z-10 my-auto py-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Digitalisasi SPPG & Satuan Pelayanan Dapur</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold leading-snug text-white mb-3">
            Mulai Digitalisasi Dapur{" "}
            <span className="text-blue-400">
              Catering Anda.
            </span>
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-6 font-normal">
            Daftar dalam 1 menit. Kendalikan stok bahan baku, standarisasi menu berbobot gizi, dan cetak BAP distribusi resmi sekolah tanpa ribet.
          </p>

          {/* 3 Feature Cards */}
          <div className="grid grid-cols-1 gap-2.5 max-w-sm">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  Aktivasi Instan & Siap Pakai
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Tenant langsung aktif dengan database master bahan baku dan template menu gizi MBG.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  Format Laporan Standar BGN
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Buku kas pembukuan, rekonsiliasi belanja pasar, dan bukti distribusi siap diaudit.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  Privasi & Keamanan Terjamin
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Data transaksi terpisah secara multi-tenant dengan proteksi token dan audit trail.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="relative z-10 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Standar Badan Gizi Nasional (BGN)
          </span>
          <span className="text-[11px] text-slate-500">v2.4 Production</span>
        </div>
      </div>

      {/* ─── Form Section (Left side on desktop) ────────────────────────── */}
      <div className="w-full lg:w-[52%] p-8 sm:p-10 flex flex-col justify-between bg-white overflow-y-auto max-h-[92vh]">
        <div className="max-w-md w-full mx-auto">
          
          {/* Mobile Branding */}
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 text-white">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">MBG Catering</span>
              <span className="block text-[9px] uppercase tracking-wider text-blue-600 font-semibold">Unit Pelayanan Dapur</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-2">
              Daftarkan Tenant SPPG 🚀
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              Lengkapi data usaha catering Anda untuk memulai sistem manajemen dapur.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-3.5">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5 animate-slide-down">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="flex-1 font-medium text-xs leading-relaxed">{error}</p>
              </div>
            )}

            {/* Nama SPPG */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Nama SPPG / Badan Usaha Dapur
              </label>
              <div className="relative group">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  value={formData.tenant_name}
                  onChange={(e) => handleTenantNameChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                  placeholder="Contoh: SPPG Mandiri Bersama"
                  required
                />
              </div>
            </div>

            {/* 2 Cols: Slug ID + No HP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    ID / Slug URL
                  </label>
                  <span className="text-[10px] text-slate-400">Otomatis</span>
                </div>
                <div className="relative group">
                  <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    placeholder="mandiri-bersama"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  No. WhatsApp / HP
                </label>
                <div className="relative group">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    placeholder="08123456789"
                  />
                </div>
              </div>
            </div>

            {/* Email Pemilik */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Email Akun Administrator
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="email"
                  value={formData.owner_email}
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                  placeholder="admin@dapur.com"
                  required
                />
              </div>
            </div>

            {/* Kata Sandi */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Kata Sandi Akun
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-11 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                  placeholder="Minimal 6 karakter"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Agreement checkbox */}
            <div className="pt-0.5">
              <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                />
                <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors leading-snug">
                  Saya setuju dengan ketentuan operasional dan kepatuhan standar gizi BGN.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mendaftarkan SPPG...</span>
                </>
              ) : (
                <>
                  <span>Buat Akun & Mulai Dapur</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center mt-5 text-xs text-slate-500">
            Sudah memiliki akun SPPG terdaftar?{" "}
            <Link
              href="/login"
              className="text-blue-600 font-bold hover:text-blue-700 transition-colors hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>

        {/* Security Assurance footer */}
        <div className="text-center mt-5 text-[11px] text-slate-400">
          Dilindungi enkripsi sesi TLS & JWT • MBG Catering
        </div>
      </div>
    </div>
  );
}

