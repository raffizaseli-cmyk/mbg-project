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
  Calendar,
  ShieldCheck
} from "lucide-react";

type NavItem = 
  | { type: "divider"; label: string; allowedRoles?: string[] }
  | { 
      href: string; 
      icon: React.ReactNode; 
      label: string; 
      allowedRoles?: string[]; 
      children?: { href: string; label: string; icon?: React.ReactNode }[];
      badge?: string;
    };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: <Home className="w-5 h-5" />, label: "Dashboard", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },

  { type: "divider", label: "OPERASIONAL", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },
  { href: "/pembukuan", icon: <BookOpen className="w-5 h-5" />, label: "Pembukuan", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/mbg", icon: <Package className="w-5 h-5" />, label: "MBG Penyerahan", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },
  { 
    href: "/stok", 
    icon: <Package className="w-5 h-5" />, 
    label: "Stok Gudang", 
    allowedRoles: ["owner", "admin", "akuntan"],
    children: [
      { href: "/stok", label: "Stok Utama", icon: <Package className="w-4 h-4" /> }, 
      { href: "/stok/riwayat", label: "Riwayat Log", icon: <FileClock className="w-4 h-4" /> }
    ] 
  },
  { href: "/compliance", icon: <ClipboardCheck className="w-5 h-5" />, label: "Kepatuhan & Dokumen", allowedRoles: ["owner", "admin", "gizi"] },
  
  { type: "divider", label: "KEUANGAN", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/keuangan", icon: <CircleDollarSign className="w-5 h-5" />, label: "Piutang & Hutang", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/anggaran", icon: <PieChart className="w-5 h-5" />, label: "Anggaran Juknis", allowedRoles: ["owner", "admin", "akuntan"] },

  { type: "divider", label: "DAPUR & GIZI", allowedRoles: ["owner", "admin", "gizi"] },
  { href: "/dapur", icon: <UtensilsCrossed className="w-5 h-5" />, label: "Dapur & Resep (BOM)", allowedRoles: ["owner", "admin", "gizi"] },
  { href: "/penyetelan-dapur", icon: <SlidersHorizontal className="w-5 h-5" />, label: "Penyetelan Dapur", allowedRoles: ["owner", "admin", "gizi"] },
  
  { type: "divider", label: "SDM & KARYAWAN", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/karyawan", icon: <Users className="w-5 h-5" />, label: "Karyawan & Tim", allowedRoles: ["owner", "admin", "akuntan"] },
  
  { type: "divider", label: "ANALITIK", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/insights", icon: <LineChart className="w-5 h-5" />, label: "Insights & Harga", allowedRoles: ["owner", "admin", "akuntan"] },
  
  { type: "divider", label: "SISTEM", allowedRoles: ["owner", "admin"] },
  { href: "/settings", icon: <Settings className="w-5 h-5" />, label: "Pengaturan Sistem", allowedRoles: ["owner", "admin"] },
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
    switch (role?.toLowerCase()) {
      case "owner":
      case "admin":
        return "Admin SPPG";
      case "akuntan":
        return "Akuntan";
      case "gizi":
        return "Ahli Gizi";
      default:
        return role || "Staf";
    }
  };

  return (
    <aside
      className={`
        ${mobile ? "w-72" : collapsed ? "w-[88px]" : "w-72"}
        bg-white text-slate-700 border-r border-slate-200 flex flex-col h-[100dvh]
        ${mobile ? "" : "transition-all duration-300 ease-in-out"}
        relative shadow-xs z-30 select-none
      `}
    >
      {/* Brand Header */}
      <div className="h-18 flex items-center justify-between px-5 relative z-10 shrink-0 border-b border-slate-100">
        {(!collapsed || mobile) ? (
          <div className="flex items-center gap-3 w-full animate-in">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate leading-tight">MBG Catering</h1>
              <p className="text-[11px] font-semibold text-blue-600 tracking-wide uppercase mt-0.5">{getRoleBadge(userRole)}</p>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 mx-auto rounded-xl bg-blue-600 flex items-center justify-center text-white cursor-pointer shadow-xs animate-in">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        )}
        
        {/* Collapse toggle button */}
        {!mobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 rounded-full flex items-center justify-center shadow-xs focus:outline-none transition-all z-40 cursor-pointer"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 ml-0.5" /> : <ChevronLeft className="w-4 h-4 mr-0.5" />}
          </button>
        )}
      </div>

      {/* Navigation Links Scrollable Area */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto overflow-x-hidden no-scrollbar relative z-10 space-y-1">
        {NAV_ITEMS.filter(item => !item.allowedRoles || item.allowedRoles.includes(userRole)).map((item, index) => {
          if ("type" in item && item.type === "divider") {
            if (collapsed && !mobile) {
              return <div key={`div-${index}`} className="my-3 border-b border-slate-100 w-8 mx-auto" />;
            }
            return (
              <div key={`div-${index}`} className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-2 shrink-0">
                <span>{item.label}</span>
                <div className="h-px bg-slate-100 flex-1 ml-1" />
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
                    relative flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-colors group w-full shrink-0
                    ${collapsed && !mobile ? "justify-center px-0 w-11 mx-auto" : "px-3.5"}
                    ${active
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}
                  `}
                >
                  {/* Active Indicator Line */}
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
                  )}
                  
                  <div className={`flex-shrink-0 transition-colors ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}>
                    {item.icon}
                  </div>
                  
                  {(!collapsed || mobile) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}

                  {(!collapsed || mobile) && item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-700">
                      {item.badge}
                    </span>
                  )}
                </Link>

                {/* Submenu for nested items */}
                {hasChildren && active && (
                  <div className="ml-8 mt-0.5 space-y-0.5 pl-3 border-l border-slate-200">
                    {item.children!.map(child => {
                      const childActive = pathname === child.href;
                      return (
                        <Link 
                          key={child.href} 
                          href={child.href}
                          prefetch={true}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors
                            ${childActive
                              ? "text-blue-700 bg-blue-50/70 font-semibold"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium"}
                          `}
                        >
                          <div className={childActive ? "text-blue-600" : "text-slate-400"}>
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
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer
            ${collapsed && !mobile ? "justify-center px-0 w-10 mx-auto" : ""}
          `}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {(!collapsed || mobile) && (
            <span>Keluar Sesi</span>
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

      const cachedRole = localStorage.getItem("user_role");
      if (cachedRole) {
        setUserRole(cachedRole);
        setIsReady(true);
      } else {
        setIsReady(true);
      }

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

  useEffect(() => { 
    setMobileOpen(false); 
  }, [pathname]);

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Memuat MBG Catering...</p>
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

  const currentPageItem = NAV_ITEMS.find(n => "href" in n && isActive(n.href));
  const currentPageTitle = currentPageItem && "label" in currentPageItem ? currentPageItem.label : "Dashboard";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
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
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setMobileOpen(false)} 
          />
          <div className="absolute left-0 top-0 h-full z-50 flex flex-col w-72 bg-white shadow-xl">
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs">
          
          {/* Left: Mobile trigger & Page Identity */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {currentPageTitle}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 hidden sm:flex">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300">/</span>
                <span className="text-slate-600 font-medium">{currentPageTitle}</span>
              </div>
            </div>
          </div>

          {/* Center: Search */}
          <div className="hidden xl:flex items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-slate-500 text-xs cursor-pointer transition-colors w-64 group">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <span className="flex-1 text-slate-400 group-hover:text-slate-600">Cari nota, resep, atau stok...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500">
                ⌘K
              </kbd>
            </div>
          </div>
          
          {/* Right: Date, System status badge, & User Avatar */}
          <div className="flex items-center gap-3">
            
            {/* Live date */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span suppressHydrationWarning>
                {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>

            {/* Compliance indicator badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Standar BGN</span>
            </div>

            <div className="w-px h-5 bg-slate-200 hidden sm:block" />

            {/* User Profile */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center uppercase">
                {userRole ? userRole.charAt(0) : "A"}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                  {tenantName}
                </span>
                <span className="text-[10px] text-slate-500 capitalize">
                  {userRole}
                </span>
              </div>
            </div>

          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
