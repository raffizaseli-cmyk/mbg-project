# 🎨 STARTER COMPONENTS — Copy & Paste Code

Ready-to-use component code yang bisa langsung copy ke project.

---

## 1. LAYOUT COMPONENTS

### 1.1 Sidebar.tsx
Best save ke: `components/layout/Sidebar.tsx`

```typescript
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
    label: 'Track Harga',
    href: '/dashboard/track-harga',
    icon: TrendingUp,
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

  const isActive = (href: string) => 
    pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => toggleSidebar()}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen w-64 flex-col 
          bg-gradient-to-b from-blue-900 to-blue-800 
          transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-700 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/20" />
            <span className="text-lg font-bold text-white">MBG</span>
          </div>
          <button onClick={() => toggleSidebar()} className="lg:hidden">
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
                  flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium 
                  transition-colors
                  ${
                    isActive(item.href)
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10'
                  }
                `}
                onClick={() => 
                  item.submenu && 
                  setExpandedMenu(expandedMenu === item.label ? null : item.label)
                }
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
                flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium 
                transition-colors
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

      {/* Mobile menu button */}
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

---

### 1.2 lib/store.ts
Zustand store untuk manage sidebar state

```typescript
import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  theme: 'light',
  setTheme: (theme) => set({ theme }),
}));
```

---

## 2. UI COMPONENTS

### 2.1 Button.tsx
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
  const baseStyles = 'font-medium rounded-lg transition-colors font-medium';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
    ghost: 'text-blue-600 hover:bg-blue-50 disabled:text-blue-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
};
```

### 2.2 Card.tsx
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
    elevated: 'bg-white shadow-lg',
    outlined: 'border-2 border-blue-200 bg-blue-50',
  };

  return (
    <div
      className={clsx('rounded-lg p-6', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
};
```

### 2.3 Input.tsx
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

### 2.4 Badge.tsx
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

---

## 3. CHART COMPONENTS

### 3.1 LineChart.tsx
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
        <XAxis dataKey="date" stroke="#6b7280" />
        <YAxis stroke="#6b7280" />
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
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};
```

### 3.2 PieChart.tsx
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
          label={({ name, value }) => `${name}: Rp${(value / 1000000).toFixed(1)}M`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => `Rp${(value / 1000000).toFixed(1)}M`}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};
```

---

## 4. DASHBOARD COMPONENTS

### 4.1 StatCard.tsx
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
            <p className={`mt-2 text-xs font-medium ${change.type === 'up' ? 'text-red-600' : 'text-green-600'}`}>
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

---

## 5. AUTH COMPONENTS

### 5.1 LoginForm.tsx
```typescript
// components/auth/LoginForm.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card variant="default" className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Login</h1>
            <p className="text-sm text-gray-600">MBG Catering Management System</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Input
            type="email"
            label="Email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button isLoading={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <p className="text-center text-sm text-gray-600">
            Don't have account?{' '}
            <a href="/register" className="font-medium text-blue-600 hover:underline">
              Register
            </a>
          </p>
        </form>
      </Card>
    </div>
  );
};
```

---

## 6. CONFIG FILES

### 6.1 tailwind.config.ts
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: '280px',
        'sidebar-collapsed': '80px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}

export default config
```

---

Version: 1.0  
**Copy pasta langsung ke project Anda!**
