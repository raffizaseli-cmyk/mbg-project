# 🏗️ FRONTEND ARCHITECTURE & DIAGRAMS

Visual diagrams untuk understand struktur frontend secara menyeluruh.

---

## PROJECT ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│           VERCEL (Next.js 14 Hosting)                           │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Next.js App Router                      │ │
│  │                                                             │ │
│  │  ┌────────────────────────────────────────────────────┐   │ │
│  │  │ (auth)              (dashboard)                    │   │ │
│  │  │ - login            - /                             │   │ │
│  │  │ - register         - pembukuan/                    │   │ │
│  │  │ - logout           - hutang-piutang/              │   │ │
│  │  │                    - stok/                         │   │ │
│  │  │                    - track-harga/                  │   │ │
│  │  │                    - laporan/                      │   │ │
│  │  │                    - settings/                     │   │ │
│  │  └────────────────────────────────────────────────────┘   │ │
│  │                         ↓                                  │ │
│  │  ┌────────────────────────────────────────────────────┐   │ │
│  │  │      React Components (Sidebar, Cards, Charts)     │   │ │
│  │  │                                                     │   │ │
│  │  │  ┌─────────────┐  ┌────────────────────────────┐  │   │ │
│  │  │  │  Sidebar    │  │    Pages + Components      │  │   │ │
│  │  │  │  (280px)    │  │  ┌───────────────────────┐ │  │   │ │
│  │  │  │             │  │  │ Dashboard (Stats+Charts)│ │  │   │ │
│  │  │  │ • Dashboard │  │  │ Pembukuan (Table)      │ │  │   │ │
│  │  │  │ • Pembukuan │  │  │ Hutang/Piutang         │ │  │   │ │
│  │  │  │ • Hutang    │  │  │ Track Harga (Chart)    │ │  │   │ │
│  │  │  │ • Stok      │  │  │ ...                    │ │  │   │ │
│  │  │  │ • Settings  │  │  └───────────────────────┘ │  │   │ │
│  │  │  │             │  │                            │  │   │ │
│  │  │  └─────────────┘  └────────────────────────────┘  │   │ │
│  │  │                                                     │   │ │
│  │  └────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │  TailwindCSS (Styling) │ Recharts (Charts)               │ │
│  │  Lucide Icons (Icons)  │ Zustand (State)                 │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                    │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Axios (API Client)                        │   │
│  │  + Auth interceptor                                    │   │
│  │  + Error handling                                      │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │    Backend API (FastAPI - Railway)   │
        │  http://api.mbg.example.com/api      │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │  Supabase Database + Auth            │
        │  PostgreSQL | JWT | Storage          │
        └──────────────────────────────────────┘
