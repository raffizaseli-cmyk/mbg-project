# UI Kit — Design System & Component Reference

Dokumentasi lengkap design tokens, component classes, dan best practices untuk menjaga konsistensi visual serta performa aplikasi.

**File-file terkait:**
- `app/globals.css` — Design tokens dan component layer definitions
- `tailwind.config.js` — Tailwind configuration dengan token-token
- `components/ui/*.tsx` — Atomic component implementations

---

## Design Tokens (CSS Variables)

### Warna / Color Palette

**Semantic Colors (utama):**
```css
--primary:          221.2 83.2% 53.3%   /* Blue-600 untuk CTA, links */
--success:          132 54.5% 52.4%     /* Green untuk success status */
--warning:          38 92.1% 50.2%      /* Amber untuk alert/warning */
--error:            0 84.2% 60.2%       /* Red untuk error/danger */
--info:             217.2 91.2% 59.8%   /* Blue untuk informasi */
```

**Neutral Scale (grayscale):**
- `--gray-50` hingga `--gray-800`: Skala abu-abu lengkap untuk teks, background, border

**Cara pakai di Tailwind:**
```jsx
<button className="bg-primary text-white">Primary Button</button>
<div className="border border-gray-200">Card dengan border</div>
```

---

### Spacing Scale

```css
--sp-xs    0.25rem    (4px)
--sp-sm    0.5rem     (8px)
--sp-md    1rem       (16px) — DEFAULT
--sp-lg    1.5rem     (24px)
--sp-xl    2rem       (32px)
--sp-2xl   3rem       (48px)
```

**Gunakan di Tailwind:**
```jsx
<div className="p-sp-lg gap-sp-md">
  Padding & gap menggunakan token
</div>
```

---

### Border Radius

```css
--radius-xs   0.25rem  (4px)
--radius-sm   0.375rem (6px)
--radius-md   0.5rem   (8px) — Untuk input, badge
--radius-lg   0.75rem  (12px) — Untuk button, card
--radius-xl   1rem     (16px)
--radius-2xl  1.5rem   (24px) — Untuk large card, hero section
```

---

### Shadow Tokens

```css
--shadow-xs   0 1px 2px rgba(0,0,0,0.05)
--shadow-sm   0 1px 3px ... /* Untuk card minimal */
--shadow-md   0 4px 6px ... /* Default card shadow */
--shadow-lg   0 10px 15px ... /* Hover/elevation */
--shadow-xl   0 20px 25px ... /* Modal, dropdown */
```

**Tailwind class:**
```jsx
<div className="shadow-md hover:shadow-lg transition-all">
  Card dengan shadow dinamis
</div>
```

---

### Typography

```css
--font-sans  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto...
--font-mono  'Monaco', 'Courier New', monospace
```

**Skala heading otomatis via `@layer base`:**
- `h1, h2, h3, h4, h5, h6` sudah styled
- Gunakan `<h1>Title</h1>` langsung atau `className="text-3xl font-bold"`

---

## Component Classes

### Button Variants

#### Primary Button
```jsx
<button className="btn-primary">Simpan Data</button>
```
**CSS:** `btn-primary` = bg-blue-600 + text-white + hover effect + focus ring

#### Secondary Button
```jsx
<button className="btn-secondary">Batal</button>
```
**CSS:** Border + gray background, ideal untuk non-primary action

#### Danger Button
```jsx
<button className="btn-danger">Hapus</button>
```
**CSS:** Red background, untuk action destruktif

#### Ghost Button (Minimal)
```jsx
<button className="btn-ghost">Lebih Lanjut →</button>
```
**CSS:** Transparent bg, hover effect only

#### Size Variants
```jsx
<button className="btn-sm btn-primary">Small</button>
<button className="btn btn-primary">Medium (default)</button>
<button className="btn-lg btn-primary">Large</button>
```

---

### Card Components

#### Basic Card
```jsx
<div className="card">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</div>
```
**CSS:** White bg, border, rounded, shadow-sm, padding

#### Hoverable Card
```jsx
<div className="card-hover">
  Content
</div>
```
**CSS:** Adds hover:shadow-md and -translate-y-0.5

#### Glass Effect Card
```jsx
<div className="card-glass">
  Glassmorphism effect
</div>
```
**CSS:** Frosted glass dengan backdrop-blur

#### Elevated Card (Hero/Important Section)
```jsx
<div className="card-elevated">
  Important content
</div>
```
**CSS:** Larger shadow untuk depth

---

### Badge / Tag Components

```jsx
<span className="badge-primary">Primary</span>
<span className="badge-success">Success</span>
<span className="badge-warning">Warning</span>
<span className="badge-danger">Danger</span>
<span className="badge-gray">Neutral</span>
```

---

### Form Elements

#### Input Field
```jsx
<label className="label">Email</label>
<input type="email" className="input" placeholder="nama@contoh.com" />
```
**CSS:** Full-width, border, focus-ring, rounded-lg

