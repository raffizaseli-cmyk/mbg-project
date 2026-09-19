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
    <div className="w-full max-w-[1060px] bg-slate-900/60 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-700/50 flex flex-col lg:flex-row overflow-hidden animate-fade-in transition-all">
      
      {/* ─── Branding & Feature Showcase Section (Left Panel) ─────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] p-12 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white relative overflow-hidden border-r border-slate-800/60">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-60 h-60 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />

        {/* Top Header & Brand Tag */}
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  MBG Catering
                </span>
                <span className="block text-[10px] uppercase font-semibold tracking-wider text-amber-400">
                  Enterprise Suite
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Sistem Aktif & Terverifikasi</span>
            </div>
          </div>
        </div>

        {/* Center Value Proposition */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-medium mb-5 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Platform Akuntabilitas Makan Bergizi Gratis</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight text-white mb-4">
            Operasional Dapur{" "}
            <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400 bg-clip-text text-transparent">
              Cepat, Cerdas,
            </span>{" "}
            dan Transparan.
          </h1>

          <p className="text-slate-300/80 text-sm leading-relaxed max-w-md mb-8">
            Kendalikan stok real-time, ekstrak nota belanja pasar otomatis via AI Vision, dan pantau standar gizi sekolah dalam satu dasbor terpadu.
          </p>

          {/* 3 Interactive Feature Glass Cards */}
          <div className="grid grid-cols-1 gap-3 max-w-md">
            <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] backdrop-blur-md transition-all flex items-start gap-3.5 group">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
                <ReceiptText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                  AI OCR Nota & Rekonsiliasi Pasar
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Ekstraksi nota tulis tangan instan dengan penyesuaian matematika harga satuan otomatis.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] backdrop-blur-md transition-all flex items-start gap-3.5 group">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Apple className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                  Perhitungan Resep & Gizi (BOM)
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Kalkulasi porsi presisi, estimasi HPP per piring, dan kepatuhan standar nutrisi BGN.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] backdrop-blur-md transition-all flex items-start gap-3.5 group">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                  BAP Digital & Kepatuhan Distribusi
                </h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Bukti serah terima makanan ke sekolah tersimpan rapi siap untuk laporan audit resmi.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Standardized for Badan Gizi Nasional (BGN)
          </span>
          <span className="text-[11px] text-slate-500">v2.4 Production</span>
        </div>
      </div>

      {/* ─── Form Section (Right Panel) ─────────────────────────────── */}
      <div className="w-full lg:w-[48%] p-8 sm:p-12 flex flex-col justify-between bg-white/[0.97] backdrop-blur-3xl">
        <div className="max-w-md w-full mx-auto">
          
          {/* Mobile Branding */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">MBG Catering</span>
              <span className="block text-[9px] uppercase tracking-wider text-amber-600 font-semibold">Enterprise Suite</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-2">
              Selamat Datang 👋
            </h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              Masuk ke akun Anda untuk mengelola operasional catering hari ini.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50/90 border border-red-200/80 text-red-700 text-sm rounded-2xl flex items-start gap-3 animate-slide-down">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="flex-1 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            <div className="space-y-3.5">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Email Akun
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all outline-none"
                    placeholder="nama@sppg.id"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Kata Sandi
                  </label>
                  <a href="#" className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
                    Lupa sandi?
                  </a>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all outline-none"
                    placeholder="••••••••"
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
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600" 
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
              className="w-full mt-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials for Fast Testing */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Uji Coba Akun Demo
              </span>
              <span className="text-[10px] text-indigo-600 font-medium">Klik untuk isi otomatis</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount("admin@sppg.id")}
                className="px-2.5 py-1 text-xs rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors border border-indigo-200/60"
              >
                Admin SPPG
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("akuntan@sppg.id")}
                className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors border border-emerald-200/60"
              >
                Akuntan
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("gizi@sppg.id")}
                className="px-2.5 py-1 text-xs rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium transition-colors border border-amber-200/60"
              >
                Ahli Gizi
              </button>
            </div>
          </div>

          {/* Register Link */}
          <p className="text-center mt-6 text-xs text-slate-500">
            Belum mendaftarkan SPPG / Dapur MBG Anda?{" "}
            <Link 
              href="/register" 
              className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors hover:underline"
            >
              Daftar Tenant Baru
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