```

---

## COMPONENT HIERARCHY DIAGRAM

```
RootLayout (app/layout.tsx)
├── Global Styles (globals.css)
├── TailwindCSS Config
│
├── (auth)
│   ├── login/page.tsx
│   │   └── LoginForm
│   │       ├── Card
│   │       ├── Input × 2
│   │       └── Button
│   │
│   ├── register/page.tsx
│   │   └── RegisterForm
│   │
│   └── unauthorized/page.tsx
│
└── (dashboard)
    ├── layout.tsx (DashboardLayout)
    │   ├── Sidebar
    │   │   └── MENU_ITEMS array
    │   ├── TopBar
    │   │   ├── Notification bell
    │   │   └── User profile
    │   └── Main content area
    │
    ├── page.tsx (Dashboard Home)
    │   ├── StatCard × 4
    │   │   ├── Card
    │   │   └── Icon
    │   ├── CustomLineChart
    │   │   └── Recharts LineChart
    │   ├── CustomPieChart
    │   │   └── Recharts PieChart
    │   └── Recent transactions table
    │
    ├── pembukuan/
    │   ├── page.tsx (List)
    │   │   ├── Input (date filter)
    │   │   ├── Button (filter)
    │   │   └── Table
    │   │       └── Button (detail per row)
    │   │
    │   └── [id]/page.tsx (Detail)
    │       ├── Card sections
    │       └── Buttons (edit, delete, download)
    │
    ├── hutang-piutang/page.tsx
    │   ├── Card (Piutang summary)
    │   ├── Card (Hutang summary)
    │   ├── Section (Piutang list)
    │   │   └── Badge (status)
    │   └── Section (Hutang list)
    │       └── Badge (status)
    │
    ├── stok/page.tsx
    │   ├── Select (filter by kategori)
    │   └── Table (stok items)
    │       └── Badge (status)
    │
    ├── track-harga/page.tsx
    │   ├── Select (supplier filter)
    │   ├── CustomLineChart (price trend)
    │   │   └── Recharts LineChart
    │   └── Table (summary)
    │
    ├── laporan/
    │   ├── page.tsx (list laporan)
    │   ├── harian/page.tsx
    │   │   └── Table + chart
    │   ├── mingguan/page.tsx
    │   │   └── Summary card
    │   ├── bulanan/page.tsx
    │   │   └── Summary card
    │   └── audit/page.tsx
    │
    ├── ai-jadwal/page.tsx
    │   ├── Form (menu scheduler)
    │   └── Table (menu preview)
    │
    └── settings/page.tsx
        ├── Profil Perusahaan form
        ├── Kelola Sekolah page
        ├── Kelola Supplier page
        └── BOM page

Shared Components (components/)
├── layout/
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   └── DashboardLayout.tsx
│
├── ui/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Select.tsx
│   ├── Modal.tsx
│   ├── Pagination.tsx
│   ├── Alert.tsx
│   ├── Loading.tsx
│   └── Tabs.tsx
│
├── charts/
│   ├── LineChart.tsx
│   ├── PieChart.tsx
│   ├── BarChart.tsx
│   └── ChartContainer.tsx
│
├── dashboard/
│   ├── StatCard.tsx
│   ├── RecentTransactions.tsx
│   ├── AlertDeadlines.tsx
│   ├── MenuPreview.tsx
│   └── QuickActions.tsx
│
├── forms/
│   ├── FormPembukuan.tsx
│   ├── FormHutang.tsx
│   ├── FormSekolah.tsx
│   ├── FormSupplier.tsx
│   └── FormBOM.tsx
│
└── auth/
    ├── LoginForm.tsx
    ├── RegisterForm.tsx
    └── LogoutButton.tsx

Utilities (lib/)
├── store.ts (Zustand)
├── api.ts (Axios)
├── supabase.ts (Supabase client)
├── constants.ts (Colors, endpoints)
├── utils.ts (Helpers)
├── hooks.ts (Custom React hooks)
└── formatters.ts (Date, currency)
```

---

## DATA FLOW DIAGRAM

```
User (Browse Dashboard)
    ↓
Next.js Page Component
    ↓
├─→ Component renders
├─→ useEffect() → fetch data via Axios
├─→ API call to Backend
│   ↓
│   Backend API (FastAPI)
│   ↓
│   Database (Supabase)
│   ↓
│   Response JSON
    ↓
Axios Interceptor (check 401)
    ↓
State Management (Zustand or React Query)
    ↓
Component re-renders with data
    ↓
TailwindCSS styles applied
    ↓
Recharts renders data visualization
    ↓
User sees dashboard
```

---

## STATE MANAGEMENT DIAGRAM

```
Zustand Store (lib/store.ts)
│
├── UI State
│   ├── sidebarOpen: boolean
│   ├── theme: 'light' | 'dark'
│   └── currentPage: string
│
├── User State (later in Phase 5-6)
│   ├── user: User | null
│   ├── isAuthenticated: boolean
│   └── userRole: 'admin' | 'user'
│
└── Data State (later with React Query)
    ├── pembukuan: []
    ├── hutangPiutang: {}
    ├── stok: []
    └── isLoading: boolean
