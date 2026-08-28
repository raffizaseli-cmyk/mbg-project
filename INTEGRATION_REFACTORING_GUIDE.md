# Integration Guide — Refactoring Pages to Use New Design System

**Purpose:** Step-by-step instructions for developers to migrate existing pages to use the new design system components and classes.

**Target Pages:** Dashboard, Pembukuan, Settings, Dapur, etc.

---

## 📝 Before You Start

### Prerequisites
- Read `UI_KIT.md` — understand available components and classes
- Understand `globals.css` structure and design tokens
- Familiar with TypeScript and React

### Files You'll Need
- Source: `web/components/ui/` — reusable components
- Reference: `web/UI_KIT.md` — component examples
- Tokens: `web/app/globals.css` — design variables

---

## 🔄 Migration Pattern

### Step 1: Replace Hardcoded Inline Styles with Component Classes

#### Before (Inline Styles)
```jsx
<button
  style={{
    backgroundColor: '#2563eb',
    color: 'white',
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer'
  }}
>
  Save
</button>
```

#### After (Component Class)
```jsx
<button className="btn-primary">Save</button>
```

#### Before (Inline Card)
```jsx
<div
  style={{
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  }}
>
  Content
</div>
```

#### After (Component)
```jsx
import { Card } from '@/components/ui/card';

<Card>
  Content
</Card>
```

---

## 🎨 Component Replacement Guide

### Button Replacement

#### Scenario 1: Primary Action
```jsx
// BEFORE
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
  Simpan
</button>

// AFTER
<Button variant="primary">Simpan</Button>
```

#### Scenario 2: Secondary Action
```jsx
// BEFORE
<button className="bg-gray-100 text-gray-900 border border-gray-200 px-4 py-2">
  Batal
</button>

// AFTER
<Button variant="secondary">Batal</Button>
```

#### Scenario 3: Danger/Delete Action
```jsx
// BEFORE
<button className="bg-red-600 text-white px-4 py-2">
  Hapus
</button>

// AFTER
<Button variant="danger">Hapus</Button>
```

#### Scenario 4: Loading State
```jsx
// BEFORE
<button disabled className="opacity-50">
  <span className="animate-spin mr-2">⟳</span>
  Processing...
</button>

// AFTER
<Button isLoading loadingText="Processing...">
  Simpan
</Button>
```

**Import:**
```jsx
import { Button } from '@/components/ui/button';
```

---

### Card Replacement

#### Scenario 1: Simple Card
```jsx
// BEFORE
<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
  <h3>Title</h3>
  <p>Content</p>
</div>

// AFTER
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

#### Scenario 2: Card with Footer
```jsx
// AFTER
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Confirm Action</CardTitle>
  </CardHeader>
  <CardContent>Are you sure?</CardContent>
  <CardFooter>
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Confirm</Button>
  </CardFooter>
</Card>
```

#### Scenario 3: Elevated Card
```jsx
// BEFORE
<div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
  Content
</div>

// AFTER
<Card variant="elevated">
  Content
</Card>
```

#### Scenario 4: Glass Effect
```jsx
// BEFORE
<div className="bg-white/70 backdrop-blur-xl border border-gray-100 p-6">
  Content
</div>

// AFTER
<Card variant="glass">
  Content
</Card>
```

---

### Badge Replacement

#### Status Badge
```jsx
// BEFORE
<span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold">
  Confirmed
</span>

// AFTER
import { Badge } from '@/components/ui/badge';

<Badge variant="success">Confirmed</Badge>
```

#### Multiple Status Examples
```jsx
import { Badge } from '@/components/ui/badge';

<Badge variant="primary">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="danger">Danger</Badge>
<Badge variant="gray">Neutral</Badge>
```

---

### Form Input Replacement

#### Text Input
```jsx
// BEFORE
<div>
  <label style={{ marginBottom: '8px' }}>Email</label>
  <input
    type="email"
    style={{
      width: '100%',
      padding: '10px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px'
    }}
  />
</div>

// AFTER
<div>
  <label className="label">Email</label>
  <input type="email" className="input" />
</div>
```

#### Input with Error
```jsx
// BEFORE
<input
  className="border border-red-500"
  aria-invalid="true"
/>

