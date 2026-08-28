# 🚀 QUICK START GUIDE — Frontend MBG

Panduan step-by-step untuk mulai development frontend. 

---

## ⚡ 5 Menit Setup

### 1. Install Dependencies
```bash
cd web
npm install
npm install -D tailwindcss postcss autoprefixer
npm install react-query zustand date-fns clsx lucide-react recharts
```

### 2. Copy Environment Template
```bash
cp .env.local.template .env.local
# Edit .env.local dengan URL Supabase & API
```

### 3. Setup Tailwind Config
```bash
npx tailwindcss init -p
# Update tailwind.config.ts dengan konfigurasi dari plan
```

### 4. Start Development
```bash
npm run dev
# Buka http://localhost:3000
```

---

## 📁 Folder Structure — Copy Paste Ready

```bash
# Jalankan commands ini satu per satu

# Layout folders
mkdir -p components/layout
mkdir -p components/ui
mkdir -p components/charts
mkdir -p components/dashboard
mkdir -p components/forms
mkdir -p components/auth

# App folders
mkdir -p app/\(auth\)/login
mkdir -p app/\(auth\)/register
mkdir -p app/\(dashboard\)/pembukuan/\[id\]
mkdir -p app/\(dashboard\)/hutang-piutang/\[id\]
mkdir -p app/\(dashboard\)/stok/kategori
mkdir -p app/\(dashboard\)/laporan/{harian,mingguan,bulanan,audit}
mkdir -p app/\(dashboard\)/ai-jadwal
mkdir -p app/\(dashboard\)/track-harga
mkdir -p app/\(dashboard\)/settings/{sekolah,supplier,bom,profil-perusahaan}
mkdir -p app/api/auth/callback

# Lib folders
mkdir -p lib
mkdir -p styles
mkdir -p public/assets/{illustrations,icons}

# API integration (optional)
mkdir -p app/api/{auth,pembukuan,hutang-piutang,stok,laporan,upload}
```

---

## 📋 Development Roadmap (Ready to Implement)

### Week 1: Foundation
- [ ] Setup Tailwind + TailwindCSS config
- [ ] Create all UI base components (Button, Card, Input, Badge, etc)
- [ ] Create Sidebar navigation
- [ ] Create TopBar component
- [ ] Setup Zustand store untuk sidebar state

### Week 2: Dashboard & Main Pages
- [ ] Dashboard home dengan stats cards
- [ ] Dashboard dengan line chart (trend pengeluaran)
- [ ] Dashboard dengan pie chart (kategori pengeluaran)
- [ ] Pembukuan list page
- [ ] Hutang/Piutang page

### Week 3: Advanced Pages
- [ ] Track Harga page dengan line chart comparison
- [ ] Stok Gudang page
- [ ] Laporan pages (harian, mingguan, bulanan)
- [ ] Settings pages

### Week 4: Auth & Integration
- [ ] Login page + form
- [ ] Supabase auth setup
- [ ] Axios API client dengan interceptors
- [ ] React Query setup untuk data fetching
- [ ] Implement API calls di setiap page

### Week 5: Polish & Deploy
- [ ] Error handling & loading states
- [ ] Dark mode support (optional)
- [ ] Responsive design check
- [ ] QA & bug fixes
- [ ] Deploy ke Vercel

---

## 🎨 Color Quick Reference

```css
/* Gunakan di Tailwind classes */

Primary Blue:     bg-blue-900 (sidebar)
Light Blue:       bg-blue-600 (buttons)  
Link Blue:        text-blue-600
Success:          bg-green-100 text-green-800
Error:            bg-red-100 text-red-800
Warning:          bg-yellow-100 text-yellow-800

/* Custom classes (di globals.css) */
.btn-primary      /* Blue button */
.btn-secondary    /* Gray button */
.card             /* White card dengan border */
.chart-container  /* Chart wrapper */
```

---

## 🔧 Essential Commands

