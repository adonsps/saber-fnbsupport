'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ChefHat,
  Compass,
  QrCode,
  Sparkles,
  Store,
  UtensilsCrossed,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APPLE_SPRINGS, triggerCausalHaptic } from '@/lib/apple-motion';

const NAV_ITEMS = [
  {
    href: '/onboarding',
    label: '1. Onboarding',
    badge: 'Sprint 1',
    icon: Sparkles,
  },
  {
    href: '/admin/menu',
    label: '2. Menu & Stock',
    badge: 'Sprint 1',
    icon: UtensilsCrossed,
  },
  {
    href: '/admin/tables',
    label: '3. Table QR & PDF',
    badge: 'Sprint 2',
    icon: QrCode,
  },
  {
    href: '/warungmakan?table=TABLE%2004',
    label: '4. Guest Mini-Site',
    badge: 'Sprint 2',
    icon: Store,
  },
  {
    href: '/order/66666666-6666-4666-8666-666666666601',
    label: '5. Live Order Track',
    badge: 'Sprint 2',
    icon: Compass,
  },
  {
    href: '/cashier/orders',
    label: '6. Cashier Kanban',
    badge: 'Sprint 3',
    icon: ChefHat,
  },
  {
    href: '/admin/analytics',
    label: '7. Shift Telemetry',
    badge: 'Sprint 4',
    icon: BarChart3,
  },
];

export function SaberWorkspaceBar() {
  const pathname = usePathname();

  return (
    <header className="no-print apple-material-toolbar sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          onPointerDown={() => triggerCausalHaptic(6)}
          className="apple-interactive group flex items-center gap-2.5 rounded-full pr-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-zinc-950 text-white shadow-sm transition-colors group-hover:bg-apple-blue">
            <QrCode className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-zinc-950">
                Saber F&B Direct
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 sm:inline-flex">
                <CheckCircle2 className="h-2.5 w-2.5" /> 0% Commission
              </span>
            </div>
            <span className="apple-caption text-[10px] font-medium text-zinc-500">
              UMKM Direct Commerce & Table QR Platform
            </span>
          </div>
        </Link>

        <nav
          aria-label="Platform Screens Navigation"
          className="no-scrollbar apple-snap-scroller items-center gap-1 py-0.5"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const cleanHref = item.href.split('?')[0];
            const isActive =
              pathname === cleanHref ||
              (cleanHref.startsWith('/order/') && pathname.startsWith('/order/'));

            return (
              <Link
                key={item.href}
                href={item.href}
                onPointerDown={() => triggerCausalHaptic(6)}
                className={cn(
                  'apple-interactive relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold',
                  isActive
                    ? 'text-white'
                    : 'text-zinc-600 hover:bg-black/[0.04] hover:text-zinc-950'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="saber-workspace-active-pill"
                    transition={APPLE_SPRINGS.default}
                    className="absolute inset-0 -z-10 rounded-full bg-zinc-950 shadow-sm"
                  />
                )}
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
