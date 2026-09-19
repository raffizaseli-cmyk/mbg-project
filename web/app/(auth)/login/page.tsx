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
  Eye, 
  EyeOff, 
  Sparkles, 
  ShieldCheck, 
  ReceiptText, 
  Apple, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiPost("/auth/login", { email, password });
      if (result.success) {
        setToken(result.data.access_token);
        router.push("/dashboard");
      } else {
        setError(result.error || "Login gagal. Silakan periksa kembali email dan kata sandi Anda.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Terjadi kesalahan koneksi server, silakan coba beberapa saat lagi.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Quick helper for development / demo test
  function fillDemoAccount(roleEmail: string) {
    setEmail(roleEmail);
    setPassword("password123");
  }

  return (
    <div className="w-full max-w-[1000px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 flex flex-col lg:flex-row overflow-hidden animate-fade-in transition-all">
      
      {/* ─── Branding & Feature Showcase Section (Left Panel) ─────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[48%] p-10 bg-slate-900 text-white relative overflow-hidden border-r border-slate-800">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/15 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-slate-800/50 rounded-full blur-[80px] pointer-events-none" />

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
                  Enterprise Suite
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Sistem Aktif</span>
            </div>
          </div>
        </div>

        {/* Center Value Proposition */}
        <div className="relative z-10 my-auto py-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Platform Akuntabilitas Makan Bergizi Gratis</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold leading-snug text-white mb-3">
            Operasional Dapur{" "}
            <span className="text-blue-400">
              Cepat, Cerdas,
            </span>{" "}
            dan Transparan.
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-6 font-normal">
            Kendalikan stok real-time, ekstrak nota belanja pasar otomatis via OCR, dan pantau standar gizi sekolah dalam satu dasbor terpadu.
          </p>

          {/* 3 Feature Cards */}
          <div className="grid grid-cols-1 gap-2.5 max-w-sm">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <ReceiptText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  OCR Nota & Rekonsiliasi Pasar
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Ekstraksi nota belanja pasar otomatis dengan kalkulasi harga satuan presisi.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Apple className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  Perhitungan Resep & Gizi (BOM)
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Kalkulasi porsi presisi, estimasi HPP per piring, dan kepatuhan standar nutrisi BGN.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  BAP Digital & Distribusi
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Bukti serah terima makanan ke sekolah tersimpan rapi untuk laporan audit.
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

      {/* ─── Form Section (Right Panel) ─────────────────────────────── */}
      <div className="w-full lg:w-[52%] p-8 sm:p-10 flex flex-col justify-between bg-white">
        <div className="max-w-md w-full mx-auto">
          
          {/* Mobile Branding */}
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 text-white">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">MBG Catering</span>
              <span className="block text-[9px] uppercase tracking-wider text-blue-600 font-semibold">Enterprise Suite</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-2">
              Selamat Datang 👋
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              Masuk ke akun Anda untuk mengelola operasional catering hari ini.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5 animate-slide-down">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="flex-1 font-medium text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <div className="space-y-3.5">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Email Akun
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    placeholder="nama@sppg.id"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Kata Sandi
                  </label>
                  <a href="#" className="text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                    Lupa sandi?
                  </a>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    placeholder="••••••••"
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
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer group select-none">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600" 
                />
                <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors font-medium">
                  Ingat sesi saya di perangkat ini
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
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Uji Coba Cepat
              </span>
              <span className="text-[10px] text-blue-600 font-medium">Klik untuk isi akun demo</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount("admin@sppg.id")}
                className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors border border-blue-200 cursor-pointer"
              >
                Admin SPPG
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("akuntan@sppg.id")}
                className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors border border-emerald-200 cursor-pointer"
              >
                Akuntan
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("gizi@sppg.id")}
                className="px-2.5 py-1 text-xs rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium transition-colors border border-amber-200 cursor-pointer"
              >
                Ahli Gizi
              </button>
            </div>
          </div>

          {/* Register Link */}
          <p className="text-center mt-5 text-xs text-slate-500">
            Belum mendaftarkan SPPG / Dapur MBG Anda?{" "}
            <Link 
              href="/register" 
              className="text-blue-600 font-bold hover:text-blue-700 transition-colors hover:underline"
            >
              Daftar Tenant Baru
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
