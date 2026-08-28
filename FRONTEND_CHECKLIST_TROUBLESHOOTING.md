# ✅ IMPLEMENTATION CHECKLIST & TROUBLESHOOTING

Checklist lengkap dan tips untuk menyelesaikan setiap phase development.

---

## PHASE 1: SETUP & FOUNDATION ✓

### Environment Setup
- [ ] Node.js 18+ installed
- [ ] `npm install` completed
- [ ] All dependencies installed:
  ```
  ✓ next@14
  ✓ react@18.2
  ✓ tailwindcss@3
  ✓ recharts@2
  ✓ lucide-react
  ✓ zustand
  ✓ axios
  ```

### Project Structure
- [ ] Folder structure created (dari QUICK_START.md)
- [ ] `/lib` folder dibuat dengan file:
  - [ ] `store.ts` (Zustand store)
  - [ ] `api.ts` (Axios instance)
  - [ ] `constants.ts` (Colors, endpoints)
  - [ ] `utils.ts` (Helpers)
  - [ ] `hooks.ts` (Custom React hooks)

### Tailwind Configuration
- [ ] `tailwind.config.ts` updated dengan custom colors
- [ ] `/styles/globals.css` created dengan `@tailwind directives`
- [ ] `postcss.config.ts` generated
- [ ] Tailwind working (test: `npm run dev`, check styles)

### TypeScript
- [ ] `tsconfig.json` configured untuk Next.js 14
- [ ] No TypeScript errors on `npm run build`

---

## PHASE 2: DESIGN SYSTEM ✓

### UI Components (Create all these files)

#### Basic Components
- [ ] `components/ui/Button.tsx`
  - [ ] variant: primary, secondary, ghost, danger
  - [ ] size: sm, md, lg
  - [ ] isLoading state
  
- [ ] `components/ui/Card.tsx`
  - [ ] variant: default, elevated, outlined
  - [ ] Proper spacing & border
  
- [ ] `components/ui/Input.tsx`
  - [ ] label prop
  - [ ] error prop with message
  - [ ] Focus states
  
- [ ] `components/ui/Badge.tsx`
  - [ ] variant: success, warning, error, info
  - [ ] Compact size
  
- [ ] `components/ui/Select.tsx`
  - [ ] Dropdown functionality
  - [ ] Label & value
  
- [ ] `components/ui/Modal.tsx` (Optional - for later)
  - [ ] Open/close functionality
  - [ ] Backdrop click to close
  
- [ ] `components/ui/Pagination.tsx` (Optional)
  - [ ] Previous/Next buttons
  - [ ] Page numbers

#### Typography Components
- [ ] Create type utilities in `globals.css`:
  ```css
  .text-h1 { @apply text-3xl font-bold text-gray-900; }
  .text-h2 { @apply text-2xl font-bold text-gray-900; }
  .text-base { @apply text-base text-gray-700; }
  .text-sm { @apply text-sm text-gray-600; }
  ```

### Chart Components
- [ ] `components/charts/LineChart.tsx`
  - [ ] Test with mock data
  - [ ] Responsive height
  
- [ ] `components/charts/PieChart.tsx`
  - [ ] Custom colors array
  - [ ] Labels visible
  
- [ ] `components/charts/BarChart.tsx`
  - [ ] Multiple bars support
  - [ ] Tooltip working

### Colors & Theme
- [ ] Custom color palette in `tailwind.config.ts`
- [ ] `lib/constants.ts` dengan COLORS object
- [ ] Test colors di Button, Card components

### Testing
- [ ] `npm run dev` dan buka http://localhost:3000
- [ ] Buat test page dengan semua UI components
- [ ] Pastikan tidak ada console errors
- [ ] Responsive di mobile (Ctrl+Shift+M di browser)

---

## PHASE 3: LAYOUT & NAVIGATION ✓

### Sidebar
- [ ] `components/layout/Sidebar.tsx` dibuat
  - [ ] Menu items hardcoded dengan MENU_ITEMS array
  - [ ] Active link highlighting
  - [ ] Submenu expand/collapse (Laporan)
  - [ ] Mobile toggle button
  - [ ] Zustand store integration
  
