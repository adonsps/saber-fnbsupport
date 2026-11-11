'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { List, SignIn, SignOut, X } from '@phosphor-icons/react';
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
 * Only render the workspace bar on Platform / Merchant routes (`/`, `/login`, `/onboarding`, `/admin/*`, `/cashier/*`).
 * Customer QR ordering routes (`/[slug]`, `/order/*`, `/checkout`) are strictly isolated.
 */
function isMerchantWorkspaceRoute(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cashier')
  );
}

interface WorkspaceSummary {
  name: string;
  slug: string;
  email?: string;
  isDemo: boolean;
}

export function SaberWorkspaceBar() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const isMerchantRoute = isMerchantWorkspaceRoute(pathname);

  const headerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const lastWideWidthRef = useRef<number>(0);

  const [isWide, setIsWide] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMerchant, setActiveMerchant] = useState<WorkspaceSummary | null>(null);
  const [authenticatedMerchant, setAuthenticatedMerchant] = useState<WorkspaceSummary | null>(null);

  const fetchSessionState = useCallback(() => {
    if (!isMerchantRoute) return;
    fetch('/api/v1/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.activeMerchant) {
          setActiveMerchant({
            name: data.activeMerchant.name,
            slug: data.activeMerchant.slug,
            email: data.activeMerchant.email,
            isDemo: Boolean(
              data.activeMerchant.isDemo || data.activeMerchant.slug === 'warungmakan'
            ),
          });
        }
        if (data?.authenticatedMerchant) {
          setAuthenticatedMerchant({
            name: data.authenticatedMerchant.name,
            slug: data.authenticatedMerchant.slug,
            email: data.authenticatedMerchant.email,
            isDemo: false,
          });
        } else {
          setAuthenticatedMerchant(null);
        }
      })
      .catch(() => {});
  }, [isMerchantRoute]);

  useEffect(() => {
    fetchSessionState();
  }, [pathname, fetchSessionState]);

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
        // ignore
      }
    }

    header.classList.add('is-wide');
    menu.removeAttribute('popover');

    const fitsInline = inner.scrollWidth <= inner.clientWidth && window.innerWidth >= 1024;

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

  const handleLogout = async () => {
    closePopoverIfCollapsed();
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    setAuthenticatedMerchant(null);
    router.push('/login');
    router.refresh();
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
        {/* Official Saber Culinary Brand Lockup */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            onClick={closePopoverIfCollapsed}
            className="apple-interactive flex items-center gap-2.5 rounded-full pr-1"
          >
            <SaberLogo size="sm" className="sm:h-9 sm:w-9 sm:rounded-[11px]" />
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-tight text-[#1D1D1F]">
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
              className="hidden items-center gap-1.5 rounded-full border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-semibold text-[#515154] lg:inline-flex"
            >
              <span className="font-mono text-[10px] font-bold uppercase text-apple-blue">
                {activeMerchant.isDemo ? 'Demo' : 'Resto'}
              </span>
              <span className="max-w-[120px] truncate text-[#1D1D1F]">{activeMerchant.name}</span>
            </Link>
          )}
        </div>

        {/* Single Semantic Navigation Landmark */}
        <nav aria-label="Primary Workspace Navigation" className="flex items-center gap-2">
          <button
            type="button"
            popoverTarget="saber-merchant-menu"
            popoverTargetAction="toggle"
            aria-controls="saber-merchant-menu"
            aria-expanded={menuOpen}
            className="saber-menu-button apple-interactive inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-black/[0.12] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1D1D1F] shadow-apple-sm"
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
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#515154]">
                  {activeMerchant.isDemo ? 'Mode Simulasi Demo' : 'Akun Restoran Terautentikasi'}
                </p>
                <p className="mt-0.5 truncate text-xs font-bold text-[#1D1D1F]">
                  {activeMerchant.name}
                </p>
                <p className="font-mono text-[11px] text-apple-blue">/{activeMerchant.slug}</p>
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
                        ? 'border-l-4 border-apple-blue bg-[#1D1D1F] text-white shadow-apple-sm lg:border-l-0 lg:ring-2 lg:ring-apple-blue/30'
                        : 'text-[#515154] hover:bg-black/[0.05] hover:text-[#1D1D1F]'
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}

            <li className="mt-2 border-t border-black/[0.06] pt-2 lg:ml-1 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-2 lg:pt-0">
              {authenticatedMerchant ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-black/[0.12] bg-[#F5F5F7] px-3.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4] lg:min-h-[38px] lg:rounded-full"
                >
                  <SignOut aria-hidden="true" weight="regular" className="h-3.5 w-3.5" />
                  <span>Keluar</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  aria-current={pathname.startsWith('/login') ? 'page' : undefined}
                  onClick={closePopoverIfCollapsed}
                  className={cn(
                    'flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition-colors lg:min-h-[38px] lg:rounded-full',
                    pathname.startsWith('/login')
                      ? 'bg-apple-blue text-white'
                      : 'border border-black/[0.12] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7]'
                  )}
                >
                  <SignIn aria-hidden="true" weight="regular" className="h-3.5 w-3.5" />
                  <span>Masuk</span>
                </Link>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