// AFTER
<input className="input input-error" aria-invalid="true" />
```

#### Select Dropdown
```jsx
// BEFORE
<select style={{ padding: '10px', border: '1px solid #e5e7eb' }}>
  <option>Option 1</option>
</select>

// AFTER
<select className="select">
  <option>Option 1</option>
</select>
```

#### Textarea
```jsx
// BEFORE
<textarea style={{ padding: '10px', minHeight: '120px' }} />

// AFTER
<textarea className="textarea" />
```

---

## 📐 Layout & Spacing Replacement

### Container Sizing

#### Before (Hardcoded max-width)
```jsx
<div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
  Content
</div>
```

#### After (Utility Class)
```jsx
<div className="container-lg">Content</div>

// or
<div className="max-w-6xl mx-auto px-4">Content</div>
```

### Grid Layouts

#### Before (Inline Grid)
```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
  {items.map(item => <div key={item.id}>{item.name}</div>)}
</div>
```

#### After (Tailwind Utility)
```jsx
<div className="grid-auto-fit">
  {items.map(item => <div key={item.id}>{item.name}</div>)}
</div>
```

### Flex Centering

#### Before (Manual flex)
```jsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  Centered content
</div>
```

#### After (Utility)
```jsx
<div className="flex-center">
  Centered content
</div>
```

---

## 🎯 Real-World Example: Refactor Dashboard Card

### Original Code
```jsx
function ExpenseCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#6b7280' }}>
          Total Belanja
        </h3>
        <span style={{ fontSize: '24px' }}>🛒</span>
      </div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
        Rp 1,500,000
      </div>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
        5 nota
      </div>
    </div>
  );
}
```

### Refactored Code
```jsx
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';

function ExpenseCard() {
  return (
    <StatCard
      title="Total Belanja"
      value="Rp 1,500,000"
      subtitle="5 nota"
      icon="🛒"
    />
  );
  
  // Or with Card component
  // return (
  //   <Card variant="hover">
  //     <div className="flex-between mb-4">
  //       <h3 className="text-[14px] font-bold uppercase text-gray-500">
  //         Total Belanja
  //       </h3>
  //       <span className="text-2xl">🛒</span>
  //     </div>
  //     <div className="text-lg font-bold text-gray-900">Rp 1,500,000</div>
  //     <p className="text-muted mt-2">5 nota</p>
  //   </Card>
  // );
}
```

---

## 🔧 Step-by-Step Refactoring Checklist

### For Each Page/Component:

1. **Audit Current Styling**
   - [ ] List all inline `style={{}}` attributes
   - [ ] Note all hardcoded colors (colors that should be tokens)
   - [ ] Identify repeated class patterns
   - [ ] Find custom shadow/border definitions

2. **Replace Components**
   - [ ] Replace buttons with `<Button />` component
   - [ ] Replace cards with `<Card />` + sub-components
   - [ ] Replace badges with `<Badge />` component
   - [ ] Replace inputs with `input` class or form component

3. **Apply Design Tokens**
   - [ ] Remove hardcoded colors → use `bg-primary`, `text-success`, etc.
   - [ ] Remove hardcoded spacing → use spacing classes
   - [ ] Remove custom shadows → use `shadow-md`, `shadow-lg`, etc.

4. **Add Responsive Classes**
   - [ ] Mobile: check `sm:` breakpoints
   - [ ] Tablet: verify `md:` classes
   - [ ] Desktop: ensure `lg:` layouts
   - [ ] Test in DevTools device mode

5. **Accessibility Check**
   - [ ] All buttons have `focus-visible:ring-2`
   - [ ] All form inputs have proper labels
   - [ ] Color contrast ≥ 4.5:1
   - [ ] Tab navigation works

6. **Code Review**
   - [ ] No inline styles remain
   - [ ] All imports correct
   - [ ] TypeScript types valid
   - [ ] No console errors

7. **Testing**
   - [ ] Visual check (colors, spacing, alignment)
   - [ ] Responsive test (3+ viewport sizes)
   - [ ] Interaction (hover, focus, active states)
   - [ ] Lighthouse audit

---

## ⚡ Common Patterns & Solutions

### Pattern 1: Button with Icon
```jsx
// AFTER
import { Button } from '@/components/ui/button';

