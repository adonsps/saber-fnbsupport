'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { triggerCausalHaptic } from '@/lib/apple-motion';
import { SaberLogo } from '@/components/SaberLogo';

const MERCHANT_NAV_ITEMS = [
  {
    href: '/',
    label: 'Portal Utama',
    match: (p: string) => p === '/',
  },
  {
    href: '/onboarding',
    label: 'Setup Toko',
    match: (p: string) => p.startsWith('/onboarding'),
  },
  {
    href: '/admin/menu',
    label: 'Menu & Stok',
    match: (p: string) => p.startsWith('/admin/menu'),
  },
  {
    href: '/admin/tables',
    label: 'QR Meja',
    match: (p: string) => p.startsWith('/admin/tables'),
  },
  {
    href: '/cashier/orders',
    label: 'Kasir Kanban',
    match: (p: string) => p.startsWith('/cashier'),
  },
  {
    href: '/admin/analytics',
    label: 'Laporan Shift',
    match: (p: string) => p.startsWith('/admin/analytics'),
  },
];

/**
 * Only show the Workspace Header on Platform / Merchant routes (`/`, `/onboarding`, `/admin/*`, `/cashier/*`).
 * Customer Table QR storefront routes (`/[slug]`) and Customer Order Pass routes (`/order/*`, `/checkout`)
 * are strictly isolated so customers never see merchant/admin/onboarding tabs.
 */
function isMerchantWorkspaceRoute(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return (
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cashier')
  );
}

interface WorkspaceSummary {
  name: string;
  slug: string;
  isDemo: boolean;
}

