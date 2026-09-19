"use client";

import { useState } from "react";
import { TabIdentitas } from "./components/TabIdentitas";
import { TabSekolah } from "./components/TabSekolah";
import { TabSupplier } from "./components/TabSupplier";
import { TabAlokasi } from "./components/TabAlokasi";
import { TabTelegram } from "./components/TabTelegram";
import { TabImport } from "./components/TabImport";
import { TabUsers } from "./components/TabUsers";
import { TabTips } from "./components/TabTips";
import { clearToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Building2,
  GraduationCap,
  Truck,
  PieChart,
  Send,
  FileSpreadsheet,
  Users,
  BookOpen,
  Sliders
} from "lucide-react";

type TabType = "identitas" | "sekolah" | "supplier" | "alokasi" | "telegram" | "import" | "users" | "tips";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("identitas");

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const tabs: { id: TabType; label: string; desc: string; icon: any }[] = [
    { id: "identitas", label: "Identitas SPPG", desc: "Profil Usaha & Rekening", icon: Building2 },
    { id: "sekolah", label: "Sekolah Binaan", desc: "Penerima Manfaat", icon: GraduationCap },
    { id: "supplier", label: "Vendor Rekanan", desc: "Supplier Pasar", icon: Truck },
    { id: "alokasi", label: "Alokasi Pagu", desc: "Batas Anggaran Juknis", icon: PieChart },
    { id: "telegram", label: "Bot Telegram", desc: "Webhook & Chat ID", icon: Send },
    { id: "import", label: "Import Data", desc: "Master Excel & CSV", icon: FileSpreadsheet },
    { id: "users", label: "Tim & Akses", desc: "Hak Akses Pengguna", icon: Users },
    { id: "tips", label: "Panduan", desc: "SOP & Cara Pakai", icon: BookOpen },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6 animate-fade-in">
      {/* ─── Hero Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 text-[11px] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              Pusat Konfigurasi & Master Data
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">Sistem Inti MBG</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Pengaturan & Master Sistem
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Kelola profil SPPG katering, sekolah binaan, rekanan pasar, pagu juknis, dan integrasi bot operasional.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border border-rose-200/80 shadow-xs cursor-pointer self-start sm:self-center"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Sesi</span>
        </button>
      </div>

      {/* ─── Modern Tab Navigation Bar ─── */}
      <div className="sticky top-0 z-20 pt-1 pb-2 backdrop-blur-md">
        <div className="flex gap-2.5 bg-white/85 backdrop-blur-xl rounded-2xl p-2 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-colors ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Active Tab Content Container ─── */}
      <div className="bg-white/85 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 min-h-[500px]">
        {activeTab === "identitas" && <TabIdentitas />}
        {activeTab === "sekolah" && <TabSekolah />}
        {activeTab === "supplier" && <TabSupplier />}
        {activeTab === "alokasi" && <TabAlokasi />}
        {activeTab === "telegram" && <TabTelegram />}
        {activeTab === "import" && <TabImport />}
        {activeTab === "users" && <TabUsers />}
        {activeTab === "tips" && <TabTips />}
      </div>
    </div>
  );
}
