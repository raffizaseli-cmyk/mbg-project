# 🎨 FRONTEND IMPLEMENTATION PLAN — MBG Web Dashboard
**Next.js 14 + TailwindCSS + Recharts**  
**Desain**: Minimalis Biru Putih | Sidebar Layout  
**Status**: Ready to Code | Last Updated: April 2026

---

## 📋 RINGKASAN EKSEKUTIF

| Aspek | Detail |
|-------|--------|
| **Framework** | Next.js 14 (App Router) |
| **Styling** | TailwindCSS 3 |
| **Charts** | Recharts 2 |
| **Icons** | Lucide React |
| **Authentication** | Supabase Auth (JWT) |
| **API Client** | Axios + React Query (optional) |
| **Color Scheme** | Biru (#1e40af, #3b82f6) + Putih + Abu abu (#f3f4f6) |
| **Layout** | Sidebar Kiri (Fixed/Collapsible) |
| **Hosting** | Vercel (auto-deploy dari Git) |
| **Timeline** | 4-5 minggu (MVP) |

---

## 🎯 PHASE 1: SETUP & FOUNDATION (1 minggu)

### 1.1 Environment & Dependencies
```bash
cd web
npm install react-query zustand date-fns clsx classnames-merge
npm install -D @tailwindcss/forms @tailwindcss/typography
```

**Dependencies Detail**:
- `react-query`: Client-side data caching + synchronization
- `zustand`: Lightweight state management (sidebar, theme)
- `date-fns`: Date formatting untuk laporan
- `clsx`: Conditional CSS classname utility

### 1.2 Folder Structure
```
web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   └── unauthorized/
│   │       └── page.tsx
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard wrapper + sidebar
│   │   ├── page.tsx            # Home/Dashboard
│   │   ├── pembukuan/
│   │   │   ├── page.tsx        # List pengeluaran
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Detail pengeluaran
│   │   ├── hutang-piutang/
│   │   │   ├── page.tsx        # List hutang/piutang
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Detail transaksi
│   │   ├── stok/
│   │   │   ├── page.tsx        # Stok gudang
│   │   │   └── kategori/
│   │   │       └── page.tsx    # By kategori
│   │   ├── laporan/
│   │   │   ├── page.tsx        # List laporan
│   │   │   ├── harian/
│   │   │   ├── mingguan/
│   │   │   ├── bulanan/
│   │   │   └── audit/
│   │   ├── ai-jadwal/
│   │   │   └── page.tsx        # Menu scheduler
│   │   ├── track-harga/
│   │   │   └── page.tsx        # Price tracking + supplier
│   │   ├── settings/
│   │   │   ├── page.tsx        # User settings
│   │   │   ├── sekolah/        # School management
│   │   │   ├── supplier/       # Supplier management
│   │   │   ├── bom/            # BOM (Bill of Materials)
│   │   │   └── profil-perusahaan/
│   │   │
│   │   └── api/
│   │       └── auth/
│   │           └── callback/
│   │               └── route.ts
│   │
│   ├── api/                  # Route handlers (API integration layer)
│   │   ├── auth/
│   │   ├── pembukuan/
│   │   ├── hutang-piutang/
│   │   ├── stok/
│   │   ├── laporan/
│   │   └── upload/
│   │
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global TailwindCSS styles
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx       # Navigation sidebar (CORE)
│   │   ├── TopBar.tsx        # Top bar dengan user profile
│   │   ├── Header.tsx        # Page header
│   │   └── DashboardLayout.tsx # Layout wrapper
│   │
│   ├── ui/
│   │   ├── Button.tsx        # Tombol reusable
│   │   ├── Card.tsx          # Card component
│   │   ├── Modal.tsx         # Modal dialog
│   │   ├── Input.tsx         # Form input
│   │   ├── Select.tsx        # Dropdown select
│   │   ├── Pagination.tsx    # Pagination
│   │   ├── Loading.tsx       # Loading spinner
│   │   ├── Alert.tsx         # Alert/notification
│   │   ├── Badge.tsx         # Status badge
│   │   └── Tabs.tsx          # Tab navigation
│   │
│   ├── charts/
│   │   ├── PieChart.tsx      # Pengeluaran by kategori
│   │   ├── BarChart.tsx      # Harian/mingguan comparison
│   │   ├── LineChart.tsx     # Trend harga supplier
│   │   ├── AreaChart.tsx     # Stok overtime
│   │   └── ChartContainer.tsx # Wrapper component
│   │
│   ├── dashboard/
│   │   ├── StatCard.tsx      # KPI card (revenue, expense, etc)
│   │   ├── RecentTransactions.tsx
│   │   ├── AlertDeadlines.tsx # Hutang/piutang jatuh tempo
│   │   ├── MenuPreview.tsx   # Menu mingguan preview
│   │   └── QuickActions.tsx  # Action buttons
│   │
│   ├── forms/
│   │   ├── FormPembukuan.tsx # Form input pengeluaran
│   │   ├── FormHutang.tsx
│   │   ├── FormSekolah.tsx
│   │   ├── FormSupplier.tsx
│   │   └── FormBOM.tsx
│   │
│   └── auth/
│       ├── LoginForm.tsx
│       ├── RegisterForm.tsx
│       └── LogoutButton.tsx
│
├── lib/
│   ├── api.ts               # Axios instance + interceptors
│   ├── supabase.ts          # Supabase client init
│   ├── store.ts             # Zustand stores (user, sidebar state)
│   ├── utils.ts             # Helper functions
│   ├── constants.ts         # Routes, colors, API endpoints
│   ├── hooks.ts             # Custom React hooks
│   └── formatters.ts        # Date, currency formatting
│
├── styles/
│   ├── colors.css           # Custom color scale biru-putih
│   ├── components.css       # Reusable Tailwind component classes
│   └── animations.css       # Transition/animation utilities
│
├── public/
│   └── assets/
│       ├── logo.svg
│       ├── illustrations/
│       └── icons/
│
├── .env.local              # (gitignore: local secrets)
├── tailwind.config.ts      # TailwindCSS customization
├── tsconfig.json           # TypeScript config
└── package.json
```

### 1.3 TailwindCSS Configuration
```typescript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',     // Main blue
          600: '#2563eb',     // Darker blue
          700: '#1d4ed8',
          800: '#1e40af',     // Dark blue for accents
          900: '#1e3a8a',
        },
        neutral: {
          50: '#fafafa',      // Almost white
          100: '#f5f5f5',
          200: '#eeeeee',
          300: '#e0e0e0',
          400: '#bdbdbd',
          500: '#9e9e9e',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',     // Dark text
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: '280px',     // Sidebar width
        'sidebar-collapsed': '80px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
```

### 1.4 Global Styles
```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary-blue: #1e40af;
  --primary-blue-light: #3b82f6;
  --bg-light: #f9fafb;
  --border-light: #e5e7eb;
}

body {
  @apply bg-gray-50 text-gray-900;
  font-family: 'Inter', sans-serif;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  @apply w-2;
}

::-webkit-scrollbar-track {
  @apply bg-gray-100;
}

::-webkit-scrollbar-thumb {
  @apply bg-blue-500 rounded-full;
}
```

---

## 🎨 PHASE 2: DESIGN SYSTEM & UI COMPONENTS (1 minggu)

### 2.1 Color System
```typescript
// lib/constants.ts
export const COLORS = {
  primary: {
    dark: '#1e40af',      // Sidebar, button primary
    light: '#3b82f6',     // Links, interactive
    lightest: '#dbeafe',  // Hover states
  },
  secondary: {
    green: '#10b981',     // Success, green indicator
    red: '#ef4444',       // Error, red indicator
    yellow: '#f59e0b',    // Warning
    gray: '#6b7280',      // Neutral
  },
  bg: {
    white: '#ffffff',
    light: '#f9fafb',
    lighter: '#f3f4f6',
  },
  border: '#e5e7eb',
  text: {
    dark: '#111827',
    base: '#374151',
    light: '#6b7280',
  },
};

export const CHART_COLORS = {
  categoryColors: [
    '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd',
    '#10b981', '#34d399', '#6ee7b7',
    '#f59e0b', '#fbbf24', '#fcd34d',
    '#ef4444', '#f87171',
  ],
};
```

### 2.2 Reusable UI Components

#### Button Component
```typescript
// components/ui/Button.tsx
import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  children,
  ...props
}) => {
  const baseStyles = 'font-medium rounded-lg transition-colors';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    ghost: 'text-blue-600 hover:bg-blue-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? '...' : children}
    </button>
  );
};
```

#### Card Component
```typescript
// components/ui/Card.tsx
import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className,
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-white border border-gray-200',
    elevated: 'bg-white shadow-md',
    outlined: 'border-2 border-blue-200 bg-blue-50',
  };

  return (
    <div
      className={clsx(
        'rounded-lg p-6',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
```

#### Input Component
```typescript
// components/ui/Input.tsx
import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className,
  ...props
}) => {
  return (
    <div className="flex flex-col">
      {label && (
        <label className="mb-2 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={clsx(
          'rounded-lg border px-4 py-2 outline-none transition-colors',
          error 
            ? 'border-red-500 bg-red-50' 
            : 'border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
          className
        )}
        {...props}
      />
      {error && <span className="mt-1 text-sm text-red-600">{error}</span>}
    </div>
  );
};
```

#### Badge Component
```typescript
// components/ui/Badge.tsx
import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'info', children }) => {
  const variantStyles = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={clsx('rounded-full px-3 py-1 text-xs font-medium', variantStyles[variant])}>
      {children}
    </span>
  );
};
```

#### StatCard Component (Dashboard)
```typescript
// components/dashboard/StatCard.tsx
import React from 'react';
import { Card } from '@/components/ui/Card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: { value: number; type: 'up' | 'down' };
  icon: LucideIcon;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
}) => {
  return (
    <Card variant="default">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <h3 className="mt-1 text-2xl font-bold text-gray-900">{value}</h3>
          {change && (
            <p className={`mt-2 text-xs font-medium ${change.type === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {change.type === 'up' ? '↑' : '↓'} {change.value}% vs bulan lalu
            </p>
          )}
        </div>
        <Icon className="h-12 w-12 text-blue-500" strokeWidth={1.5} />
      </div>
    </Card>
  );
};
```

### 2.3 Chart Components (Recharts Integration)

#### LineChart Component (Price Tracking)
```typescript
// components/charts/LineChart.tsx
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LineChartProps {
  data: any[];
  lines: Array<{ key: string; color: string; name: string }>;
  height?: number;
}