#### Input Error State
```jsx
<input className="input input-error" />
```
**CSS:** Red border + red focus ring

#### Select Dropdown
```jsx
<select className="select">
  <option>Pilihan 1</option>
</select>
```

#### Textarea
```jsx
<textarea className="textarea" placeholder="Ketik pesan..."></textarea>
```

---

### Status Indicators

#### Status Dot
```jsx
<span className="status-active">Active status</span>
<span className="status-pending">Pending</span>
<span className="status-inactive">Inactive</span>
```

---

### Utility Classes

#### Layout Utilities
```jsx
<div className="flex-center">Centered flex</div>
<div className="flex-between">Space-between</div>
<div className="flex-col-center">Vertical center</div>
```

#### Container Utilities
```jsx
<div className="container-sm">Max 640px + padding</div>
<div className="container-md">Max 896px</div>
<div className="container-lg">Max 1280px</div>
```

#### Divider
```jsx
<hr className="divider" />
<hr className="divider-lg" />
```

#### Text Utilities
```jsx
<p className="text-muted">Muted gray text</p>
<p className="text-hint">Very small hint text</p>
```

---

## Animation & Transition

### Built-in Animations
```jsx
<div className="animate-in">Fade in on mount</div>
<div className="animate-slide-in">Slide in from left</div>
<div className="animate-slide-down">Slide down from top</div>
<div className="animate-pulse-soft">Soft pulsing effect</div>
```

### Stagger Animation (Multiple Elements)
```jsx
{items.map((item, i) => (
  <div key={i} className={`animate-in stagger-${i % 5}`}>
    {item}
  </div>
))}
```
**CSS:** `stagger-1` s/d `stagger-5` = delay 50ms-250ms

### Transition Utilities
```jsx
<button className="transition-all duration-fast hover:shadow-lg">
  Fast transition (150ms)
</button>
```

---

## Best Practices

### 1. Konsistensi Warna & Spacing
- Gunakan design tokens (`var(--sp-md)`, `bg-primary`, dll)
- Jangan hardcode warna atau spacing inline
- Pakai Tailwind class untuk nilai token

### 2. Responsive Design
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  Responsive grid
</div>
```

### 3. Accessibility
- `focus-visible:ring-2` untuk keyboard navigation
- Contrast minimal 4.5:1 untuk text
- `aria-label` untuk icon-only buttons

### 4. Performance
- **Jangan:** Import komponen besar di top-level
- **Gunakan:** Dynamic import untuk modal, chart, heavy components
```jsx
const Modal = dynamic(() => import('@/components/Modal'), { ssr: false });
```

### 5. Dark Mode (Future Ready)
Design tokens siap untuk dark mode dengan CSS custom properties

---

## Component Usage Examples

### Card dengan Button
```jsx
<div className="card">
  <h3 className="text-lg font-semibold mb-4">Konfirmasi Aksi</h3>
  <p className="text-muted mb-6">Apakah Anda yakin?</p>
  <div className="flex gap-3 justify-end">
    <button className="btn-secondary">Batal</button>
    <button className="btn-primary">Lanjutkan</button>
  </div>
</div>
```

### Form dengan Error State
```jsx
<form className="space-y-4">
  <div>
    <label className="label">Nama Lengkap</label>
    <input className="input" />
  </div>
  <div>
    <label className="label">Email</label>
    <input className="input input-error" />
    <p className="text-sm text-error mt-1">Email tidak valid</p>
  </div>
  <button className="btn-primary w-full">Daftar</button>
</form>
```

### Status List
```jsx
<div className="space-y-2">
  {items.map(item => (
    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="font-medium">{item.name}</p>
        <p className="text-muted text-sm">{item.desc}</p>
      </div>
      <span className={`badge-${item.status}`}>
        {item.status}
      </span>
    </div>
  ))}
</div>
```

---

## Migration Guide (dari style lama)

### Sebelum:
```jsx
<button style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 16px' }}>
  Click
</button>
```

### Sesudah:
```jsx
<button className="btn-primary">Click</button>
```

**Keuntungan:**
- Konsisten di seluruh app
- Mudah di-maintain
- Performa lebih baik (inline style vs class-based)

---

## File Struktur

```
web/
├── app/
│   ├── globals.css          ← Design tokens + component layer
│   ├── layout.tsx
│   └── ...pages
├── components/
│   ├── ui/
│   │   ├── button.tsx       ← Reusable component
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   └── layout/
│       ├── header.tsx
│       └── sidebar.tsx
├── tailwind.config.js       ← Tailwind + token config
└── UI_KIT.md                ← Documentation (file ini)
```

---

## Next Steps

1. **Refactor halaman:** Ganti inline style → component class
2. **Create component library:** Ekspor Button, Card, Badge dari `components/ui/`
3. **Dark mode:** Extend tokens dengan dark mode colors
4. **Animation polish:** Tambahkan more microinteraction

---

**Last Updated:** 2026-06-19
**Maintained by:** Frontend Team