export function SaberWorkspaceBar() {
  const pathname = usePathname() || '/';
  const isMerchantRoute = isMerchantWorkspaceRoute(pathname);

  const headerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const lastWideWidthRef = useRef<number>(0);

  const [isWide, setIsWide] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMerchant, setActiveMerchant] = useState<WorkspaceSummary | null>(null);

  // Sync active workspace summary badge
  useEffect(() => {
    if (!isMerchantRoute) return;
    fetch('/api/v1/merchants/onboard', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.merchant) {
          setActiveMerchant({
            name: data.merchant.name,
            slug: data.merchant.slug,
            isDemo: Boolean(data.merchant.isDemo || data.merchant.slug === 'warungmakan'),
          });
        }
      })
      .catch(() => {});
  }, [pathname, isMerchantRoute]);

  // Modern Web Guidance (navbar guide):
  // Measure whether the inline navigation fits inside the header row cleanly;
  // collapse into native `popover="auto"` when narrow so mobile view stays crisp & uncluttered.
  const syncNavbarLayout = useCallback(() => {
    const header = headerRef.current;
    const inner = innerRef.current;
    const menu = menuRef.current;
    if (!header || !inner || !menu) return;

    const currentWidth = header.clientWidth;
    const currentlyWide = header.classList.contains('is-wide');

    if (!currentlyWide && lastWideWidthRef.current > 0 && currentWidth <= lastWideWidthRef.current) {
      return;
    }

    const wasOpen =
      typeof menu.matches === 'function'
        ? menu.matches(':popover-open') || menu.classList.contains(':popover-open')
        : false;

    header.classList.add('is-measuring');
    if (wasOpen && typeof menu.hidePopover === 'function') {
      try {
        menu.hidePopover();
      } catch {
        // ignore if already hidden
      }
    }

    header.classList.add('is-wide');
    menu.removeAttribute('popover');

    // Also keep viewport < 960px collapsed so mobile & tablet prioritize a spacious header
    const fitsInline = inner.scrollWidth <= inner.clientWidth && window.innerWidth >= 960;

    if (fitsInline) {
      lastWideWidthRef.current = 0;
      setIsWide(true);
    } else {
      lastWideWidthRef.current = currentWidth;
      header.classList.remove('is-wide');
      menu.setAttribute('popover', 'auto');
      setIsWide(false);
      if (wasOpen && typeof menu.showPopover === 'function') {
        try {
          menu.showPopover();
        } catch {
          // ignore
        }
      }
    }

    requestAnimationFrame(() => {
      header.classList.remove('is-measuring');
    });
  }, []);

  useEffect(() => {
    if (!isMerchantRoute) return;
    syncNavbarLayout();

    const header = headerRef.current;
    const menu = menuRef.current;
    if (!header || !menu) return;

    const ro = new ResizeObserver(() => {
      syncNavbarLayout();
    });
    ro.observe(header);
    ro.observe(menu);

    const handleToggle = (e: Event) => {
      const ev = e as ToggleEvent;
      setMenuOpen(ev.newState === 'open');
    };
    menu.addEventListener('toggle', handleToggle);

    return () => {
      ro.disconnect();
      menu.removeEventListener('toggle', handleToggle);
    };
  }, [isMerchantRoute, syncNavbarLayout]);

  const closePopoverIfCollapsed = () => {
    triggerCausalHaptic(6);
    const menu = menuRef.current;
    if (menu && typeof menu.hidePopover === 'function') {
      try {
        menu.hidePopover();
      } catch {
        // ignore when inline
      }
    }
  };

  if (!isMerchantRoute) {
    return null;
  }

  return (
    <header
      ref={headerRef}
      className={cn(
        'saber-site-header no-print sticky top-0 z-40 px-3 pt-2 sm:px-6 sm:pt-3',
        isWide && 'is-wide'
      )}
    >
      <div
        ref={innerRef}
        className="saber-header-inner liquid-glass-bar mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl px-3.5 py-2 sm:rounded-full sm:px-4"
      >
        {/* Official Saber Culinary Brand Lockup + Active Environment Indicator */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            onClick={closePopoverIfCollapsed}
            className="apple-interactive flex items-center gap-2.5 rounded-full pr-1"
          >
            <SaberLogo size="sm" className="sm:h-9 sm:w-9 sm:rounded-[11px]" />
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-tight text-[#0F1E36]">
                Saber Culinary
              </span>
              <span className="hidden text-[11px] font-medium text-[#515154] sm:block">
                Direct Table QR &amp; Cashier Platform
              </span>
            </div>
          </Link>

          {activeMerchant && (
            <Link
              href="/"
              onClick={closePopoverIfCollapsed}
              title={`Workspace aktif: ${activeMerchant.name}`}
              className={cn(
                'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold sm:inline-flex',
                activeMerchant.isDemo
                  ? 'border-[#0090FF]/30 bg-[#0090FF]/10 text-[#0066CC]'
                  : 'border-emerald-600/25 bg-emerald-50 text-[#1D7D32]'
              )}
            >
              <span>{activeMerchant.isDemo ? 'DEMO' : 'RESTO'}</span>
              <span className="max-w-[130px] truncate font-semibold text-[#1D1D1F]">
                {activeMerchant.name}
              </span>
            </Link>
          )}
        </div>

        {/* Single Semantic Navigation Landmark */}
        <nav aria-label="Primary Workspace Navigation" className="flex items-center">
          <button
            type="button"
            popoverTarget="saber-merchant-menu"
            popoverTargetAction="toggle"
            aria-controls="saber-merchant-menu"
            aria-expanded={menuOpen}
            className="saber-menu-button apple-interactive inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#0F1E36]/15 bg-white px-3.5 py-1.5 text-xs font-bold text-[#0F1E36] shadow-apple-sm"
          >
            {menuOpen ? (
              <X aria-hidden="true" weight="bold" className="h-4 w-4" />
            ) : (
              <List aria-hidden="true" weight="bold" className="h-4 w-4" />
            )}
            <span>{menuOpen ? 'Tutup' : 'Menu'}</span>
          </button>

          <ul id="saber-merchant-menu" ref={menuRef} className="saber-site-menu">
            {activeMerchant && (
              <li className="saber-mobile-context mb-2 rounded-xl border border-black/[0.06] bg-[#F5F5F7] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#515154]">
                  {activeMerchant.isDemo ? 'Mode Simulasi Demo' : 'Restoran Aktif'}
                </p>
                <p className="mt-0.5 truncate text-xs font-bold text-[#0F1E36]">
                  {activeMerchant.name}
                </p>
                <p className="font-mono text-[11px] text-[#0066CC]">/{activeMerchant.slug}</p>
              </li>
            )}

            {MERCHANT_NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={closePopoverIfCollapsed}
                    className={cn(
                      'flex min-h-[42px] items-center justify-between rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors lg:min-h-[38px] lg:rounded-full lg:px-3.5',
                      active
                        ? 'border-l-4 border-[#0090FF] bg-[#0F1E36] text-white shadow-apple-sm lg:border-l-0 lg:ring-2 lg:ring-[#0090FF]/40'
                        : 'text-[#515154] hover:bg-black/[0.05] hover:text-[#1D1D1F]'
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