export const CustomLineChart: React.FC<LineChartProps> = ({
  data,
  lines,
  height = 300,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
          }}
        />
        <Legend />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            stroke={line.color}
            name={line.name}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};
```

#### PieChart Component (Spending by Category)
```typescript
// components/charts/PieChart.tsx
import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  colors: string[];
}

export const CustomPieChart: React.FC<PieChartProps> = ({ data, colors }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: Rp${value}`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `Rp${value}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};
```

#### BarChart Component (Daily/Weekly Comparison)
```typescript
// components/charts/BarChart.tsx
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BarChartProps {
  data: any[];
  bars: Array<{ key: string; color: string; name: string }>;
  height?: number;
}

export const CustomBarChart: React.FC<BarChartProps> = ({
  data,
  bars,
  height = 300,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
          }}
        />
        <Legend />
        {bars.map((bar) => (
          <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.name} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};
```

---

## 🏗️ PHASE 3: LAYOUT & NAVIGATION (1 minggu)

### 3.1 Sidebar Navigation Component (CORE)
```typescript
// components/layout/Sidebar.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  BarChart3,
  FileText,
  Wallet,
  Package,
  TrendingUp,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '@/lib/store';

const MENU_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: BarChart3,
  },
  {
    label: 'Pembukuan',
    href: '/dashboard/pembukuan',
    icon: Wallet,
    description: 'Pengeluaran harian',
  },
  {
    label: 'Hutang/Piutang',
    href: '/dashboard/hutang-piutang',
    icon: FileText,
    description: 'Manajemen piutang',
  },
  {
    label: 'Stok Gudang',
    href: '/dashboard/stok',
    icon: Package,
    description: 'Inventaris',
  },
  {
    label: 'Laporan',
    href: '/dashboard/laporan',
    icon: FileText,
    submenu: [
      { label: 'Harian', href: '/dashboard/laporan/harian' },
      { label: 'Mingguan', href: '/dashboard/laporan/mingguan' },
      { label: 'Bulanan', href: '/dashboard/laporan/bulanan' },
    ],
  },
  {
    label: 'AI Jadwal',
    href: '/dashboard/ai-jadwal',
    icon: BarChart3,
    description: 'Menu suggestions',
  },
  {
    label: 'Track Harga',
    href: '/dashboard/track-harga',
    icon: TrendingUp,
    description: 'Price tracking',
  },
];

