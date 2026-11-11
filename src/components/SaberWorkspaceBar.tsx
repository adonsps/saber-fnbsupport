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
    label: 'Onboarding',
    icon: Sparkles,
  },
  {
    href: '/admin/menu',
    label: 'Menu & Stock',
    icon: UtensilsCrossed,
  },
  {
    href: '/admin/tables',
    label: 'Table QR',
    icon: QrCode,
  },
  {
    href: '/warungmakan?table=TABLE%2004',
    label: 'Storefront',
    icon: Store,
  },
  {
    href: '/order/66666666-6666-4666-8666-666666666601',
    label: 'Order Pass',
    icon: Compass,
  },
  {
    href: '/cashier/orders',
    label: 'Cashier Kanban',
    icon: ChefHat,
  },
  {
    href: '/admin/analytics',
    label: 'Shift Report',
    icon: BarChart3,
  },
];

export function SaberWorkspaceBar() {
  const pathname = usePathname();

  return (
    <header className="no-print liquid-glass-regular sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link
          href="/"
          onPointerDown={() => triggerCausalHaptic(6)}
          className="apple-interactive group flex min-h-[44px] items-center gap-2.5 rounded-full pr-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#1D1D1F] text-white shadow-sm transition-colors group-hover:bg-apple-blue">
            <QrCode className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-[#1D1D1F]">
                Saber F&B Direct
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-[#1D7D32] sm:inline-flex">
                <CheckCircle2 className="h-3 w-3" /> 0% Commission
              </span>
            </div>
            <span className="hig-caption text-[11px] font-medium text-[#515154]">
              Direct Commerce & Table QR Suite
            </span>
          </div>
        </Link>

        <nav
          aria-label="Workspace Navigation"
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
                  'apple-interactive relative flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold',
                  isActive
                    ? 'text-white'
                    : 'text-[#515154] hover:bg-black/[0.05] hover:text-[#1D1D1F]'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="saber-workspace-active-pill"
                    transition={APPLE_SPRINGS.default}
                    className="absolute inset-0 -z-10 rounded-full bg-[#1D1D1F] shadow-sm"
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
