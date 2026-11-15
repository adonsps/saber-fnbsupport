'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { List, SignIn, SignOut, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { APPLE_SPRINGS, triggerCausalHaptic } from '@/lib/apple-motion';
import { SaberLogo } from '@/components/SaberLogo';

const MERCHANT_NAV_ITEMS = [
  {
    href: '/',
    label: 'Beranda',
    match: (p: string) => p === '/',
  },
  {
    href: '/onboarding',
    label: 'Profil Toko',
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
    label: 'Kasir & Dapur',
    match: (p: string) => p.startsWith('/cashier'),
  },
  {
    href: '/admin/analytics',
    label: 'Laporan',
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
        'saber-site-header no-print sticky top-0 z-40 border-b border-sky-200/80 bg-cloud',
        isWide && 'is-wide'
      )}
    >
      <div
        ref={innerRef}
        className="saber-header-inner mx-auto flex min-h-[64px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Saber Culinary Beranda"
            onPointerDown={() => triggerCausalHaptic(6)}
            onClick={closePopoverIfCollapsed}
            className="apple-interactive flex items-center gap-2.5 rounded-lg py-1 pr-1 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
          >
            <SaberLogo size="sm" className="sm:h-9 sm:w-9 sm:rounded-[10px]" />
            <span className="text-base font-bold tracking-tight text-ink-primary">
              Saber Culinary
            </span>
          </Link>

          {authenticatedMerchant && activeMerchant && (
            <Link
              href="/"
              onPointerDown={() => triggerCausalHaptic(6)}
              onClick={closePopoverIfCollapsed}
              title={`Toko aktif: ${activeMerchant.name}`}
              className="hidden items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-ink-secondary active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 lg:inline-flex"
            >
              <span className="font-semibold text-signal-green">
                {activeMerchant.isDemo ? 'Contoh' : 'Aktif'}
              </span>
              <span className="max-w-[140px] truncate font-semibold text-ink-primary">
                {activeMerchant.name}
              </span>
            </Link>
          )}
        </div>

        <nav aria-label="Navigasi Utama" className="flex items-center gap-2">
          <button
            type="button"
            popoverTarget="saber-merchant-menu"
            popoverTargetAction="toggle"
            aria-controls="saber-merchant-menu"
            aria-expanded={menuOpen}
            onPointerDown={() => triggerCausalHaptic(6)}
            className="saber-menu-button apple-interactive inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-sm font-semibold text-ink-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
          >
            {menuOpen ? (
              <X aria-hidden="true" weight="bold" className="h-4 w-4" />
            ) : (
              <List aria-hidden="true" weight="bold" className="h-4 w-4" />
            )}
            <span>{menuOpen ? 'Tutup' : 'Menu'}</span>
          </button>

          <ul id="saber-merchant-menu" ref={menuRef} className="saber-site-menu">
            {authenticatedMerchant && activeMerchant && (
              <li className="saber-mobile-context mb-2 rounded-xl bg-sky-50 p-3">
                <p className="text-xs font-medium text-ink-secondary">
                  {activeMerchant.isDemo ? 'Toko Contoh' : 'Toko Aktif'}
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-ink-primary">
                  {activeMerchant.name}
                </p>
                <p className="font-mono text-xs text-sky-700">/{activeMerchant.slug}</p>
              </li>
            )}

            {MERCHANT_NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onPointerDown={() => triggerCausalHaptic(6)}
                    onClick={closePopoverIfCollapsed}
                    className={cn(
                      'apple-interactive relative flex min-h-[42px] items-center justify-between rounded-lg px-3.5 py-2 text-sm font-medium transition-colors active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 lg:min-h-[38px]',
                      active
                        ? isWide
                          ? 'text-cloud'
                          : 'border-l-4 border-scarlet-600 bg-ink-primary text-cloud'
                        : 'text-ink-secondary hover:bg-sky-50 hover:text-ink-primary'
                    )}
                  >
                    {active && isWide && (
                      <motion.span
                        layoutId="saber-workspace-active-pill"
                        transition={APPLE_SPRINGS.default}
                        className="absolute inset-0 -z-10 rounded-lg bg-ink-primary"
                      />
                    )}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}

            <li className="mt-2 border-t border-sky-100 pt-2 lg:ml-2 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
              {authenticatedMerchant ? (
                <button
                  type="button"
                  onPointerDown={() => triggerCausalHaptic(6)}
                  onClick={handleLogout}
                  className="apple-interactive flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 text-sm font-medium text-scarlet-600 hover:bg-scarlet-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 lg:min-h-[38px]"
                >
                  <SignOut aria-hidden="true" weight="regular" className="h-4 w-4" />
                  <span>Keluar</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  aria-current={pathname.startsWith('/login') ? 'page' : undefined}
                  onPointerDown={() => triggerCausalHaptic(6)}
                  onClick={closePopoverIfCollapsed}
                  className={cn(
                    'apple-interactive relative flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 lg:min-h-[38px]',
                    pathname.startsWith('/login')
                      ? 'bg-scarlet-600 text-cloud'
                      : 'border border-sky-200 bg-sky-50 text-ink-primary hover:bg-sky-100'
                  )}
                >
                  <SignIn aria-hidden="true" weight="regular" className="h-4 w-4" />
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