```

---

## FILE STRUCTURE TREE

```
web/
│
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── unauthorized/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx ⭐
│   │   ├── page.tsx (home) ⭐
│   │   │
│   │   ├── pembukuan/
│   │   │   ├── page.tsx ⭐
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── hutang-piutang/ ⭐
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   │
│   │   ├── stok/
│   │   │   ├── page.tsx
│   │   │   └── kategori/page.tsx
│   │   │
│   │   ├── track-harga/
│   │   │   └── page.tsx ⭐ (Chart!)
│   │   │
│   │   ├── laporan/
│   │   │   ├── page.tsx
│   │   │   ├── harian/page.tsx
│   │   │   ├── mingguan/page.tsx
│   │   │   ├── bulanan/page.tsx
│   │   │   └── audit/page.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   ├── sekolah/page.tsx
│   │   │   ├── supplier/page.tsx
│   │   │   ├── bom/page.tsx
│   │   │   └── profil-perusahaan/page.tsx
│   │   │
│   │   └── ai-jadwal/
│   │       └── page.tsx
│   │
│   ├── api/
│   │   ├── auth/callback/route.ts
│   │   ├── pembukuan/route.ts (optional)
│   │   ├── hutang-piutang/route.ts
│   │   ├── stok/route.ts
│   │   ├── laporan/route.ts
│   │   └── upload/route.ts
│   │
│   ├── layout.tsx (Root)
│   └── globals.css ⭐
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx ⭐
│   │   ├── TopBar.tsx ⭐
│   │   └── DashboardLayout.tsx
│   │
│   ├── ui/
│   │   ├── Button.tsx ⭐
│   │   ├── Card.tsx ⭐
│   │   ├── Input.tsx ⭐
│   │   ├── Badge.tsx ⭐
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Pagination.tsx
│   │   ├── Loading.tsx
│   │   ├── Alert.tsx
│   │   └── Tabs.tsx
│   │
│   ├── charts/
│   │   ├── LineChart.tsx ⭐
│   │   ├── PieChart.tsx ⭐
│   │   ├── BarChart.tsx
│   │   └── AreaChart.tsx
│   │
│   ├── dashboard/
│   │   ├── StatCard.tsx ⭐
│   │   ├── RecentTransactions.tsx
│   │   ├── AlertDeadlines.tsx
│   │   ├── MenuPreview.tsx
│   │   └── QuickActions.tsx
│   │
│   ├── forms/
│   │   ├── FormPembukuan.tsx
│   │   ├── FormHutang.tsx
│   │   ├── FormSekolah.tsx
│   │   ├── FormSupplier.tsx
│   │   └── FormBOM.tsx
│   │
│   └── auth/
│       ├── LoginForm.tsx ⭐
│       ├── RegisterForm.tsx
│       └── LogoutButton.tsx
│
├── lib/
│   ├── store.ts ⭐ (Zustand)
│   ├── api.ts ⭐ (Axios)
│   ├── supabase.ts (Supabase client)
│   ├── constants.ts ⭐ (Colors, endpoints)
│   ├── utils.ts (Helpers)
│   ├── hooks.ts ⭐ (Custom React hooks)
│   └── formatters.ts (Currency, date)
│
├── styles/
│   ├── globals.css ⭐
│   ├── colors.css (Custom palette)
│   └── animations.css
│
├── public/
│   └── assets/
│       ├── logo.svg
│       ├── illustrations/
│       └── icons/
│
├── .env.local (Secrets - gitignore)
├── .env.example (Template)
├── tailwind.config.ts ⭐
├── tsconfig.json ⭐
├── next.config.js
├── package.json ⭐
├── package-lock.json
└── vercel.json (Deployment config)

⭐ = Priority files (build first)
```

---

## RESPONSIVE BREAKPOINTS DIAGRAM

```
Mobile View (< 640px)
┌─────────────────┐
│ [≡] Title [🔔] │  <- TopBar
├─────────────────┤
│ Full width      │
│ content         │
│ no sidebar      │
│ shown           │
├─────────────────┤  <- Sidebar hidden, toggle button instead
│ ..content..     │


