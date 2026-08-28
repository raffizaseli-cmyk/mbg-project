"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TabBelanjaAuto } from "./components/TabBelanjaAuto";
import { TabKomponen } from "./components/TabKomponen";
import { TabMenuBOM } from "./components/TabMenuBOM";
import { TabPemetaanBahan } from "./components/TabPemetaanBahan";

type TabType = "belanja" | "komponen" | "menu" | "pemetaan";

export default function DapurPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("menu");

  // Deep-link support: ?tab=pemetaan from Telegram redirects to /penyetelan-dapur?tab=mapping
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "pemetaan") {
      router.push("/penyetelan-dapur?tab=mapping");
    }
  }, [searchParams, router]);

  const tabs: { id: Exclude<TabType, "pemetaan">; label: string; icon: string }[] = [
    { id: "menu", label: "Menu & BOM", icon: "🍽️" },
    { id: "komponen", label: "Master Komponen", icon: "🧩" },
    { id: "belanja", label: "Belanja Manual", icon: "🛒" },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in mt-2">
      <div className="pt-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
          Dapur & Resep (BOM)
        </h1>
        <p className="text-gray-500 font-medium text-sm mt-1">
          Kelola master komponen resep, produk menu, Bill of Materials, dan catat belanja bahan baku.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-20 mt-0 pt-2 pb-2 bg-gray-50/90 backdrop-blur-md">
        <div className="flex gap-2 bg-white/70 backdrop-blur-xl rounded-2xl p-2 overflow-x-auto flex-nowrap no-scrollbar border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50 scale-100"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 scale-95 hover:scale-100"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white min-h-[500px]">
        {activeTab === "menu" && <TabMenuBOM />}
        {activeTab === "komponen" && <TabKomponen />}
        {activeTab === "belanja" && <TabBelanjaAuto />}
        {activeTab === "pemetaan" && <TabPemetaanBahan />}
      </div>
    </div>
  );
}