- [ ] `lib/store.ts` dengan useStore
  - [ ] `sidebarOpen` state
  - [ ] `toggleSidebar()` function
  
- [ ] Test Sidebar:
  - [ ] Click menu items → highlight
  - [ ] Mobile: menu toggle works
  - [ ] Submenu: expand/collapse
  - [ ] Colors: blue-900 gradient

### TopBar
- [ ] `components/layout/TopBar.tsx` dibuat
  - [ ] Notification icon with badge
  - [ ] User profile icon
  - [ ] Page title
  - [ ] Sticky positioning

### Dashboard Layout
- [ ] `app/(dashboard)/layout.tsx` updated
  - [ ] Sidebar + main area side by side
  - [ ] Proper margin/padding
  - [ ] Responsive: sidebar full-width on mobile
  
- [ ] `app/layout.tsx` (Root layout)
  - [ ] Import global styles
  - [ ] Metadata set
  - [ ] Font configured

### Layout Testing
- [ ] Desktop: Sidebar 280px, content beside
- [ ] Tablet: Layak terlihat baik
- [ ] Mobile: Sidebar collapsible, full width content
- [ ] No layout shift saat toggle sidebar

---

## PHASE 4A: DASHBOARD HOME PAGE

### StatCard Components
- [ ] `components/dashboard/StatCard.tsx` created
  - [ ] Title, value, icon, change
  - [ ] Color dari Lucide icon
  - [ ] Green for down (↓), Red for up (↑)

### Charts Implementation
- [ ] Mock data untuk line chart (7 days)
- [ ] Mock data untuk pie chart (4 categories)
- [ ] Charts rendering tanpa error

### Page Implementation
- [ ] `app/(dashboard)/page.tsx` created
  - [ ] 4x StatCards grid
  - [ ] 2x Charts (LineChart, PieChart)
  - [ ] Recent transactions table
  - [ ] Responsive grid (sm:2 cols, lg:4 cols)

### Dashboard Testing
- [ ] Stats cards tampil dengan data
- [ ] Charts render dan interaktif
- [ ] Responsive pada semua breakpoint
- [ ] No TypeScript errors

---

## PHASE 4B: PEMBUKUAN PAGE

### Form Input
- [ ] `components/forms/FormPembukuan.tsx` (or manual form in page)
  - [ ] Date input
  - [ ] Supplier select
  - [ ] Items textarea
  - [ ] Amount input
  - [ ] Submit button

### List Page
- [ ] `app/(dashboard)/pembukuan/page.tsx`
  - [ ] Filter by date
  - [ ] Table dengan 5 columns
  - [ ] "Add" button atas kanan
  - [ ] Pagination atau "Load more"

### Detail Page
- [ ] `app/(dashboard)/pembukuan/[id]/page.tsx`
  - [ ] Display semua detail
  - [ ] Edit/Delete buttons
  - [ ] Download option
  - [ ] Back button

### Testing
- [ ] Table render dengan mock data 5+ rows
- [ ] Filter button functional (click only, logic later)
- [ ] Detail page bisa di-akses dari table
- [ ] Responsive table (horizontal scroll on mobile)

---

## PHASE 4C: HUTANG/PIUTANG PAGE

### Components
- [ ] Icon/Badge untuk status (Overdue, Pending, Paid)
- [ ] Color coding: Red (overdue), Yellow (pending), Green (paid)

### Summary Cards
- [ ] 2x summary cards (Piutang total, Hutang total)
- [ ] With icons dari Lucide

### Lists
- [ ] Piutang section dengan list items
- [ ] Hutang section dengan list items
- [ ] Collapsible details per item (optional)

### Page Implementation
- [ ] `app/(dashboard)/hutang-piutang/page.tsx`
  - [ ] Header dengan breadcrumb
  - [ ] 2x summary cards
  - [ ] 2x section dengan lists
  - [ ] Click item untuk detail (optional)

### Testing
- [ ] All items render dengan status badges
- [ ] Colors sesuai spec
- [ ] Berisi minimal 3 items per section
- [ ] Responsive

