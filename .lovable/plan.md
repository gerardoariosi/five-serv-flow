**File:** `src/components/layout/AppLayout.tsx`

**Change:**
On line 104, add `overflow-x-hidden` to the `<main>` element's `className`.

Before:
```tsx
className={`flex-1 overflow-y-auto ${isTechnician ? 'pb-16 md:pb-0' : ''}`}
```

After:
```tsx
className={`flex-1 overflow-y-auto overflow-x-hidden ${isTechnician ? 'pb-16 md:pb-0' : ''}`}
```

No other changes.