```bash
# Development
npm run dev              # Start dev server

# Building
npm run build           # Build for production
npm run lint            # Check linting

# Database (via Supabase CLI - optional)
supabase db pull        # Pull schema dari cloud
supabase db push        # Push schema ke cloud

# Check build
npm run build && npm run start
```

---

## 📞 API Endpoints Reference

Library bantuan endpoint yang akan kita integrate:

```typescript
// Backend endpoints reference
GET    /api/pembukuan                    # List pengeluaran
POST   /api/pembukuan                    # Create pengeluaran
GET    /api/pembukuan/{id}               # Get detail
PUT    /api/pembukuan/{id}               # Update
DELETE /api/pembukuan/{id}               # Delete

GET    /api/hutang-piutang               # List all
GET    /api/hutang-piutang/piutang       # Customer invoices
GET    /api/hutang-piutang/hutang        # Supplier invoices

GET    /api/stok                         # All inventory
GET    /api/stok/by-category             # By kategori

GET    /api/laporan/harian               # Daily report
GET    /api/laporan/mingguan             # Weekly report
GET    /api/laporan/bulanan              # Monthly report

GET    /api/track-harga                  # Price history
GET    /api/track-harga/by-supplier      # By supplier comparison
```

---

## 🎬 Component Implementation Order

**Priority 1** (Must have):
```
1. UI Components: Button, Card, Input, Badge
2. Sidebar navigation
3. Dashboard home
4. Charts (PieChart, LineChart, BarChart)
```

**Priority 2** (Important):
```
5. Pembukuan list
6. Hutang/Piutang page
7. Track Harga dengan chart
8. Auth (Login/Logout)
```

**Priority 3** (Nice to have):
```
9. Stok page
10. Laporan pages
11. Settings pages
12. Mobile responsive polish
```

---

## 🐛 Troubleshooting

### Tailwind not working?
```bash
# Clear cache
rm -rf .next
npm run dev
```

### Chart tidak render?
```bash
# Ensure Recharts installed
npm install recharts

# Check ResponsiveContainer parent has width
<div style={{ width: '100%' }}>
  <ResponsiveContainer width="100%" height={300}>
```

### Auth token not sent?
```typescript
// Check axios interceptor in lib/api.ts
// Pastikan Authorization header di-set
// Di backend, check CORS headers
```

---

## 📚 Useful Documentation Links

- [Next.js 14 Docs](https://nextjs.org/docs)
- [TailwindCSS](https://tailwindcss.com/docs)
- [Recharts](https://recharts.org/)
- [Lucide Icons](https://lucide.dev/)
- [Supabase JS](https://supabase.com/docs/reference/javascript)
- [React Query](https://tanstack.com/query/latest)
- [Zustand](https://github.com/pmndrs/zustand)

---

## 🎯 Success Checklist

Target untuk setiap sprint:

**Sprint 1 (Design System)**
- [ ] All UI components created & tested
- [ ] Tailwind config finalized
- [ ] Sidebar working dengan navigation
- [ ] Color scheme implemented

**Sprint 2 (Core Pages)**
- [ ] Dashboard home complete
- [ ] Data fetching working
- [ ] Charts displaying correctly
- [ ] Responsive on mobile

**Sprint 3 (Auth & Integration)**
- [ ] Login/logout working
- [ ] API calls integrated
- [ ] Error handling implemented
- [ ] Loading states working

**Sprint 4 (Deploy)**
- [ ] All features tested
- [ ] No console errors
- [ ] Deployed to Vercel
- [ ] Environment variables set

---

## 💡 Pro Tips

1. **Use TypeScript types**: Define interfaces untuk setiap API response
2. **Customizable components**: Prima Button, Card, Input dengan variant props
3. **Lazy load images**: Gunakan Next.js Image component
4. **Mobile first**: Design untuk mobile dulu, baru scale up
5. **Error boundaries**: Wrap pages dengan error handling
6. **Loading skeleton**: Buat skeleton UI sebelum data loaded

---

Version: 1.0 | Date: April 2026
