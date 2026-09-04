"use client";

import { apiPost } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { UtensilsCrossed, ArrowRight, Loader2, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        setError(result.error || "Login gagal");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Terjadi error, coba lagi";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[1000px] bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white flex overflow-hidden animate-in">
      {/* Branding Section - Hidden on Mobile */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")"}}></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">MBG Catering</span>
        </div>

        <div className="relative z-10 mt-auto">
          <h2 className="text-4xl font-bold leading-tight mb-4 tracking-tight">
            Manajemen<br />Catering Efisien
          </h2>
          <p className="text-blue-100/80 text-lg max-w-sm leading-relaxed">
            Sistem monitoring stok, pembukuan cerdas, dan analisis AI untuk operasional bisnis MBG Anda.
          </p>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12">
        <div className="max-w-sm mx-auto">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
             <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <UtensilsCrossed className="w-6 h-6 text-white" />
             </div>
             <span className="text-xl font-bold tracking-tight text-gray-900">MBG Catering</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Selamat Datang 👋</h1>
            <p className="text-gray-500 mt-2 text-sm">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-start gap-3 animate-in">
                <span className="mt-0.5 text-base">⚠️</span>
                <p className="flex-1 font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Email Utama</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all outline-none"
                    placeholder="nama@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                 <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors cursor-pointer" />
                 <span className="text-gray-600 group-hover:text-gray-900 transition-colors font-medium">Ingat saya</span>
              </label>
              <a href="#" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">Lupa Password?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 mt-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-gray-500">
            Belum punya akun?{" "}
            <a href="/register" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors hover:underline">
              Daftar Sekarang
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
