'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { APPLE_SPRINGS, triggerCausalHaptic } from '@/lib/apple-motion';

const NAV_ITEMS = [
  {
    href: '/onboarding',
    label: 'Onboarding',
  },
  {
    href: '/admin/menu',
    label: 'Menu & Stock',
  },
  {
    href: '/admin/tables',
    label: 'Table QR',
  },
  {
    href: '/warungmakan?table=TABLE%2004',
    label: 'Storefront',
  },
  {
    href: '/order/66666666-6666-4666-8666-666666666601',
    label: 'Order Pass',
  },
  {
    href: '/cashier/orders',
    label: 'Cashier Kanban',
  },
  {
    href: '/admin/analytics',
    label: 'Shift Report',
  },
];

export function SaberWorkspaceBar() {
  const pathname = usePathname();

  return (
    <header className="no-print liquid-glass-regular sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          onPointerDown={() => triggerCausalHaptic(6)}
          className="apple-interactive group flex min-h-[44px] items-center gap-3 pr-2"
        >
          <div
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#1D1D1F] font-serif text-sm font-bold tracking-tight text-white transition-colors group-hover:bg-apple-blue"
          >
            S
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-[#1D1D1F]">
              Saber Culinary
            </span>
            <span className="hig-caption text-[11px] font-medium text-[#515154]">
              Direct Commerce & Table QR
            </span>
          </div>
        </Link>

        <nav
          aria-label="Primary Workspace Navigation"
          className="no-scrollbar apple-snap-scroller items-center gap-1 py-0.5"
        >
          {NAV_ITEMS.map((item) => {
            const cleanHref = item.href.split('?')[0];
            const isActive =
              pathname === cleanHref ||
              (cleanHref.startsWith('/order/') && pathname.startsWith('/order/'));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                onPointerDown={() => triggerCausalHaptic(6)}
                className={cn(
                  'apple-interactive relative flex min-h-[40px] shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-semibold',
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
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
