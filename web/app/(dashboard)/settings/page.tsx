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
import { LogOut } from "lucide-react";

type TabType = "identitas" | "sekolah" | "supplier" | "alokasi" | "telegram" | "import" | "users" | "tips";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("identitas");

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "identitas", label: "Identitas SPPG" },
    { id: "sekolah", label: "Sekolah" },
    { id: "supplier", label: "Supplier" },
    { id: "alokasi", label: "Alokasi MBG" },
    { id: "telegram", label: "Telegram" },
    { id: "import", label: "Import Data" },
    { id: "users", label: "👥 Tim & Akses" },
    { id: "tips", label: "📖 Panduan" },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Pengaturan Sistem
          </h1>
          <p className="text-gray-500 font-medium text-sm">Kelola data master dan konfigurasi aplikasi MBG.</p>
        </div>
        
        <button 
          onClick={handleLogout} 
          className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors border border-red-100 shadow-sm self-start"
        >
          <LogOut className="w-4 h-4" /> Logout / Keluar
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 lg:-top-4 z-10 pt-1 pb-1 mt-2 bg-gray-50/80 backdrop-blur-md">
        <div className="flex gap-2 bg-white/70 backdrop-blur-xl rounded-2xl p-2 overflow-x-auto flex-nowrap no-scrollbar border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${activeTab === tab.id
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white min-h-[500px]">
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