---

## PHASE 4D: TRACK HARGA PAGE

### Chart Implementation
- [ ] Mock data: 4 data points untuk 3 suppliers
- [ ] LineChart dengan 3 lines (PT Jaya, CV Makmur, PT Global)

### Filter/Select
- [ ] `components/ui/Select.tsx` atau custom dropdown
- [ ] Options: Semua, PT Jaya, CV Makmur, PT Global

### Summary Table
- [ ] 3 columns: Supplier, Harga Terakhir, Change %
- [ ] Color: Green untuk down (hemat), Red untuk up (mahal)

### Page Implementation
- [ ] `app/(dashboard)/track-harga/page.tsx`
  - [ ] Header
  - [ ] Select filter (top)
  - [ ] LineChart (full width)
  - [ ] Summary table (bottom)

### Testing
- [ ] Chart menampilkan 3 lines dengan warna berbeda
- [ ] Tooltip muncul saat hover
- [ ] Table readable dengan data format correct
- [ ] Filter select render (logic akan ditambah nanti)

---

## PHASE 5: AUTHENTICATION (Placeholder for now)

### Login Page
- [ ] `app/(auth)/login/page.tsx` created
  - [ ] LoginForm component
  - [ ] Email & password inputs
  - [ ] Submit button
  - [ ] Error message display
  - [ ] Register link

### LoginForm Component
- [ ] `components/auth/LoginForm.tsx`
  - [ ] Form validation (basic)
  - [ ] Loading state pada button
  - [ ] Error handling display

### Middleware (Optional for now)
- [ ] `middleware.ts` untuk redirect unauthorized users
  - [ ] Bisa ditambah Phase 5 nanti

### Testing
- [ ] Login page accessible di /login
- [ ] Form render dengan 2 inputs + button
- [ ] Button click trigger console log (API call nanti)
- [ ] Responsive

---

## PHASE 5: API INTEGRATION (Placeholder)

### Axios Setup
- [ ] `lib/api.ts` dengan axios instance
  - [ ] baseURL ke backend
  - [ ] Auth interceptor (for later)
  - [ ] Error interceptor (401 handling)

### React Query (Optional but recommended)
- [ ] Install: `npm install react-query`
- [ ] `QueryClientProvider` wrap di RootLayout (optional)

### Hooks for Data Fetching
- [ ] `lib/hooks.ts` dengan example hooks:
  - [ ] `usePembukuan()`
  - [ ] `useHutangPiutang()`
  - [ ] `usPriceTracking()`

### Testing
- [ ] API calls bisa dilihat di Network tab browser
- [ ] No 401/403 errors
- [ ] Mock data tetap replace dengan API nanti

---

## QUALITY ASSURANCE CHECKLIST

### Code Quality
- [ ] No console errors di browser (Ctrl+Shift+K)
- [ ] No TypeScript errors: `npm run build`
- [ ] Prettier format: `npm run lint` (if configured)
- [ ] No unused imports/variables

### Browser Testing
- [ ] Chrome (latest): ✓
- [ ] Firefox: ✓
- [ ] Safari: ✓
- [ ] Mobile (iOS/Android simulation): ✓

### Responsive Testing
- [ ] Mobile 375px: ✓
- [ ] Tablet 768px: ✓
- [ ] Desktop 1920px: ✓
- [ ] No horizontal scroll (except data tables)

### Accessibility (Basic)
- [ ] All buttons have aria labels or text
- [ ] Form inputs have labels
- [ ] Color contrast sufficient (blue on white OK)
- [ ] Tab navigation works

### Performance
- [ ] Page load < 3 seconds
- [ ] No layout shift saat load
- [ ] Images optimized (use Next.js Image if applicable)
- [ ] Charts render smoothly

### Features Testing
- [ ] All links navigate correctly
- [ ] Buttons clickable dengan feedback
- [ ] Forms submittable (even if logic pending)
- [ ] Tables sortable (if added)

---

## 🐛 TROUBLESHOOTING GUIDE

### Problem: Tailwind styles not applying

