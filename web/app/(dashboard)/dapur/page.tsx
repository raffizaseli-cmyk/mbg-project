"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TabBelanjaAuto } from "./components/TabBelanjaAuto";
import { TabKomponen } from "./components/TabKomponen";
import { TabMenuBOM } from "./components/TabMenuBOM";
import { TabPemetaanBahan } from "./components/TabPemetaanBahan";
import { 
  UtensilsCrossed, 
  Layers, 
  ShoppingBag, 
  Sparkles, 
  Sliders, 
  ArrowRight,
  BookOpen,
  ChefHat
} from "lucide-react";

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

  const tabs = [
    { 
      id: "menu" as const, 
      label: "Menu & Resep BOM", 
      desc: "Bill of Materials & Porsi",
      icon: ChefHat,
      activeColor: "text-amber-700 bg-amber-500/10 border-amber-500/30 ring-amber-500/20"
    },
    { 
      id: "komponen" as const, 
      label: "Master Komponen", 
      desc: "Lauk, Sayur, & Karbohidrat",
      icon: Layers,
      activeColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30 ring-emerald-500/20"
    },
    { 
      id: "belanja" as const, 
      label: "Rencana Belanja Dapur", 
      desc: "Kalkulasi Kebutuhan Bahan",
      icon: ShoppingBag,
      activeColor: "text-cyan-700 bg-cyan-500/10 border-cyan-500/30 ring-cyan-500/20"
    },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-6 animate-fade-in">
      
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Formula Gizi & Standar Porsi BGN
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">Dapur Sentral MBG</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Dapur, Resep & Bill of Materials
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">
            Formulasi takaran bahan baku per porsi, kalkulasi otomatis kebutuhan gramasi, dan master menu makanan bergizi.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/penyetelan-dapur?tab=mapping"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Penyetelan AI & Pemetaan</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-70" />
          </Link>
        </div>
      </div>

      {/* ─── Tab Navigation Bar ─── */}
      <div className="sticky top-0 z-20 pt-1 pb-2 backdrop-blur-md">
        <div className="flex gap-2.5 bg-white/85 backdrop-blur-xl rounded-2xl p-2 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                  isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div>{tab.label}</div>
                  <div className={`text-xs font-normal hidden sm:block ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab Content Card ─── */}
      <div className="bg-white/85 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 min-h-[500px]">
        {activeTab === "menu" && <TabMenuBOM />}
        {activeTab === "komponen" && <TabKomponen />}
        {activeTab === "belanja" && <TabBelanjaAuto />}
        {activeTab === "pemetaan" && <TabPemetaanBahan />}
      </div>
    </div>
  );
}
