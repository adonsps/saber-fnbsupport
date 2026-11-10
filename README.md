# Saber UMKM F&B Direct Commerce & Table QR Platform (`saber-fnbsupport`)

Zero-commission direct-ordering PWA micro-platform designed for Indonesian F&B micro-merchants (warungs, cafes, dine-in restaurants, cloud/dark kitchens) by **Saber Technology Studio**.

## Architecture & Tech Stack
- **Framework**: Next.js 14 (App Router, TypeScript strict mode, PWA Web Manifest)
- **Design System**: Tailwind CSS + Lucide React + Framer Motion + Apple HIG Design System (`.agents/skills/apple-hig-design/SKILL.md`)
- **Database & ORM**: PostgreSQL + Prisma ORM (`prisma/schema.prisma` + `prisma/schema.sql`)
- **Subdomain Engine**: Multi-tenant middleware (`src/middleware.ts`) routing `[slug].saberconsulting.id`
- **PDF Engine**: `@react-pdf/renderer` + `qrcode` for printable A4/A5 Table QR tent sheets
- **Notification Engine**: Saber Central Automated WhatsApp Gateway Bot (`/api/v1/webhooks/whatsapp`)

## Implemented Sprints & Screens
- **Sprint 1**: `/onboarding` (3-step self-onboarding wizard with live subdomain validator, 1:1 logo crop, operational hours, delivery & QRIS upload) & `/admin/menu` (bilingual ID/EN menu CRUD, Master Store Open/Paused banner, optimistic 1-click Sold Out switches)
- **Sprint 2**: `/admin/tables` (live occupancy grid, bulk table 1–N generator, A4/A5 PDF QR sheets), `/[slug]` (mobile-first mini-site with `ID | EN` pill, Walk-In/Pre-Order/Delivery tabs, localStorage cart), `/checkout`, `/order/[orderId]` & `/order/[orderId]/receipt`
- **Sprint 3**: `/cashier/orders` (5-column Kanban board with web audio chime, Partial Stock Audit modal with live total recalculation, Payment Proof Inspector, Move/Merge Table controls, automatic `isOccupied = false` session reset on completion)
- **Sprint 4**: `/admin/analytics` (Gross Sales IDR, Order Channel Breakdown, Payment Mix Cash vs QRIS, Top 5 Best-Selling Dishes, Emergency Pause & Sold-Out Reset Engine, CSV & Print PDF export)

## 3-Stage CI/CD Governance
- `feat/*` / `fix/*` -> PR to `staging` (`.github/workflows/ci-check.yml`)
- Push / Merge to `staging` -> Auto-Deploy Staging (`.github/workflows/deploy-staging.yml`)
- PR `staging` -> `main` -> Auto-Deploy Production (`.github/workflows/deploy-production.yml`)