<Button variant="primary">
  <span className="mr-2">📥</span>
  Download
</Button>
```

### Pattern 2: Status Table Row
```jsx
// BEFORE
<tr>
  <td>{item.name}</td>
  <td>
    <span className={`
      px-2 py-1 rounded-full text-xs font-semibold
      ${item.status === 'confirmed' 
        ? 'bg-green-100 text-green-700' 
        : 'bg-amber-100 text-amber-700'
      }
    `}>
      {item.status}
    </span>
  </td>
</tr>

// AFTER
import { Badge } from '@/components/ui/badge';

<tr>
  <td>{item.name}</td>
  <td>
    <Badge variant={item.status === 'confirmed' ? 'success' : 'warning'}>
      {item.status}
    </Badge>
  </td>
</tr>
```

### Pattern 3: Form with Validation
```jsx
// AFTER
import { Button } from '@/components/ui/button';

<form>
  <div className="mb-4">
    <label className="label">Email</label>
    <input
      className={`input ${error ? 'input-error' : ''}`}
      type="email"
    />
    {error && <p className="text-error text-sm mt-1">{error}</p>}
  </div>
  <Button type="submit" variant="primary">
    Submit
  </Button>
</form>
```

---

## 🚀 Optimization Tips During Refactoring

### Tip 1: Use Composition
```jsx
// Instead of repeating button styles
const ActionButtons = ({ onSave, onCancel }) => (
  <div className="flex gap-2 justify-end">
    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
    <Button variant="primary" onClick={onSave}>Save</Button>
  </div>
);
```

### Tip 2: Extract Repeated Patterns
```jsx
// Create wrapper for common layouts
const FormCard = ({ title, children }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
```

### Tip 3: Use Responsive Classes
```jsx
// Mobile-first approach
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id}>{item.name}</Card>)}
</div>
```

---

## 📊 Refactoring Metrics

**Track progress with:**
- [ ] Files refactored: __/__
- [ ] Inline styles removed: __ → 0
- [ ] New components used: __
- [ ] Lighthouse score before: __
- [ ] Lighthouse score after: __ (target: ≥85)
- [ ] Bundle size before: __ KB
- [ ] Bundle size after: __ KB (target: <35 KB)

---

## 🆘 Troubleshooting Common Issues

### Issue: Component not importing
```javascript
// ✓ Correct path
import { Button } from '@/components/ui/button';

// ✗ Wrong path
import Button from '@/components/ui/button';
```

### Issue: Class not applying
```jsx
// ✓ Correct: Tailwind class
<button className="btn-primary">Save</button>

// ✗ Wrong: Arbitrary value (might not work)
<button className="btn-[#2563eb]">Save</button>

// ✗ Wrong: Typo
<button className="btn-primay">Save</button>
```

### Issue: Spacing looks off
```jsx
// ✓ Use token spacing
<div className="p-sp-lg gap-sp-md">Content</div>

// ✗ Don't mix with old spacing
<div className="p-6 gap-4">Content</div>
```

### Issue: Color inconsistent
```jsx
// ✓ Use semantic color
<span className="bg-success text-success-foreground">Success</span>

// ✗ Don't use arbitrary colors
<span className="bg-[#22c55e]">Success</span>
```

---

## 📚 Reference Documents

- **UI_KIT.md** — Component reference & examples
- **globals.css** — Design token definitions
- **DEPLOYMENT_TESTING_GUIDE.md** — Testing procedures
- **UI_REDESIGN_PROGRESS.md** — Overall progress

---

## ✅ Refactoring Completion Checklist

Per page/component:
- [ ] All inline styles replaced
- [ ] New component classes used
- [ ] Design tokens applied
- [ ] Responsive classes added
- [ ] Accessibility verified
- [ ] TypeScript types valid
- [ ] No console errors/warnings
- [ ] Lighthouse audit ≥85
- [ ] Visual regression tested
- [ ] Code reviewed
- [ ] Merged to feature branch

---

**Last Updated:** 2026-06-19  
**Version:** 1.0  
**Ready for:** Developer onboarding & refactoring

Start with one small page (Settings, Dapur) to get familiar, then move to larger pages (Dashboard, Pembukuan).
