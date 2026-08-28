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
  SlidersHorizontal
} from "lucide-react";

type NavItem = 
  | { type: "divider", label: string, allowedRoles?: string[] }
  | { href: string; icon: React.ReactNode; label: string; allowedRoles?: string[]; children?: { href: string; label: string; icon?: React.ReactNode }[] };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: <Home className="w-5 h-5" />, label: "Dashboard", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },

  { type: "divider", label: "OPERASIONAL", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },
  { href: "/pembukuan", icon: <BookOpen className="w-5 h-5" />, label: "Pembukuan", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/mbg", icon: <Package className="w-5 h-5" />, label: "MBG Penyerahan", allowedRoles: ["owner", "admin", "akuntan", "gizi"] },
  { 
    href: "/stok", 
    icon: <Package className="w-5 h-5" />, 
    label: "Stok Barang", 
    allowedRoles: ["owner", "admin", "akuntan"],
    children: [
      { href: "/stok", label: "Stok Utama", icon: <Package className="w-4 h-4" /> }, 
      { href: "/stok/riwayat", label: "Riwayat Perubahan", icon: <FileClock className="w-4 h-4" /> }
    ] 
  },
  { href: "/compliance", icon: <ClipboardCheck className="w-5 h-5" />, label: "Kepatuhan & Dokumen", allowedRoles: ["owner", "admin", "gizi"] },
  
  { type: "divider", label: "KEUANGAN", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/keuangan", icon: <CircleDollarSign className="w-5 h-5" />, label: "Piutang & Hutang", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/anggaran", icon: <PieChart className="w-5 h-5" />, label: "Anggaran Dasar", allowedRoles: ["owner", "admin", "akuntan"] },

  { type: "divider", label: "DAPUR", allowedRoles: ["owner", "admin", "gizi"] },
  { href: "/dapur", icon: <UtensilsCrossed className="w-5 h-5" />, label: "Dapur & Resep (BOM)", allowedRoles: ["owner", "admin", "gizi"] },
  { href: "/penyetelan-dapur", icon: <SlidersHorizontal className="w-5 h-5" />, label: "Penyetelan Dapur", allowedRoles: ["owner", "admin", "gizi"] },
  
  { type: "divider", label: "SDM", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/karyawan", icon: <Users className="w-5 h-5" />, label: "Karyawan & Staff", allowedRoles: ["owner", "admin", "akuntan"] },
  
  { type: "divider", label: "ANALITIK", allowedRoles: ["owner", "admin", "akuntan"] },
  { href: "/insights", icon: <LineChart className="w-5 h-5" />, label: "Insights & Harga", allowedRoles: ["owner", "admin", "akuntan"] },
  
  { type: "divider", label: "LAINNYA", allowedRoles: ["owner", "admin"] },
  { href: "/settings", icon: <Settings className="w-5 h-5" />, label: "Pengaturan Sistem", allowedRoles: ["owner", "admin"] },
];

const Sidebar = ({ 
  mobile = false,
  collapsed,
  setCollapsed,
  pathname,
  userRole,
}: { 
  mobile?: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  pathname: string;
  userRole: string;
}) => {
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div
      className={`
        ${mobile ? "w-72" : collapsed ? "w-[88px]" : "w-72"}
        bg-white border-r border-gray-100 flex flex-col h-[100dvh] shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]
        ${mobile ? "" : "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"}
        relative
      `}
    >
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

      {/* Logo Area */}
      <div className="h-20 flex items-center justify-between px-6 relative z-10 shrink-0 mt-2">
        {(!collapsed || mobile) ? (
          <div className="flex items-center gap-3 w-full animate-in">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-600/20 flex items-center justify-center text-white ring-1 ring-white/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900 tracking-tight truncate leading-tight">MBG Catering</h1>
              <p className="text-[11px] font-semibold text-blue-600 tracking-wider uppercase mt-0.5">{userRole || "Administrator"}</p>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md flex items-center justify-center text-white cursor-pointer hover:shadow-lg transition-shadow animate-in">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        )}
        
        {/* Collapse Button */}
        {!mobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all z-20"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 ml-0.5" /> : <ChevronLeft className="w-4 h-4 mr-0.5" />}
          </button>
        )}
      </div>

      {/* Navigation Scroll Area */}
      <nav className="flex-1 py-4 px-4 overflow-y-auto overflow-x-hidden no-scrollbar relative z-10 space-y-1">
        {NAV_ITEMS.filter(item => !item.allowedRoles || item.allowedRoles.includes(userRole)).map((item, index) => {
          if ("type" in item && item.type === "divider") {
            if (collapsed && !mobile) return <div key={`div-${index}`} className="my-5 border-b border-gray-100 w-8 mx-auto" />;
            return (
              <div key={`div-${index}`} className="px-3 pt-5 pb-2 text-[11px] font-bold text-gray-400 tracking-widest uppercase flex items-center gap-2 animate-in shrink-0">
                <span>{item.label}</span>
                <div className="h-px bg-gray-100 flex-1 ml-2"></div>
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
                    relative flex items-center gap-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 group w-full shrink-0
                    ${collapsed && !mobile ? "justify-center px-0 w-12 mx-auto" : "px-3.5"}
                    ${active
                      ? "bg-blue-50/80 text-blue-700 shadow-sm shadow-blue-100/50"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100"}
                  `}
                >
                  {/* Active Indicator Bar */}
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full" />
                  )}
                  
                  <div className={`flex-shrink-0 transition-colors ${active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"}`}>
                    {item.icon}
                  </div>
                  
                  {(!collapsed || mobile) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>

                {/* Submenu Items */}
                {hasChildren && active && (
                  <div className="ml-11 mt-1 space-y-1 relative before:absolute before:left-[-15px] before:top-2 before:bottom-2 before:w-px before:bg-blue-200/60 animate-in">
                    {item.children!.map(child => {
                      const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                      return (
                      <Link 
                        key={child.href} 
                        href={child.href}
                        prefetch={true}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all relative
                          ${childActive
                            ? "text-blue-700 bg-white shadow-sm ring-1 ring-blue-100 font-semibold"
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium"}
                        `}>
                        {child.icon ? (
                          <div className={childActive ? "text-blue-600" : "text-gray-400"}>{child.icon}</div>
                        ) : (
                          <div className={`w-1.5 h-1.5 rounded-full ${childActive ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-gray-300"}`} />
                        )}
                        <span className="truncate">{child.label}</span>
                      </Link>
                    )})}
                  </div>
                )}
              </div>
            );
          }
          return null;
        })}
      </nav>
    </div>
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

  useEffect(() => {
    const initAuth = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      // Fast path: load cached role immediately so layout renders instantly
      const cachedRole = localStorage.getItem("user_role");
      if (cachedRole) {
        setUserRole(cachedRole);
        setIsReady(true);
      } else {
        setIsReady(true);
      }

      // Verify in background and sync role
      try {
        const { apiGet } = await import("@/lib/api");
        const res = await apiGet("/auth/me");
        const freshRole = res?.data?.user?.role || "owner";
        setUserRole(freshRole);
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

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Removed Logout / User Area from sidebar to topbar or keep it separated if needed
  // Since we extracted it, we will put the logout handler directly.

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };


  // Current page title from nav
  const currentPageItem = NAV_ITEMS.find(n => "href" in n && isActive(n.href));
  const currentPage = currentPageItem && "label" in currentPageItem ? currentPageItem.label : "Dashboard";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col h-[100dvh]">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} pathname={pathname} userRole={userRole} />
        {/* Logout / User Area */}
        <div className="p-4 border-t border-gray-100 relative z-10 shrink-0 bg-gray-50/50 w-full">
          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={`
              w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-100 active:bg-red-100 outline-none transition-all group
              ${collapsed ? "px-0 w-12 mx-auto justify-center" : ""}
            `}
          >
            <LogOut className="w-5 h-5 text-red-500 group-hover:text-red-700 transition-colors shrink-0" />
            {!collapsed && <span className="text-sm">Logout / Keluar</span>}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full z-50 flex flex-col w-72 bg-white">
            <Sidebar mobile={true} collapsed={false} setCollapsed={setCollapsed} pathname={pathname} userRole={userRole} />
            <div className="p-4 border-t border-gray-100 relative z-10 shrink-0 bg-gray-50/50">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-100 active:bg-red-100 outline-none transition-all group">
                <LogOut className="w-5 h-5 text-red-500 group-hover:text-red-700 transition-colors shrink-0" />
                <span className="text-sm">Logout / Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="bg-white/90 backdrop-blur-xl border-b border-gray-200/60 px-5 sm:px-8 h-20 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-sm shadow-black/5">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 -ml-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 active:scale-95 transition-all"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 bg-clip-text font-sans">
                {currentPage}
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 hidden sm:flex font-medium">
                <Home className="w-3.5 h-3.5" />
                <span>/</span>
                <span className="text-gray-800">{currentPage}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 shadow-transparent">
                HARI INI
              </span>
              <span className="text-sm font-semibold text-gray-800 bg-gray-100/80 px-3 py-1.5 rounded-lg border border-gray-200/50" suppressHydrationWarning>
                {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            
            <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>
            
            {/* User Avatar Placeholder */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-50 border-2 border-white shadow-sm flex items-center justify-center cursor-pointer hover:shadow-md transition-shadow">
               <span className="font-bold tracking-tighter text-blue-700">A</span>
               <div className="absolute right-6 top-5 sm:right-10 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#fafafa]">
          <div className="p-4 sm:px-6 sm:pt-2 sm:pb-6 lg:px-8 lg:pt-4 lg:pb-8 max-w-[1600px] mx-auto w-full animate-in">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