const SETTING_ITEMS = [
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
  {
    label: 'Logout',
    href: '/logout',
    icon: LogOut,
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useStore();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => toggleSidebar()}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-gradient-to-b from-blue-900 to-blue-800 transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-700 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/20" />
            <span className="text-lg font-bold text-white">MBG</span>
          </div>
          <button
            onClick={() => toggleSidebar()}
            className="lg:hidden"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {MENU_ITEMS.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`
                  flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors
                  ${
                    isActive(item.href)
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10'
                  }
                `}
                onClick={() => item.submenu && setExpandedMenu(expandedMenu === item.label ? null : item.label)}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {item.submenu && (
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      expandedMenu === item.label ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </Link>

              {/* Submenu */}
              {item.submenu && expandedMenu === item.label && (
                <div className="mt-1 space-y-1 pl-8">
                  {item.submenu.map((subitem) => (
                    <Link
                      key={subitem.href}
                      href={subitem.href}
                      className={`
                        block rounded-lg px-4 py-2 text-xs font-medium transition-colors
                        ${
                          isActive(subitem.href)
                            ? 'bg-white/20 text-white'
                            : 'text-blue-100 hover:bg-white/10'
                        }
                      `}
                    >
                      {subitem.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Settings */}
        <div className="border-t border-blue-700 px-3 py-4">
          {SETTING_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors
                ${
                  isActive(item.href)
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10'
                }
              `}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* Mobile header button */}
      <button
        onClick={() => toggleSidebar()}
        className="fixed top-4 left-4 z-40 rounded-lg bg-blue-900 p-2 text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  );
};
```

### 3.2 Dashboard Layout
```typescript
// app/(dashboard)/layout.tsx
import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-0">
      <Sidebar />
      <div className="flex-1 lg:ml-64">
        <TopBar />
        <main className="min-h-screen bg-gray-50 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 3.3 TopBar Component
```typescript
// components/layout/TopBar.tsx
'use client';

import React from 'react';
import { Menu, Bell, User, LogOut } from 'lucide-react';
import Link from 'next/link';

export const TopBar: React.FC = () => {
  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 lg:px-6 lg:py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-4">
          <button className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <button className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 📱 PHASE 4: PAGE IMPLEMENTATIONS (1.5 minggu)

### 4.1 Dashboard Home (`/dashboard`)
```typescript
// app/(dashboard)/page.tsx
'use client';

import React from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card } from '@/components/ui/Card';
import { CustomLineChart } from '@/components/charts/LineChart';
import { CustomPieChart } from '@/components/charts/PieChart';
import {
  BarChart3,
  TrendingUp,
  Users,
  Package,
} from 'lucide-react';

// Mock data (replace dengan API call)
const dashboardStats = [
  {
    title: 'Total Pengeluaran',
    value: 'Rp 45.2M',
    change: { value: 12, type: 'down' as const },
    icon: BarChart3,
  },
  {
    title: 'Total Piutang',
    value: 'Rp 12.5M',
    change: { value: 5, type: 'up' as const },
    icon: TrendingUp,
  },
  {
    title: 'Sekolah Aktif',
    value: '5',
    icon: Users,
  },
  {
    title: 'Stok Barang',
    value: '243',
    change: { value: 8, type: 'down' as const },
    icon: Package,
  },
];

const chartData = [
  { date: 'Mon', pengeluaran: 4000, budget: 2400 },
  { date: 'Tue', pengeluaran: 3000, budget: 1398 },
  { date: 'Wed', pengeluaran: 2000, budget: 9800 },
  { date: 'Thu', pengeluaran: 2780, budget: 3908 },
  { date: 'Fri', pengeluaran: 1890, budget: 4800 },
  { date: 'Sat', pengeluaran: 2390, budget: 3800 },
];

const categoryData = [
  { name: 'Bahan Pangan', value: 35000000 },
  { name: 'Upah Masak', value: 15000000 },
  { name: 'Operasional', value: 5000000 },
  { name: 'Lainnya', value: 2000000 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Line Chart - Daily Expense Trend */}
        <Card variant="default">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Trend Pengeluaran</h2>
            <p className="text-sm text-gray-600">7 hari terakhir vs budget</p>
          </div>
          <div className="mt-4">
            <CustomLineChart
              data={chartData}
              lines={[
                { key: 'pengeluaran', color: '#1e40af', name: 'Pengeluaran' },
                { key: 'budget', color: '#10b981', name: 'Budget' },
              ]}
            />
          </div>
        </Card>

        {/* Pie Chart - Spending by Category */}
        <Card variant="default">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Pengeluaran by Kategori</h2>
            <p className="text-sm text-gray-600">Bulan ini</p>
          </div>
          <div className="mt-4">
            <CustomPieChart
              data={categoryData}
              colors={['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd']}
            />
          </div>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card variant="default">
        <h2 className="text-lg font-bold text-gray-900">Transaksi Terbaru</h2>
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
              <div>
                <p className="font-medium text-gray-900">Belanja ke Supplier A</p>
                <p className="text-sm text-gray-600">2 jam yang lalu</p>
              </div>
              <span className="font-bold text-gray-900">Rp 2.5M</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

### 4.2 Pembukuan (Expense Tracking)
```typescript
// app/(dashboard)/pembukuan/page.tsx
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, FileText, Download } from 'lucide-react';
import Link from 'next/link';

export default function PembukuanPage() {
  const [filterDate, setFilterDate] = useState('');

  const expenses = [
    {
      id: 1,
      date: '2026-04-03',
      supplier: 'PT Maju Jaya',
      items: 'Beras 50kg, Telur 30 butir',
      amount: 2500000,
      status: 'confirmed',
    },
    // More items...
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pembukuan</h1>
          <p className="text-sm text-gray-600">Daftar pengeluaran harian</p>
        </div>
        <Link href="/dashboard/pembukuan/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Tambah Pengeluaran
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card variant="default">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label="Filter by Date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <Button variant="secondary">Filter</Button>
        </div>
      </Card>

      {/* Table */}
      <Card variant="default">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Tanggal</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Supplier</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Items</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">Jumlah</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{expense.date}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{expense.supplier}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{expense.items.substring(0, 30)}...</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  Rp {(expense.amount / 1000000).toFixed(1)}M
                </td>
                <td className="px-4 py-3 text-center">
                  <Link href={`/dashboard/pembukuan/${expense.id}`}>
                    <Button size="sm" variant="ghost">
                      Detail
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

### 4.3 Hutang/Piutang (Receivables & Payables)
```typescript
// app/(dashboard)/hutang-piutang/page.tsx
'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, CreditCard } from 'lucide-react';

export default function HutangPiutangPage() {
  const piutang = [
    {
      id: 1,
      sekolah: 'SDN Mulia Jaya',
      tanggal: '2026-03-20',
      amount: 5000000,
      dueDate: '2026-04-10',
      status: 'overddue',
    },
    // More items...
  ];

  const hutang = [
    {
      id: 1,
      supplier: 'PT Makmur Jaya',
      tanggal: '2026-03-25',
      amount: 8000000,
      dueDate: '2026-04-08',
      status: 'pending',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Hutang & Piutang</h1>

      {/* Summary */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card variant="outlined" className="border-green-200 bg-green-50">
          <div className="flex items-center gap-4">
            <CreditCard className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-green-700">Total Piutang</p>
              <p className="text-2xl font-bold text-green-900">Rp 15.2M</p>
            </div>
          </div>
        </Card>

        <Card variant="outlined" className="border-red-200 bg-red-50">
          <div className="flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-red-700">Total Hutang</p>
              <p className="text-2xl font-bold text-red-900">Rp 12.5M</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Piutang Section */}
      <Card variant="default">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Piutang (Invoice Keluar)</h2>
        <div className="space-y-3">
          {piutang.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.sekolah}</p>
                <p className="text-xs text-gray-600">{item.tanggal} • Tempo: {item.dueDate}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-900">Rp {(item.amount / 1000000).toFixed(1)}M</span>
                <Badge variant={item.status === 'overdue' ? 'error' : 'warning'}>
                  {item.status === 'overdue' ? 'Overdue' : 'Pending'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Hutang Section */}
      <Card variant="default">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Hutang (Invoice Masuk)</h2>
        <div className="space-y-3">
          {hutang.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.supplier}</p>
                <p className="text-xs text-gray-600">{item.tanggal} • Tempo: {item.dueDate}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-900">Rp {(item.amount / 1000000).toFixed(1)}M</span>
                <Badge variant="info">{item.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

### 4.4 Track Harga (Price Tracking with Line Chart)
```typescript
// app/(dashboard)/track-harga/page.tsx
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { CustomLineChart } from '@/components/charts/LineChart';
import { Select } from '@/components/ui/Select';

export default function TrackHargaPage() {
  const [selectedSupplier, setSelectedSupplier] = useState('all');

  // Mock price history data
  const priceData = [
    { date: 'Mar 20', 'PT Jaya': 25000, 'CV Makmur': 26000, 'PT Global': 24500 },
    { date: 'Mar 25', 'PT Jaya': 26000, 'CV Makmur': 26500, 'PT Global': 24800 },
    { date: 'Mar 30', 'PT Jaya': 27000, 'CV Makmur': 27000, 'PT Global': 25500 },
    { date: 'Apr 02', 'PT Jaya': 27500, 'CV Makmur': 27500, 'PT Global': 26000 },
  ];

  const suppliers = [
    { id: 'all', name: 'Semua Supplier' },
    { id: 'pt_jaya', name: 'PT Jaya' },
    { id: 'cv_makmur', name: 'CV Makmur' },
    { id: 'pt_global', name: 'PT Global' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Track Harga</h1>
        <p className="text-sm text-gray-600">Pantau perubahan harga supplier</p>
      </div>

      {/* Filter */}
      <Card variant="default">
        <Select
          options={suppliers}
          selected={selectedSupplier}
          onChange={setSelectedSupplier}
          label="Filter Supplier"
        />
      </Card>

      {/* Chart */}
      <Card variant="default">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Trend Harga Beras/kg (30 hari)</h2>
        <CustomLineChart
          data={priceData}
          lines={[
            { key: 'PT Jaya', color: '#1e40af', name: 'PT Jaya' },
            { key: 'CV Makmur', color: '#3b82f6', name: 'CV Makmur' },
            { key: 'PT Global', color: '#10b981', name: 'PT Global' },
          ]}
          height={400}
        />
      </Card>

      {/* Summary Table */}
      <Card variant="default">
        <h3 className="mb-4 text-lg font-bold text-gray-900">Rangkuman Harga Terbaru</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-2 text-left font-bold text-gray-700">Supplier</th>
              <th className="px-4 py-2 text-right font-bold text-gray-700">Harga</th>
              <th className="px-4 py-2 text-right font-bold text-gray-700">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-900">PT Jaya</td>
              <td className="px-4 py-2 text-right text-gray-900">Rp 27.500</td>
              <td className="px-4 py-2 text-right text-red-600">+1% ↑</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-900">CV Makmur</td>
              <td className="px-4 py-2 text-right text-gray-900">Rp 27.500</td>
              <td className="px-4 py-2 text-right text-green-600">-0.5% ↓</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-gray-900">PT Global</td>
              <td className="px-4 py-2 text-right text-gray-900">Rp 26.000</td>
              <td className="px-4 py-2 text-right text-green-600">-2% ↓</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

---

## 🔐 PHASE 5: AUTHENTICATION & SECURITY (5 hari)

### 5.1 Supabase Auth Setup
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

### 5.2 Login Form Component
```typescript
// components/auth/LoginForm.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { login } from '@/lib/supabase';

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="default" className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Login</h1>
        
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <Input
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button isLoading={loading} className="w-full">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </Card>
  );
};
```

---

## 📦 PHASE 6: API INTEGRATION (1 minggu)

### 6.1 Axios Setup with Interceptors
```typescript
// lib/api.ts
import axios from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 6.2 Custom Hooks for Data Fetching
```typescript
// lib/hooks.ts
import { useQuery, useMutation } from 'react-query';
import api from './api';

// Fetch pembukuan
export const usePembukuan = () => {
  return useQuery(['pembukuan'], async () => {
    const response = await api.get('/pembukuan');
    return response.data;
  });
};

// Create pembukuan
export const useCreatePembukuan = () => {
  return useMutation((data: any) => api.post('/pembukuan', data));
};

// Fetch hutang/piutang
export const useHutangPiutang = () => {
  return useQuery(['hutang-piutang'], async () => {
    const response = await api.get('/hutang-piutang');
    return response.data;
  });
};

// Fetch stok
export const useStok = () => {
  return useQuery(['stok'], async () => {
    const response = await api.get('/stok');
    return response.data;
  });
};

// Fetch price tracking
export const usePriceTracking = (supplierId?: string) => {
  return useQuery(
    ['price-tracking', supplierId],
    async () => {
      const response = await api.get('/track-harga', {
        params: { supplier_id: supplierId },
      });
      return response.data;
    }
  );
};
```

---

## 🎬 DEPLOYMENT & HOSTING

### 7.1 Vercel Deployment
```
1. Push code ke GitHub
2. Connect repo ke Vercel
3. Set environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - NEXT_PUBLIC_API_URL
4. Deploy dengan 1 klik
```

### 7.2 Environment Configuration
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
NEXT_PUBLIC_API_URL=https://api.mbg.example.com
```

---

## ✅ DELIVERABLES CHECKLIST

| Phase | Component | Status | Estimated Time |
|-------|-----------|--------|-----------------|
| 1 | Setup & Dependencies | ✓ | 1 hari |
| 2 | Design System & UI Components | ✓ | 3 hari |
| 3 | Sidebar + Layout | ✓ | 2 hari |
| 4 | Dashboard Home | ⬜ | 1 hari |
| 4 | Pembukuan Page | ⬜ | 1.5 hari |
| 4 | Hutang/Piutang Page | ⬜ | 1 hari |
| 4 | Track Harga + Charts | ⬜ | 1.5 hari |
| 4 | Stok Gudang Page | ⬜ | 1 hari |
| 4 | Laporan Pages | ⬜ | 2 hari |
| 4 | Settings Pages | ⬜ | 1.5 hari |
| 5 | Authentication | ✓ | 1 hari |
| 6 | API Integration | ✓ | 3 hari |
| 7 | Deployment to Vercel | ⬜ | 1 hari |

---

## 🎨 DESIGN TOKENS & BRAND GUIDELINES

### Color Palette
```
Primary Blue:      #1e40af (Sidebar, buttons, accents)
Light Blue:        #3b82f6 (Links, interactive)
Lightest Blue:     #dbeafe (Backgrounds, hover)
White:             #ffffff (Cards, main content)
Light Gray:        #f9fafb (Page background)
Neutral Gray:      #6b7280 (Text, secondary)
Success Green:     #10b981 (Positive indicators)
Error Red:         #ef4444 (Errors, warnings)
```

### Typography
```
Font Family: Inter (Google Fonts)
Headings: Bold
Body: Regular 
Sizes: 12px (small), 14px (base), 16px (lg), 18px (xl), 20px (2xl), 24px (3xl)
```

### Spacing
```
Base unit: 4px
Padding: 4px, 8px, 12px, 16px, 24px, 32px
Margins: 4px, 8px, 12px, 16px, 24px
Gap: 8px, 12px, 16px, 24px
```

---

## 📝 NOTES & BEST PRACTICES

✅ **DO**:
- Use component composition untuk reusability
- Implement proper error boundaries
- Add loading states untuk setiap data fetch
- Optimize images dengan Next.js Image component
- Implement proper TypeScript types
- Use dark mode friendly colors

❌ **DON'T**:
- Hardcode colors (use Tailwind config)
- Create deeply nested components
- Skip accessibility (a11y) features
- Ignore error handling
- Leave console logs in production

---

## 🚀 NEXT STEPS

1. **Week 1**: Complete Phases 1-3 (Setup, Design System, Layout)
2. **Week 2**: Complete Phase 4 (Page implementations for core features)
3. **Week 3**: Complete Phase 5-6 (Auth, API integration, testing)
4. **Week 4**: QA, bug fixes, deployment
5. **Week 5**: Monitor production, optimization

---

**Last Updated**: April 3, 2026  
**Version**: 1.0 (Ready to Code)  
**Owner**: Frontend Team  
**Status**: ✅ APPROVED FOR DEVELOPMENT
