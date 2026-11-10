---
name: apple-hig-design
description: Apple Human Interface Guidelines (HIG) and UI-UX Pro Max design system for Next.js, Tailwind CSS, Shadcn UI, and Framer Motion. Enforces Apple-grade spatial depth, liquid glassmorphism, SF-inspired typography, spring physics micro-interactions, and accessible mobile-first commerce patterns.
---

# Apple HIG & UI-UX Pro Max Design System Skill

This skill governs all UI/UX architecture and component styling for **Saber UMKM F&B Direct Commerce & Table QR Platform** (`saber-fnbsupport`). Every screen—from mobile guest checkout to tablet cashier Kanban—must adhere to Apple's Human Interface Guidelines (HIG) for clarity, deference, and depth.

## 1. Core Aesthetic Pillars

1. **Liquid Glass & Translucent Surfaces**:
   - Sticky headers, floating language pills, and bottom cart bars use `backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80` with crisp `1px` specular borders (`border-black/[0.06]` or `border-white/[0.12]`).
2. **Continuous Squircle Geometry**:
   - Primary cards and modal containers: `rounded-[22px]` or `rounded-2xl`
   - Interactive controls, segmented pills, and buttons: `rounded-full` or `rounded-xl`
   - Thumbnail imagery: `rounded-[16px]` with subtle inner ring `ring-1 ring-black/5`
3. **Diffused Ambient Elevation**:
   - Never use harsh drop shadows. Use multi-layered ambient shadows:
     - Card resting: `shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04),0_1px_3px_0_rgba(0,0,0,0.03)]`
     - Floating bar / Modal: `shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)]`
4. **Typography & Scannable Hierarchy**:
   - Tight tracking on display headings (`tracking-tight font-semibold text-zinc-950`).
   - Tabular numerals (`tabular-nums`) on all IDR currency prices, counters, order timers, and analytics KPIs so numbers never jitter when updating.
5. **Tactile Spring Micro-Interactions**:
   - Buttons and steppers respond immediately with `active:scale-[0.97] transition-all duration-150 ease-out` and Framer Motion spring physics (`stiffness: 400, damping: 30`).
6. **Touch Target & Form Ergonomics (Modern Web Guidance)**:
   - Minimum `44px–48px` tap targets on all mobile guest controls (`+` / `-` steppers, language toggle, order type tabs).
   - Native `<dialog>` semantics with `overscroll-behavior: contain`, accessible `<label>` pairing, `inputmode="numeric"` / `autocomplete` hints, and non-color state indicators.

