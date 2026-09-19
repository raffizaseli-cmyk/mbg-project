"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticated, clearToken } from "@/lib/auth";

import { 
  Home, 
  BookOpen, 
  UtensilsCrossed, 
  Package, 
  ClipboardCheck, 
  CircleDollarSign, 
  PieChart, 
  Users, 
  LineChart, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  FileClock,
  SlidersHorizontal,
  Search,
  Bell,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ExternalLink
} from "lucide-react";

type NavItem = 
  | { type: "divider"; label: string; accentColor: string; allowedRoles?: string[] }
  | { 
      href: string; 
      icon: React.ReactNode; 
      label: string; 
      accentColor?: string;
      allowedRoles?: string[]; 
      children?: { href: string; label: string; icon?: React.ReactNode }[];
      badge?: string;
    };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: <Home className="w-5 h-5" />, label: "Dashboard", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },

  { type: "divider", label: "OPERASIONAL", accentColor: "blue", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },
  { href: "/pembukuan", icon: <BookOpen className="w-5 h-5" />, label: "Pembukuan", accentColor: "blue", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/mbg", icon: <Package className="w-5 h-5" />, label: "MBG Penyerahan", accentColor: "blue", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },
  { 
    href: "/stok", 
    icon: <Package className="w-5 h-5" />, 
    label: "Stok Gudang", 
    accentColor: "blue",
    allowedRoles: ["owner", "admin", "akuntan"],
    children: [
      { href: "/stok", label: "Stok Utama", icon: <Package className="w-4 h-4" /> }, 
      { href: "/stok/riwayat", label: "Riwayat Log", icon: <FileClock className="w-4 h-4" /> }
    ] 
  },
  { href: "/compliance", icon: <ClipboardCheck className="w-5 h-5" />, label: "Kepatuhan & Dokumen", accentColor: "blue", allowedRoles: ["owner", "admin", "gizi"] },
  
  { type: "divider", label: "KEUANGAN", accentColor: "emerald", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/keuangan", icon: <CircleDollarSign className="w-5 h-5" />, label: "Piutang & Hutang", accentColor: "emerald", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/anggaran", icon: <PieChart className="w-5 h-5" />, label: "Anggaran Juknis", accentColor: "emerald", allowedRoles: ["owner", "admin", "akuntan"] },

  { type: "divider", label: "DAPUR & GIZI", accentColor: "amber", allowedRoles: ["owner", "admin", "gizi"] },
  { href: "/dapur", icon: <UtensilsCrossed className="w-5 h-5" />, label: "Dapur & Resep (BOM)", accentColor: "amber", allowedRoles: ["owner", "admin", "gizi"] },
  { href: "/penyetelan-dapur", icon: <SlidersHorizontal className="w-5 h-5" />, label: "Penyetelan Dapur", accentColor: "amber", allowedRoles: ["owner", "admin", "gizi"] },
  
  { type: "divider", label: "SDM & KARYAWAN", accentColor: "violet", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/karyawan", icon: <Users className="w-5 h-5" />, label: "Karyawan & Tim", accentColor: "violet", allowedRoles: ["owner", "admin", "akuntan"] },
  
  { type: "divider", label: "ANALITIK & PASAR", accentColor: "cyan", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/insights", icon: <LineChart className="w-5 h-5" />, label: "Insights & Tren Harga", accentColor: "cyan", allowedRoles: ["owner", "admin", "akuntan"] },
  
  { type: "divider", label: "SISTEM", accentColor: "slate", allowedRoles: ["owner", "admin"] },
  { href: "/settings", icon: <Settings className="w-5 h-5" />, label: "Pengaturan Sistem", accentColor: "slate", allowedRoles: ["owner", "admin"] },
];

const Sidebar = ({ 
  mobile = false,
  collapsed,
  setCollapsed,
  pathname,
  userRole,
  handleLogout,
}: { 
  mobile?: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  pathname: string;
  userRole: string;
  handleLogout: () => void;
}) => {
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
      case "admin":
        return { label: "Admin SPPG", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
      case "akuntan":
        return { label: "Akuntan", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
      case "gizi":
        return { label: "Ahli Gizi", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" };
      default:
        return { label: role, color: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
    }
  };

  const roleInfo = getRoleBadge(userRole);

  return (
    <aside
      className={`
        ${mobile ? "w-72" : collapsed ? "w-[90px]" : "w-72"}
        bg-[#0B1120] text-slate-300 border-r border-slate-800/80 flex flex-col h-[100dvh]
        ${mobile ? "" : "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"}
        relative shadow-2xl z-30 select-none
      `}
    >
      {/* Ambient background glows inside sidebar */}
      <div className="absolute top-0 left-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="h-20 flex items-center justify-between px-5 relative z-10 shrink-0 border-b border-slate-800/60">
        {(!collapsed || mobile) ? (
          <div className="flex items-center gap-3 w-full animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/30 flex items-center justify-center text-white ring-1 ring-white/20 shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-white tracking-tight truncate">MBG Catering</h1>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Sistem Aktif" />
              </div>
              <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border mt-0.5 ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/30 flex items-center justify-center text-white cursor-pointer hover:scale-105 transition-transform animate-fade-in">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        )}
        
        {/* Collapse toggle button */}
        {!mobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-indigo-500/20 focus:outline-none transition-all z-40"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 ml-0.5" /> : <ChevronLeft className="w-4 h-4 mr-0.5" />}
          </button>
        )}
      </div>

      {/* Navigation Links Scrollable Area */}
      <nav className="flex-1 py-4 px-3.5 overflow-y-auto overflow-x-hidden no-scrollbar relative z-10 space-y-1">
        {NAV_ITEMS.filter(item => !item.allowedRoles || item.allowedRoles.includes(userRole)).map((item, index) => {
          if ("type" in item && item.type === "divider") {
            if (collapsed && !mobile) {
              return <div key={`div-${index}`} className="my-3 border-b border-slate-800/80 w-8 mx-auto" />;
            }
            return (
              <div key={`div-${index}`} className="px-3 pt-5 pb-1.5 text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 shrink-0">
                <span className={`
                  ${item.accentColor === "blue" ? "text-blue-400" : ""}
                  ${item.accentColor === "emerald" ? "text-emerald-400" : ""}
                  ${item.accentColor === "amber" ? "text-amber-400" : ""}
                  ${item.accentColor === "violet" ? "text-violet-400" : ""}
                  ${item.accentColor === "cyan" ? "text-cyan-400" : ""}
                  ${item.accentColor === "slate" ? "text-slate-400" : ""}
                `}>
                  {item.label}
                </span>
                <div className="h-px bg-slate-800/80 flex-1 ml-1" />
              </div>
            );
          }

          if ("href" in item) {
            const active = isActive(item.href);
            const hasChildren = item.children && (!collapsed || mobile);
            
            return (
              <div key={item.href} className="flex flex-col gap-1">
                <Link
                  href={item.href}
                  prefetch={true}
                  title={collapsed && !mobile ? item.label : undefined}
                  className={`
                    relative flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group w-full shrink-0
                    ${collapsed && !mobile ? "justify-center px-0 w-11 mx-auto" : "px-3.5"}
                    ${active
                      ? "bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-transparent border border-blue-500/30 text-white font-semibold shadow-sm shadow-blue-500/10"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"}
                  `}
                >
                  {/* Glowing vertical pill indicator for active link */}
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-blue-400 to-indigo-400 rounded-r-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  )}
                  
                  <div className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"}`}>
                    {item.icon}
                  </div>
                  
                  {(!collapsed || mobile) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}

                  {/* Optional status / new badge */}
                  {(!collapsed || mobile) && item.badge && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                </Link>

                {/* Submenu for nested items (e.g. Stok Utama & Riwayat) */}
                {hasChildren && active && (
                  <div className="ml-9 mt-1 space-y-1 relative pl-3 border-l border-slate-800 animate-slide-down">
                    {item.children!.map(child => {
                      const childActive = pathname === child.href;
                      return (
                        <Link 
                          key={child.href} 
                          href={child.href}
                          prefetch={true}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all relative
                            ${childActive
                              ? "text-blue-300 bg-blue-500/15 font-semibold border border-blue-500/20"
                              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] font-medium"}
                          `}
                        >
                          <div className={childActive ? "text-blue-400" : "text-slate-500"}>
                            {child.icon}
                          </div>
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          return null;
        })}
      </nav>

      {/* User Profile & Logout Area at Bottom */}
      <div className="p-3 border-t border-slate-800/80 relative z-10 shrink-0 bg-slate-950/40">
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all group
            ${collapsed && !mobile ? "justify-center px-0 w-11 mx-auto" : ""}
          `}
        >
          <LogOut className="w-5 h-5 group-hover:translate-x-0.5 text-slate-400 group-hover:text-red-400 transition-all shrink-0" />
          {(!collapsed || mobile) && (
            <div className="flex-1 text-left min-w-0">
              <span className="block text-xs font-semibold group-hover:text-red-300 transition-colors truncate">
                Keluar Sesi
              </span>
              <span className="block text-[10px] text-slate-500 truncate">
                Simpan perubahan & logout
              </span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState("owner");
  const [tenantName, setTenantName] = useState("SPPG Dapur");

  useEffect(() => {
    const initAuth = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      // Fast path: load cached role immediately
      const cachedRole = localStorage.getItem("user_role");
      if (cachedRole) {
        setUserRole(cachedRole);
        setIsReady(true);
      } else {
        setIsReady(true);
      }

      // Background verification
      try {
        const { apiGet } = await import("@/lib/api");
        const res = await apiGet("/auth/me");
        const freshRole = res?.data?.user?.role || "owner";
        const freshTenant = res?.data?.tenant?.name || res?.data?.user?.tenant_name || "SPPG Dapur Utama";
        setUserRole(freshRole);
        setTenantName(freshTenant);
        localStorage.setItem("user_role", freshRole);
      } catch (e: any) {
        if (e?.response?.status === 401) {
          clearToken();
          localStorage.removeItem("user_role");
          router.push("/login");
        }
      }
    };
    initAuth();
  }, [router]);

  // Auto close mobile drawer on route change
  useEffect(() => { 
    setMobileOpen(false); 
  }, [pathname]);

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Memuat MBG Catering...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  // Find active label for breadcrumbs
  const currentPageItem = NAV_ITEMS.find(n => "href" in n && isActive(n.href));
  const currentPageTitle = currentPageItem && "label" in currentPageItem ? currentPageItem.label : "Dashboard";

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex flex-col h-[100dvh]">
        <Sidebar 
          collapsed={collapsed} 
          setCollapsed={setCollapsed} 
          pathname={pathname} 
          userRole={userRole} 
          handleLogout={handleLogout}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fade-in">
          <div 
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileOpen(false)} 
          />
          <div className="absolute left-0 top-0 h-full z-50 flex flex-col w-72 bg-[#0B1120] shadow-2xl animate-slide-right">
            <Sidebar 
              mobile={true} 
              collapsed={false} 
              setCollapsed={setCollapsed} 
              pathname={pathname} 
              userRole={userRole} 
              handleLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/70">
        
        {/* Modern Glass Topbar */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-8 h-18 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.03)]">
          
          {/* Left: Mobile trigger & Page Identity */}
          <div className="flex items-center gap-3.5">
            <button
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  {currentPageTitle}
                </h2>
                <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  MBG Enterprise
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 hidden sm:flex">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 font-medium">{currentPageTitle}</span>
              </div>
            </div>
          </div>

          {/* Center: Interactive Quick Search trigger */}
          <div className="hidden xl:flex items-center">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-100 border border-slate-200/90 text-slate-500 text-xs cursor-pointer transition-colors w-72 group shadow-inner">
              <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span className="flex-1 text-slate-400 group-hover:text-slate-600">Cari nota, resep, atau stok...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500 shadow-xs">
                ⌘K
              </kbd>
            </div>
          </div>
          
          {/* Right: Date, System status badge, & User Avatar */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Live date badge */}
            <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-slate-100 to-indigo-50/50 px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-700" suppressHydrationWarning>
                {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>

            {/* Compliance indicator badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Juknis BGN Terverifikasi</span>
            </div>

            <div className="w-px h-6 bg-slate-200 hidden sm:block" />

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 p-[1.5px] shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <span className="text-xs font-bold bg-gradient-to-tr from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase">
                    {userRole ? userRole.charAt(0) : "A"}
                  </span>
                </div>
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                  {tenantName}
                </span>
                <span className="text-[10px] text-slate-500 font-medium capitalize">
                  {userRole}
                </span>
              </div>
            </div>

          </div>
        </header>

        {/* Content Area with rich ambient canvas */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative bg-[#F8FAFC]">
          {/* Subtle multi-color ambient accents in background */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-400/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-amber-400/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="p-4 sm:px-6 sm:pt-4 sm:pb-8 lg:px-8 lg:pt-6 lg:pb-10 max-w-[1600px] mx-auto w-full relative z-10 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

