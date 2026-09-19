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
    <div className="w-full max-w-[1060px] bg-slate-900/60 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-700/50 flex flex-col lg:flex-row-reverse overflow-hidden animate-fade-in transition-all">
      
      {/* ─── Branding & Benefits Showcase (Right side on desktop) ─────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[48%] p-12 bg-gradient-to-bl from-slate-900 via-indigo-950 to-blue-950 text-white relative overflow-hidden border-l border-slate-800/60">
        {/* Ambient Glows */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-10 -right-20 w-80 h-80 bg-amber-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-60 h-60 bg-blue-500/20 rounded-full blur-[90px] pointer-events-none" />

        {/* Top Header & Brand Tag */}
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-amber-500 via-orange-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 ring-1 ring-white/20">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  MBG Catering
                </span>
                <span className="block text-[10px] uppercase font-semibold tracking-wider text-amber-400">
                  Unit Pelayanan Dapur SPPG
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Registrasi Terbuka</span>
            </div>
          </div>
        </div>

        {/* Center Value Proposition */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-medium mb-5 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Digitalisasi SPPG & Satuan Pelayanan Dapur</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight text-white mb-4">
            Mulai Digitalisasi Dapur{" "}
            <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400 bg-clip-text text-transparent">
              Catering Anda.
            </span>
          </h1>

          <p className="text-slate-300/80 text-sm leading-relaxed max-w-md mb-8">
            Daftar dalam 1 menit. Kendalikan stok bahan baku, standarisasi menu berbobot gizi, dan cetak BAP distribusi resmi sekolah tanpa ribet.
          </p>

          {/* 3 Interactive Feature Glass Cards */}
          <div className="grid grid-cols-1 gap-3 max-w-md">
            <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] backdrop-blur-md transition-all flex items-start gap-3.5 group">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                  Aktivasi Instan & Siap Pakai
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Tenant langsung aktif dengan database master bahan baku dan template menu gizi MBG.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] backdrop-blur-md transition-all flex items-start gap-3.5 group">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                  Format Laporan Standar BGN
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Buku kas pembukuan, rekonsiliasi belanja pasar, dan bukti distribusi siap diaudit.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] backdrop-blur-md transition-all flex items-start gap-3.5 group">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                  Privasi & Keamanan Data Terjamin
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Data transaksi terpisah secara multi-tenant dengan proteksi token dan audit trail.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Badan Gizi Nasional (BGN) Architecture
          </span>
          <span className="text-[11px] text-slate-500">v2.4 Production</span>
        </div>
      </div>

      {/* ─── Form Section (Left side on desktop) ────────────────────────── */}
      <div className="w-full lg:w-[52%] p-8 sm:p-12 flex flex-col justify-between bg-white/[0.97] backdrop-blur-3xl overflow-y-auto max-h-[92vh]">
        <div className="max-w-md w-full mx-auto">
          
          {/* Mobile Branding */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 via-orange-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">MBG Catering</span>
              <span className="block text-[9px] uppercase tracking-wider text-amber-600 font-semibold">Unit Pelayanan Dapur</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-2">
              Daftarkan Tenant SPPG 🚀
            </h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              Lengkapi data usaha catering Anda untuk memulai sistem manajemen dapur.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-3.5">
            {error && (
              <div className="p-4 bg-red-50/90 border border-red-200/80 text-red-700 text-sm rounded-2xl flex items-start gap-3 animate-slide-down">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="flex-1 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Nama SPPG */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nama SPPG / Badan Usaha Dapur
              </label>
              <div className="relative group">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  value={formData.tenant_name}
                  onChange={(e) => handleTenantNameChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all outline-none"
                  placeholder="Contoh: SPPG Mandiri Bersama"
                  required
                />
              </div>
            </div>

            {/* 2 Cols: Slug ID + No HP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ID / Slug URL
                  </label>
                  <span className="text-[10px] text-slate-400">Otomatis</span>
                </div>
                <div className="relative group">
                  <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all outline-none"
                    placeholder="mandiri-bersama"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  No. WhatsApp / HP
                </label>
                <div className="relative group">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all outline-none"
                    placeholder="08123456789"
                  />
                </div>
              </div>
            </div>

            {/* Email Pemilik */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Email Akun Administrator
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="email"
                  value={formData.owner_email}
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all outline-none"
                  placeholder="admin@dapur.com"
                  required
                />
              </div>
            </div>

            {/* Kata Sandi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kata Sandi Akun
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all outline-none"
                  placeholder="Minimal 6 karakter"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Agreement checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 shrink-0"
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
              className="w-full mt-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Mendaftarkan SPPG...</span>
                </>
              ) : (
                <>
                  <span>Buat Akun & Mulai Dapur</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center mt-6 text-xs text-slate-500">
            Sudah memiliki akun SPPG terdaftar?{" "}
            <Link
              href="/login"
              className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>

        {/* Security Assurance footer */}
        <div className="text-center mt-6 text-[11px] text-slate-400">
          Dilindungi enkripsi TLS & JWT Session Token • Hak Cipta MBG Catering
        </div>
      </div>
    </div>
  );
}