Tablet View (640px - 1024px)
┌─────────────────────────────────────┐
│ [≡] Title [🔔]                      │
├─────────────────────────────────────┤
│ Sidebar  │  Main content (2-3 cols) │
│ visible  │                          │
│ narrow   │                          │
│          │                          │


Desktop View (> 1024px)
┌─────────────────────────────────────────────┐
│ [≡] Title [🔔]                              │ TopBar
├──────────┬────────────────────────────────────┤
│ Sidebar  │ Main content (3-4 cols grid)      │
│ 280px    │                                    │
│          │ Charts: Full width responsive     │
│          │ Tables: Horizontal scroll         │
│          │ Modals: Centered                  │
└──────────┴────────────────────────────────────┘
```

---

## PHASE TIMELINE DIAGRAM

```
Week 1: FOUNDATION ✓
├─ Day 1-2: Setup + Tailwind
├─ Day 3: UI Components (Button, Card, Input, Badge)
├─ Day 4-5: Sidebar Navigation
└─ Day 6-7: TopBar + DashboardLayout

Week 2: COMPONENTS & PAGES
├─ Day 8-10: StatCard + Charts (LineChart, PieChart)
├─ Day 11-12: Dashboard home page
├─ Day 13-14: Pembukuan list + detail

Week 3: MORE PAGES
├─ Day 15-16: Hutang/Piutang page
├─ Day 17-18: Track Harga + Line chart
└─ Day 19-21: Stok + Laporan pages

Week 4: AUTH & INTEGRATION
├─ Day 22-23: Login/Register forms
├─ Day 24-25: Supabase Auth setup
├─ Day 26-27: Axios API client
└─ Day 28: Manual testing

Week 5: FINAL POLISH & DEPLOY
├─ Day 29: Edge cases + error handling
├─ Day 30-31: QA + bug fixes
├─ Day 32-33: Responsive check
├─ Day 34: Deploy to Vercel
└─ Day 35: Monitor + hotfixes

Timeline: 4-5 minggu | Effort: 160-200 jam | Team: 1-2 devs
```

---

## INTEGRATION POINTS DIAGRAM

```
Frontend (Next.js)
        ↕ (HTTP REST API)
Backend (FastAPI) ←──── Already exists
        ↕ (SQL)
Database (Supabase) ←─── Already exists

Frontend tasks:
1. Read API docs (MASTER_PLAN.md)
2. Create Axios client (Phase 6)
3. Integrate calls (Phase 6)
4. Handle errors + loading
5. Deploy to Vercel

Backend provides:
• /api/pembukuan
• /api/hutang-piutang
• /api/stok
• /api/laporan
• /api/track-harga
• /api/auth (login/logout)

Frontend doesn't need to:
✗ Touch database
✗ Modify backend logic
✗ Handle authentication (Supabase handles it)
✗ Manage file storage (Supabase handles it)
```

---

## COLOR PALETTE DIAGRAM

```
Primary Colors (Blue Theme)
┌───────────────────────────────────────┐
│ #1e40af ████ Dark Blue (Sidebar)     │
│ #3b82f6 ████ Light Blue (Buttons)    │
│ #60a5fa ████ Lighter Blue (Hover)    │
│ #dbeafe ████ Lightest Blue (BG)      │
└───────────────────────────────────────┘

Neutral Colors
┌───────────────────────────────────────┐
│ #ffffff ████ White (Cards)           │
│ #f9fafb ████ Light Gray (Page BG)    │
│ #f3f4f6 ████ Lighter Gray (Hover)    │
│ #6b7280 ████ Medium Gray (Text)      │
│ #111827 ████ Dark Gray (Headlines)   │
└───────────────────────────────────────┘

Status Colors
┌───────────────────────────────────────┐
│ #10b981 ████ Green (Success)         │
│ #f59e0b ████ Yellow (Warning)        │
│ #ef4444 ████ Red (Error)             │
| #8b5cf6 ████ Purple (Info)           │
└───────────────────────────────────────┘
```

---

**Version**: 1.0 | **Date**: April 2026