**Solution:**
```bash
# 1. Check globals.css has @tailwind
cat app/globals.css | grep @tailwind

# 2. Clear cache
rm -rf .next

# 3. Restart dev server
npm run dev

# 4. Check tailwind.config.ts content paths
cat tailwind.config.ts | grep content
```

### Problem: Sidebar not sticky/overlapping content

**Solution:**
```css
/* In DashboardLayout or globals.css */
aside {
  position: fixed;
  /* or */
  position: sticky;
}

main {
  margin-left: 280px; /* on desktop */
  @apply lg:ml-64; /* Tailwind version */
}
```

### Problem: Chart not rendering (blank space)

**Solution:**
```typescript
// Ensure parent has width defined
<div style={{ width: '100%' }}>
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      ...
    </LineChart>
  </ResponsiveContainer>
</div>

// Check data is array of objects
const data = [
  { date: 'Mar 20', value: 1000 },  // ✓
  // NOT: 'Mar 20': 1000 (object key format ✗)
]
```

### Problem: Icons not showing from lucide-react

**Solution:**
```bash
# Reinstall
npm uninstall lucide-react
npm install lucide-react

# Import correctly
import { BarChart3, User } from 'lucide-react';
// Use like: <BarChart3 className="h-5 w-5" />
```

### Problem: Next.js import errors

**Solution:**
```bash
# Check imports
import Link from 'next/link'; ✓
import { usePathname } from 'next/navigation'; ✓ (not next/router)
import { useRouter } from 'next/navigation'; ✓

# App Router (recommended for Next.js 14):
'use client'; // at top for client components
```

### Problem: Zustand store not updating UI

**Solution:**
```typescript
// ✓ Correct
export const useStore = create<Store>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ 
    sidebarOpen: !state.sidebarOpen 
  })),
}));

// In component:
const { sidebarOpen, toggleSidebar } = useStore();

// ✓ Must be marked 'use client'
'use client';
```

### Problem: Responsive not working

**Solution:**
```css
/* Tailwind responsive classes */
@apply sm:w-1/2 md:w-2/3 lg:w-3/4;

/* In tailwind.config.ts */
theme: {
  screens: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  }
}

/* Test in browser */
/* Resize window atau use Chrome DevTools device simulation */
```

### Problem: API calls 401 Unauthorized

**Solution (for later phase):**
```typescript
// Ensure token passed in header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // or from Supabase
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Problem: Form inputs not styled properly

**Solution:**
```bash
# Ensure @tailwindcss/forms installed
npm install -D @tailwindcss/forms

# In tailwind.config.ts
plugins: [require('@tailwindcss/forms')]

# Then restart dev server
npm run dev
```

### Problem: Mobile menu not closing after nav

**Solution:**
```typescript
// In Sidebar component, add onClick to Link
<Link 
  href={item.href}
  onClick={() => toggleSidebar()} // Add this
>
  {item.label}
</Link>
```

---

## 📊 PROGRESS TRACKING TEMPLATE

Use ini untuk track progress:

```markdown
## Week 1 Progress
- [x] Setup & dependencies
- [x] Tailwind configured
- [x] Folder structure created
- [x] UI components (Button, Card, Input, Badge)
- [x] Sidebar navigation
- [ ] Dashboard home
- [ ] Pembukuan page
**Status: 70% Complete**

## Week 2 Progress
- [ ] Dashboard complete
- [ ] Pembukuan complete
- [ ] Hutang/Piutang complete
- [ ] Track Harga with chart
- [ ] Stok pages
**Status: ---% Complete**
```

---

## 🎯 TIPS FOR SUCCESS

1. **Test as you build**: Jangan tunggu next phase, test setiap component
2. **Use mock data**: Jangan tunggu backend, mock data dulu
3. **Responsive first**: Cek mobile view setiap hari
4. **Component reusability**: Jika pattern terulang 2x, buat component
5. **Version control**: Commit setelah setiap page selesai
6. **Document changes**: Update NOTES.md saat ada blocker
7. **Ask for help early**: Jangan stuck, escalate sooner

---

**Last Updated: April 2026**  
**Version: 1.0**
