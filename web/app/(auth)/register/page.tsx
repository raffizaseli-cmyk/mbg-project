"use client";

import { apiPost } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { UtensilsCrossed, ArrowRight, Loader2, Mail, Lock, Building2, UserCircle, Phone } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    tenant_name: "",
    slug: "",
    owner_email: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiPost("/auth/register-tenant", formData);
      if (result.success) {
        setToken(result.data.access_token);
        router.push("/onboarding");
      } else {
        setError(result.error || "Registrasi gagal");
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
    <div className="w-full max-w-[1000px] bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white flex flex-row-reverse overflow-hidden animate-in">
      {/* Branding Section - Hidden on Mobile */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-indigo-700 to-blue-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent"></div>
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">MBG Catering</span>
        </div>

        <div className="relative z-10 mt-auto pb-12">
          <div className="flex gap-2 mb-6">
            <span className="w-12 h-1 bg-white/80 rounded-full"></span>
            <span className="w-3 h-1 bg-white/30 rounded-full"></span>
            <span className="w-3 h-1 bg-white/30 rounded-full"></span>
          </div>
          <h2 className="text-3xl font-bold leading-tight mb-4 tracking-tight">
            Mulai Digitalisasi<br />Bisnis Catering Anda
          </h2>
          <p className="text-blue-100/80 text-base max-w-sm leading-relaxed">
            Daftar gratis dalam waktu 1 menit. Kendalikan stok, atur jadwal menu dengan AI, dan pantau keuangan dengan mudah.
          </p>
        </div>
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 overflow-y-auto max-h-[90vh]">
        <div className="max-w-md mx-auto">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <UtensilsCrossed className="w-6 h-6 text-white" />
             </div>
             <span className="text-xl font-bold tracking-tight text-gray-900">MBG Catering</span>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Buat Akun Baru 🚀</h1>
            <p className="text-gray-500 mt-2 text-sm">Lengkapi data usaha catering Anda di bawah ini</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-start gap-3 animate-in">
                <span className="mt-0.5 text-base">⚠️</span>
                <p className="flex-1 font-medium">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <label className="text-sm font-semibold text-gray-700">Nama SPPG / Perusahaan</label>
                <div className="relative group">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="text"
                    value={formData.tenant_name}
                    onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none"
                    placeholder="PT Bintang Catering"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Singkatan / ID</label>
                <div className="relative group">
                  <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none"
                    placeholder="bintang"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">No. Telepon</label>
                <div className="relative group">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none"
                    placeholder="08123456789"
                  />
                </div>
              </div>

              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <label className="text-sm font-semibold text-gray-700">Email Pemilik</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="email"
                    value={formData.owner_email}
                    onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none"
                    placeholder="nama@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none"
                    placeholder="Minimal 6 karakter"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 mt-4 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Selesaikan Pendaftaran</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-gray-500">
            Sudah memiliki akun?{" "}
            <a href="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors hover:underline">
              Masuk di sini
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
